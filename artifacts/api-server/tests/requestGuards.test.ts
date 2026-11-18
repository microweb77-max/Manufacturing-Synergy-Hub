import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import {
  apiSecurityHeaders, createApiCors, parseApiJson, apiNotFound, apiErrorHandler,
} from "../src/middlewares/requestGuards";
import { rateLimit } from "../src/lib/rateLimit";

async function withApp(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); }
}

test("ordinary JSON is limited to 1MB while existing file and verification uploads retain 12MB", async () => {
  const app = express();
  app.use(parseApiJson);
  app.use((_req, res) => { res.json({ accepted: true }); });
  app.use(apiErrorHandler);
  const body = JSON.stringify({ data: "x".repeat(1_100_000) });
  await withApp(app, async (base) => {
    const send = (path: string, data = body) => fetch(base + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: data,
    });
    assert.equal((await send("/api/projects")).status, 413);
    for (const path of [
      "/api/companies", "/api/companies/12", "/api/companies/analyze-material",
      "/api/banners", "/api/solutions/4", "/api/resume-submissions",
      "/api/membership/claims", "/API/MEMBERSHIP/CLAIMS/",
    ]) assert.equal((await send(path)).status, 200, path);
    assert.equal((await send("/api/membership/invitations")).status, 413);
    assert.equal((await send("/api/companies", JSON.stringify({ data: "x".repeat(12 * 1024 * 1024) }))).status, 413);
  });
});

test("malformed JSON and unexpected errors return generic JSON, not stack traces", async () => {
  const app = express();
  app.use(parseApiJson);
  app.get("/crash", () => { throw new Error("PRIVATE_INTERNAL_DIAGNOSTIC"); });
  app.use(apiNotFound);
  app.use(apiErrorHandler);
  await withApp(app, async (base) => {
    const malformed = await fetch(base + "/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "잘못된 요청입니다." });
    const crash = await fetch(base + "/crash");
    assert.equal(crash.status, 500);
    assert.ok(!(await crash.text()).includes("PRIVATE_INTERNAL_DIAGNOSTIC"));
    const missing = await fetch(base + "/api/unknown");
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type") ?? "", /application\/json/);
  });
});

test("security headers apply without disclosing the server framework", async () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(apiSecurityHeaders);
  app.use(apiNotFound);
  await withApp(app, async (base) => {
    const response = await fetch(base + "/api/not-found");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });
});

test("CORS only allows explicitly trusted origins, never arbitrary credentialed reflection", async () => {
  for (const origins of ["", "https://trusted.example"]) {
    const app = express();
    app.use(createApiCors(origins));
    app.get("/", (_req, res) => { res.json({ ok: true }); });
    await withApp(app, async (base) => {
      const foreign = await fetch(base, { headers: { Origin: "https://untrusted.example" } });
      assert.equal(foreign.headers.get("access-control-allow-origin"), null);
      const trusted = await fetch(base, { headers: { Origin: "https://trusted.example" } });
      assert.equal(trusted.headers.get("access-control-allow-origin"), origins || null);
      if (origins) assert.equal(trusted.headers.get("access-control-allow-credentials"), "true");
    });
  }
});

test("analysis limiter isolates verified accounts, ignores submitted IDs, bounds keys and expires", async () => {
  const app = express();
  let clock = 1_000;
  app.use(express.json());
  // Test-only stand-in for the existing server-side Clerk permission middleware.
  app.use((req, res, next) => {
    res.locals.identity = { userId: req.get("x-test-user") ?? "user-a" };
    next();
  });
  app.use(rateLimit({ max: 2, windowMs: 60_000, maxKeys: 2, message: "limited", now: () => clock }));
  app.use((_req, res) => { res.status(204).end(); });
  await withApp(app, async (base) => {
    const request = (user = "user-a") => fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-user": user },
      body: JSON.stringify({ userId: "spoofed-" + clock++ }),
    });
    assert.equal((await request()).status, 204);
    assert.equal((await request()).status, 204);
    const blocked = await request();
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal((await request("user-b")).status, 204);
    assert.equal((await request("user-c")).status, 429);
    clock += 60_001;
    assert.equal((await request("user-c")).status, 204);
    assert.equal((await request()).status, 204);
  });
});
