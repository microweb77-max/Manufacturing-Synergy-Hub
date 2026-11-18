import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createScheduledNewsHandler, schedulerTokenMatches, vietnamDay } from "../src/jobs/newsSchedule";
import { collectNews, NewsCollectionError } from "../src/routes/news";
import { pool } from "@workspace/db";

const fixtureSecret = "test-only-news-scheduler-token-not-a-real-secret";

test("Vietnam calendar day changes at 17:00 UTC, including year boundaries", () => {
  assert.equal(vietnamDay(new Date("2026-10-06T16:59:59.999Z")), "2026-10-06");
  assert.equal(vietnamDay(new Date("2026-10-06T17:00:00.000Z")), "2026-10-07");
  assert.equal(vietnamDay(new Date("2026-12-31T17:00:00.000Z")), "2027-01-01");
});

test("scheduler auth fails closed and rejects empty, incorrect and oversized credentials", () => {
  assert.equal(schedulerTokenMatches(undefined, fixtureSecret), false);
  assert.equal(schedulerTokenMatches(`Bearer ${fixtureSecret}`, undefined), false);
  assert.equal(schedulerTokenMatches("Bearer short", "short"), false);
  assert.equal(schedulerTokenMatches("Bearer incorrect", fixtureSecret), false);
  assert.equal(schedulerTokenMatches(`Bearer ${"x".repeat(2048)}`, fixtureSecret), false);
  assert.equal(schedulerTokenMatches(`Bearer ${fixtureSecret}`, fixtureSecret), true);
});

test("scheduled endpoint requires its own token, ignores cookie admin flags, and reports retryable failure", async () => {
  let calls = 0;
  let fail = false;
  const app = express();
  app.post("/api/scheduled/news", createScheduledNewsHandler(async (_topic, day) => {
    calls++;
    assert.equal(day, "2026-10-07");
    if (fail) throw new NewsCollectionError(429, "busy");
    return { inserted: 2, skipped: 1, articles: [], alreadyCompleted: false };
  }, () => fixtureSecret, () => new Date("2026-10-06T17:00:00Z")));
  app.post("/unconfigured", createScheduledNewsHandler(async () => {
    throw new Error("Must never be called");
  }, () => undefined));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const denied = await fetch(`${base}/api/scheduled/news`, {
      method: "POST", headers: { Cookie: "admin_auth=1" },
    });
    assert.equal(denied.status, 401);
    assert.equal(calls, 0);
    assert.equal((await fetch(`${base}/unconfigured`, { method: "POST" })).status, 503);
    const headers = { Authorization: `Bearer ${fixtureSecret}` };
    const success = await fetch(`${base}/api/scheduled/news`, { method: "POST", headers });
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), {
      scheduledDay: "2026-10-07", timezone: "Asia/Ho_Chi_Minh",
      inserted: 2, skipped: 1, alreadyCompleted: false,
    });
    fail = true;
    const busy = await fetch(`${base}/api/scheduled/news`, { method: "POST", headers });
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get("retry-after"), "60");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  }
});

test("persistent completed-day marker skips collection without contacting Gemini", async () => {
  const day = "1900-01-01";
  const inserted = await pool.query(
    "INSERT INTO news_refresh_runs(scheduled_day,inserted,skipped) VALUES($1,0,0) ON CONFLICT DO NOTHING RETURNING scheduled_day",
    [day],
  );
  assert.equal(inserted.rowCount, 1, "Test fixture must not overwrite an existing run.");
  try {
    const result = await collectNews("", day);
    assert.equal(result.alreadyCompleted, true);
    assert.equal(result.inserted, 0);
  } finally {
    await pool.query("DELETE FROM news_refresh_runs WHERE scheduled_day=$1", [day]);
  }
});

test("database lock blocks concurrent collection before contacting Gemini", async () => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(728301, 1)");
    await assert.rejects(collectNews(), (error: unknown) =>
      error instanceof NewsCollectionError && error.status === 429);
  } finally {
    await client.query("SELECT pg_advisory_unlock(728301, 1)");
    client.release();
  }
});

test.after(async () => { await pool.end(); });
