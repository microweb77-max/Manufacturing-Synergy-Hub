import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Minimal single-admin authentication.
 *
 * - The admin password comes from the ADMIN_PASSWORD env var (Replit Secret).
 * - On login we issue a stateless HMAC-signed token in an httpOnly cookie, so it
 *   works across autoscale instances without a session store.
 * - The signing key is SESSION_SECRET if set, otherwise derived from
 *   ADMIN_PASSWORD (changing the password therefore logs everyone out).
 * - If ADMIN_PASSWORD is not set, admin access is impossible (fail closed).
 */

export const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function adminPassword(): string | null {
  const pw = process.env["ADMIN_PASSWORD"];
  return pw && pw.length > 0 ? pw : null;
}

export function isAuthConfigured(): boolean {
  return adminPassword() !== null;
}

function signingKey(): Buffer | null {
  const secret = process.env["SESSION_SECRET"];
  if (secret && secret.length > 0) return Buffer.from(secret);
  const pw = adminPassword();
  if (!pw) return null;
  return crypto.createHash("sha256").update(`synergy-hub-session:${pw}`).digest();
}

function hmac(key: Buffer, data: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function checkPassword(candidate: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  // Compare fixed-length digests so length differences don't leak via timing.
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueSession(res: Response): void {
  const key = signingKey();
  if (!key) throw new Error("Admin auth not configured");
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  const token = `${payload}.${hmac(key, payload)}`;
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function isAdmin(req: Request): boolean {
  const key = signingKey();
  if (!key) return false;
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac(key, payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      role?: string;
      exp?: number;
    };
    return data.role === "admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAdmin(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "관리자 로그인이 필요합니다." });
}

/**
 * Central access policy for the /api router. Default: reads are public,
 * writes require admin. Exceptions are listed explicitly so the whole policy
 * can be audited in one place.
 */
const PUBLIC_WRITES = new Set([
  "POST /auth/login",
  "POST /auth/logout",
  // Public submission flows (anyone may register / apply / request)
  "POST /companies",
  "POST /companies/analyze-material", // rate-limited separately
  "POST /projects",
  "POST /matches", // 매칭 제안하기 from project detail page
  "POST /solutions",
  "POST /talent",
  "POST /supply-offers",
  "POST /offer-matches",
  "POST /project-applications",
  "POST /resume-submissions",
]);

/** Reads that expose personal data / admin-only results. */
const ADMIN_READS = ["/resume-submissions", "/offer-matches"];

export function accessPolicy(req: Request, res: Response, next: NextFunction): void {
  const path = req.path.length > 1 ? req.path.replace(/\/+$/, "") : req.path;
  const method = req.method.toUpperCase();

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    const adminRead = ADMIN_READS.some((p) => path === p || path.startsWith(`${p}/`));
    if (adminRead) {
      requireAdmin(req, res, next);
      return;
    }
    next();
    return;
  }

  if (PUBLIC_WRITES.has(`${method} ${path}`)) {
    next();
    return;
  }
  requireAdmin(req, res, next);
}

/**
 * Tiny in-memory fixed-window rate limiter (per instance). Good enough to
 * blunt brute force / cost abuse without extra infrastructure.
 */
export function rateLimit(opts: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
      res.status(429).json({ error: opts.message });
      return;
    }
    next();
  };
}
