import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createOfferPriceVisibility, visibleOfferPrice } from "../src/middlewares/offerPriceVisibility";

const storedOffer = { id: 1, unitPrice: "220.00", currency: "USD", itemName: "공개 품목" };

async function withSession(
  session: { userId: string | null; sessionId: string | null } | "failure",
  run: (base: string) => Promise<void>,
) {
  const app = express();
  app.get("/api/supply-offers", createOfferPriceVisibility(() => {
    if (session === "failure") throw new Error("Private provider detail");
    return session;
  }), (_req, res) => res.json([visibleOfferPrice(storedOffer, res.locals.canViewOfferPrices === true)]));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}/api/supply-offers`); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test("anonymous reads keep public information but replace the price with exact xxx", async () => {
  await withSession({ userId: null, sessionId: null }, async (url) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ ...storedOffer, unitPrice: "xxx" }]);
    assert.equal(storedOffer.unitPrice, "220.00"); // Never mutate the source record.
    assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/);
    assert.match(response.headers.get("vary") ?? "", /Cookie/);
    assert.match(response.headers.get("vary") ?? "", /Authorization/);
  });
});

test("ordinary signed-in members and admins can see the original price", async () => {
  for (const userId of ["ordinary-member", "platform-admin"]) {
    await withSession({ userId, sessionId: "verified-session" }, async (url) => {
      const response = await fetch(url);
      assert.deepEqual(await response.json(), [storedOffer]);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    });
  }
});

test("an absent/incomplete session and spoofed query/header values never reveal the price", async () => {
  for (const session of [{ userId: null, sessionId: null }, { userId: "user", sessionId: null }, { userId: null, sessionId: "session" }]) {
    await withSession(session, async (url) => {
      const response = await fetch(`${url}?isSignedIn=true&userId=admin`, {
        headers: { Cookie: "admin_auth=1; isSignedIn=true", "X-User-Id": "admin" },
      });
      assert.equal((await response.json())[0].unitPrice, "xxx");
    });
  }
});

test("session verification failure stops the handler without returning private data", async () => {
  await withSession("failure", async (url) => {
    const response = await fetch(url);
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.ok(!text.includes("220.00"));
    assert.ok(!text.includes("Private provider detail"));
  });
});
