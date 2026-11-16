import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE,
  accessPolicy,
  checkPassword,
  isAdmin,
  issueSession,
  rateLimit,
} from "../lib/auth";

const ORIGINAL = { ...process.env };

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    cookieValue: undefined as string | undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(b: unknown) {
      res.body = b;
      return res;
    },
    setHeader(k: string, v: string) {
      res.headers[k] = v;
    },
    cookie(_n: string, v: string) {
      res.cookieValue = v;
    },
  };
  return res;
}

const reqWithCookie = (token?: string) =>
  ({ cookies: token === undefined ? {} : { [SESSION_COOKIE]: token } }) as unknown as Request;

function runPolicy(method: string, path: string, authed = false) {
  const res = mockRes();
  const next = vi.fn();
  const req = {
    method,
    path,
    cookies: authed ? { [SESSION_COOKIE]: tokenFor() } : {},
  } as unknown as Request;
  accessPolicy(req, res as unknown as Response, next as NextFunction);
  return { res, next };
}

function tokenFor(): string {
  const res = mockRes();
  issueSession(res as unknown as Response);
  return res.cookieValue!;
}

beforeEach(() => {
  process.env["ADMIN_PASSWORD"] = "pw-test";
  delete process.env["SESSION_SECRET"];
});
afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.useRealTimers();
});

describe("세션 토큰", () => {
  it("발급한 토큰은 검증 통과", () => {
    expect(isAdmin(reqWithCookie(tokenFor()))).toBe(true);
  });

  it("쿠키가 없거나 형식이 틀리면 거부", () => {
    expect(isAdmin(reqWithCookie())).toBe(false);
    expect(isAdmin(reqWithCookie("garbage"))).toBe(false);
  });

  it("위조된 서명/페이로드 거부", () => {
    const [payload, sig] = tokenFor().split(".");
    expect(isAdmin(reqWithCookie(`${payload}.${sig}x`))).toBe(false);
    const forged = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + 1e9 })).toString(
      "base64url",
    );
    expect(isAdmin(reqWithCookie(`${forged}.${sig}`))).toBe(false);
    const badSig = crypto.createHmac("sha256", "other").update(forged).digest("base64url");
    expect(isAdmin(reqWithCookie(`${forged}.${badSig}`))).toBe(false);
  });

  it("만료된 토큰 거부", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const t = tokenFor();
    expect(isAdmin(reqWithCookie(t))).toBe(true);
    vi.setSystemTime(new Date("2026-01-01T12:00:01Z"));
    expect(isAdmin(reqWithCookie(t))).toBe(false);
  });

  it("비밀번호 변경 시 기존 토큰 무효", () => {
    const t = tokenFor();
    process.env["ADMIN_PASSWORD"] = "changed";
    expect(isAdmin(reqWithCookie(t))).toBe(false);
  });

  it("ADMIN_PASSWORD 미설정이면 항상 거부(fail closed)", () => {
    const t = tokenFor();
    delete process.env["ADMIN_PASSWORD"];
    expect(isAdmin(reqWithCookie(t))).toBe(false);
    expect(checkPassword("anything")).toBe(false);
    expect(() => issueSession(mockRes() as unknown as Response)).toThrow();
  });

  it("checkPassword", () => {
    expect(checkPassword("pw-test")).toBe(true);
    expect(checkPassword("nope")).toBe(false);
  });
});

describe("accessPolicy", () => {
  it("GET은 공개", () => {
    const { next, res } = runPolicy("GET", "/companies");
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("ADMIN_READS는 비로그인 401 / 로그인 통과 (하위 경로·말미 슬래시 포함)", () => {
    for (const p of ["/resume-submissions", "/resume-submissions/1/file", "/offer-matches", "/offer-matches/"]) {
      const anon = runPolicy("GET", p);
      expect(anon.res.statusCode, p).toBe(401);
      expect(anon.next).not.toHaveBeenCalled();
      expect(runPolicy("GET", p, true).next, p).toHaveBeenCalled();
    }
  });

  it("PUBLIC_WRITES는 비로그인 통과", () => {
    for (const k of [
      ["POST", "/auth/login"],
      ["POST", "/companies"],
      ["POST", "/project-applications"],
      ["POST", "/resume-submissions"],
    ] as const) {
      expect(runPolicy(k[0], k[1]).next, k.join(" ")).toHaveBeenCalled();
    }
  });

  it("그 외 쓰기는 비로그인 401, 로그인 통과", () => {
    for (const k of [
      ["DELETE", "/companies/1"],
      ["PATCH", "/companies/1"],
      ["POST", "/news/collect"],
      ["PUT", "/companies"],
    ] as const) {
      const anon = runPolicy(k[0], k[1]);
      expect(anon.res.statusCode, k.join(" ")).toBe(401);
      expect(anon.next).not.toHaveBeenCalled();
      expect(runPolicy(k[0], k[1], true).next).toHaveBeenCalled();
    }
  });
});

describe("rateLimit", () => {
  it("한도 초과 시 429 + Retry-After, 창이 지나면 초기화", () => {
    vi.useFakeTimers();
    const limiter = rateLimit({ windowMs: 1000, max: 2, message: "too many" });
    const call = () => {
      const res = mockRes();
      const next = vi.fn();
      limiter({ ip: "1.1.1.1" } as Request, res as unknown as Response, next);
      return { res, next };
    };
    expect(call().next).toHaveBeenCalled();
    expect(call().next).toHaveBeenCalled();
    const blocked = call();
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.body).toEqual({ error: "too many" });
    expect(blocked.res.headers["Retry-After"]).toBeDefined();
    vi.advanceTimersByTime(1001);
    expect(call().next).toHaveBeenCalled();
  });
});
