import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApiAuthorization, type Identity } from "../src/middlewares/apiAuthorization";

// Verify the policy for EVERY actual write route, not just a few handpicked URLs.
const routesDir = fileURLToPath(new URL("../src/routes/", import.meta.url));
const writes = readdirSync(routesDir).filter(f => f.endsWith(".ts")).flatMap(file => {
  const source = readFileSync(`${routesDir}/${file}`, "utf8");
  return [...source.matchAll(/router\.(post|patch|put|delete)\("([^"]+)"/g)]
    .map(m => ({ method: m[1].toUpperCase(), path: m[2].replace(/:[^/]+/g, "1") }));
});

async function withServer(identity: Identity | null | "failure", run: (base: string) => Promise<void>) {
  const app = express();
  app.use("/api", createApiAuthorization(async () => {
    if (identity === "failure") throw new Error("Provider unavailable");
    return identity;
  }, async () => false));
  app.use((_req, res) => { res.status(204).end(); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}/api`); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

test("all registered write endpoints reject anonymous visitors before handlers", async () => {
  assert.ok(writes.length > 30);
  await withServer(null, async base => {
    for (const route of writes) {
      const response = await fetch(base + route.path, {
        method: route.method,
        headers: { "Content-Type": "application/json", Cookie: "admin_auth=1" },
        body: JSON.stringify({ isAdmin: true, role: "platform_admin" }),
      });
      assert.equal(response.status, 401, `${route.method} ${route.path}`);
    }
  });
});

test("signed-in members cannot impersonate admins on any write route", async () => {
  await withServer({ userId: "member", isAdmin: false }, async base => {
    for (const route of writes) {
      const response = await fetch(base + route.path, { method: route.method });
      assert.equal(response.status, route.path.startsWith("/membership/") || route.path.startsWith("/me/") ? 204 : 403, `${route.method} ${route.path}`);
    }
  });
});

test("verified admins can reach all write handlers", async () => {
  await withServer({ userId: "admin", isAdmin: true }, async base => {
    for (const route of writes) {
      const response = await fetch(base + route.path, { method: route.method });
      assert.equal(response.status, 204, `${route.method} ${route.path}`);
    }
  });
});

test("public reads and preflight remain open without calling the identity provider", async () => {
  await withServer("failure", async base => {
    for (const path of ["/companies", "/projects", "/matches", "/solutions", "/companies/1", "/auth/me", "/healthz"]) {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        assert.equal((await fetch(base + path, { method })).status, 204);
      }
    }
  });
});

test("private submissions cannot be read by anonymous visitors or members", async () => {
  for (const identity of [null, { userId: "member", isAdmin: false }, { userId: "admin", isAdmin: true }]) {
    await withServer(identity, async base => {
      for (const path of ["/resume-submissions", "/project-applications", "/talent-contact-requests", "/offer-matches", "/admin/events", "/admin/tenders"]) {
        for (const method of ["GET", "HEAD"]) {
          for (const variant of [path, path.toUpperCase(), path + "/1"]) {
            assert.equal((await fetch(base + variant + "/?page=1", { method })).status,
              identity?.isAdmin ? 204 : identity ? 403 : 401);
          }
        }
      }
    });
  }
});

test("permission lookup failure fails closed", async () => {
  await withServer("failure", async base => {
    assert.equal((await fetch(base + "/companies/1", { method: "DELETE" })).status, 503);
  });
});

test("foreign-site writes are rejected; same-origin writes reach the handler", async () => {
  await withServer({ userId: "admin", isAdmin: true }, async base => {
    assert.equal((await fetch(base + "/companies", {
      method: "POST", headers: { Origin: "https://attacker.example" },
    })).status, 403);
    assert.equal((await fetch(base + "/companies", {
      method: "POST", headers: { Origin: new URL(base).origin },
    })).status, 204);
  });
});