import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createScheduledTalentHandler } from "../src/jobs/talentSchedule";
import { collectJobs, TalentCollectionError } from "../src/routes/talent";
import { pool } from "@workspace/db";

const fixtureSecret = "test-only-talent-scheduler-token-not-a-real-secret";

test("scheduled talent endpoint requires its own token, collects hiring posts for the Vietnam day, and reports retryable failure", async () => {
  let calls = 0;
  let fail = false;
  const app = express();
  app.post("/api/scheduled/talent", createScheduledTalentHandler(async (postType, region, day) => {
    calls++;
    assert.equal(postType, "hiring");
    assert.equal(region, "");
    assert.equal(day, "2026-10-07");
    if (fail) throw new TalentCollectionError(429, "busy");
    return { inserted: 3, skipped: 2, posts: [], alreadyCompleted: false };
  }, () => fixtureSecret, () => new Date("2026-10-06T17:00:00Z")));
  app.post("/unconfigured", createScheduledTalentHandler(async () => {
    throw new Error("Must never be called");
  }, () => undefined));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const denied = await fetch(`${base}/api/scheduled/talent`, {
      method: "POST", headers: { Cookie: "admin_auth=1" },
    });
    assert.equal(denied.status, 401);
    assert.equal(calls, 0);
    assert.equal((await fetch(`${base}/unconfigured`, { method: "POST" })).status, 503);
    const headers = { Authorization: `Bearer ${fixtureSecret}` };
    const success = await fetch(`${base}/api/scheduled/talent`, { method: "POST", headers });
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), {
      scheduledDay: "2026-10-07", timezone: "Asia/Ho_Chi_Minh", postType: "hiring",
      inserted: 3, skipped: 2, alreadyCompleted: false,
    });
    fail = true;
    const busy = await fetch(`${base}/api/scheduled/talent`, { method: "POST", headers });
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get("retry-after"), "60");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  }
});

test("a completed day for a post type skips collection without contacting Gemini", async () => {
  const day = "1900-01-01";
  const inserted = await pool.query(
    "INSERT INTO talent_refresh_runs(scheduled_day,post_type,inserted,skipped) VALUES($1,'hiring',0,0) ON CONFLICT DO NOTHING RETURNING scheduled_day",
    [day],
  );
  assert.equal(inserted.rowCount, 1, "Test fixture must not overwrite an existing run.");
  try {
    const result = await collectJobs("hiring", "", day);
    assert.equal(result.alreadyCompleted, true);
    assert.equal(result.inserted, 0);
  } finally {
    await pool.query("DELETE FROM talent_refresh_runs WHERE scheduled_day=$1", [day]);
  }
});

test("database lock blocks concurrent talent collection before contacting Gemini", async () => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(728301, 2)");
    await assert.rejects(collectJobs("hiring"), (error: unknown) =>
      error instanceof TalentCollectionError && error.status === 429);
  } finally {
    await client.query("SELECT pg_advisory_unlock(728301, 2)");
    client.release();
  }
});

test.after(async () => { await pool.end(); });
