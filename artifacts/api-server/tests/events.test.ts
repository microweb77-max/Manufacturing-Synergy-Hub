import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool, eventsTable, userBookmarksTable, userAlertPreferencesTable } from "@workspace/db";
import {
  buildDigestText, dedupeEvents, eventDedupKey, normalizeEventCity, parseBoolQuery,
  parseIsoDate, periodEnd, pickAllowedUrl,
} from "../src/lib/events";
import {
  addBookmark, listBookmarks, removeBookmark, saveAlertPreference, getAlertPreference,
  sendWeeklyEventAlerts, unsubscribeByToken, resolveAlertEmail, verifiedEmails,
} from "../src/lib/userItems";
import alertsRouter from "../src/routes/alerts";
import { createScheduledEventsCollectHandler, createWeeklyAlertsHandler } from "../src/jobs/eventsSchedule";

const U1 = "test-user-events-1";
const U2 = "test-user-events-2";
const TITLE = "TEST-EVENTS-행사";
const secret = "test-only-events-scheduler-token-not-a-real-secret";

after(async () => {
  await db.delete(userBookmarksTable).where(inArray(userBookmarksTable.clerkUserId, [U1, U2]));
  await db.delete(userAlertPreferencesTable).where(inArray(userAlertPreferencesTable.clerkUserId, [U1, U2]));
  await db.delete(eventsTable).where(eq(eventsTable.venue, TITLE));
  await pool.end();
});

test("dedupe uses normalized title + startDate, within the batch and against existing rows", () => {
  assert.equal(eventDedupKey("NEPCON Vietnam 2027!", "2027-01-05"), eventDedupKey(" nepcon  vietnam 2027", "2027-01-05"));
  assert.notEqual(eventDedupKey("NEPCON", "2027-01-05"), eventDedupKey("NEPCON", "2027-01-06"));
  const existing = [eventDedupKey("Vietnam AI Summit", "2027-02-01")];
  const { keep, skipped } = dedupeEvents(existing, [
    { title: "vietnam ai summit", startDate: "2027-02-01" },
    { title: "Vietnam AI Summit", startDate: "2027-03-01" },
    { title: "Vietnam AI Summit!", startDate: "2027-03-01" },
  ]);
  assert.equal(keep.length, 1);
  assert.equal(skipped, 2);
});

test("hallucinated source links fall back to grounding sources", () => {
  const allowed = new Set(["https://real.example/a"]);
  assert.equal(pickAllowedUrl("https://real.example/a", allowed, "https://real.example/a"), "https://real.example/a");
  assert.equal(pickAllowedUrl("https://fake.example/x", allowed, "https://real.example/a"), "https://real.example/a");
  assert.equal(pickAllowedUrl("https://fake.example/x", new Set(), null), null);
});

test("date, period and query helpers", () => {
  assert.equal(parseIsoDate("2027-02-29"), null);
  assert.equal(parseIsoDate("2028-02-29"), "2028-02-29");
  assert.equal(parseIsoDate("27-1-1"), null);
  assert.equal(periodEnd("month", "2026-11-19"), "2026-11-30");
  assert.equal(periodEnd("three-months", "2026-11-19"), "2027-02-28");
  assert.equal(periodEnd("all", "2026-11-19"), null);
  assert.equal(parseBoolQuery("false"), false);
  assert.equal(parseBoolQuery("true"), true);
  assert.equal(normalizeEventCity("Ho Chi Minh City"), "호치민");
  assert.equal(normalizeEventCity("Hải Phòng"), "기타·온라인");
});

test("digest mail text contains the unsubscribe link", () => {
  const text = buildDigestText([{ title: "A", startDate: "2027-01-01", city: "하노이" }], "https://x.example/u?token=t");
  assert.match(text, /https:\/\/x\.example\/u\?token=t/);
});

test("bookmarks are private to their owner and idempotent", async () => {
  await removeBookmark(U1, "event", 987001);
  await addBookmark(U1, "event", 987001);
  await addBookmark(U1, "event", 987001);
  assert.equal((await listBookmarks(U1, "event")).filter(b => b.itemId === 987001).length, 1);
  assert.equal((await listBookmarks(U2)).length, 0, "other users cannot see it");
  await removeBookmark(U2, "event", 987001); // cannot delete someone else's bookmark
  assert.equal((await listBookmarks(U1, "event")).length, 1);
  await removeBookmark(U1, "event", 987001);
  assert.equal((await listBookmarks(U1, "event")).length, 0);
});

async function withAlerts(run: (base: string) => Promise<void>) {
  const app = express();
  app.use("/api", alertsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  try { await run(`http://127.0.0.1:${addr.port}/api`); }
  finally { await new Promise<void>((res, rej) => server.close(e => e ? rej(e) : res())); }
}

test("unsubscribe token turns weekly mail off; bad tokens are rejected", async () => {
  const pref = await saveAlertPreference(U1, "event", { categories: ["AI"], weeklyEmail: true, email: "a@example.com" });
  assert.ok(pref.unsubscribeToken.length >= 32);
  const again = await saveAlertPreference(U1, "event", { categories: ["AI", "제조"], weeklyEmail: true, email: "a@example.com" });
  assert.equal(again.unsubscribeToken, pref.unsubscribeToken, "token is stable across saves");
  await withAlerts(async base => {
    assert.equal((await fetch(`${base}/alerts/unsubscribe?token=nope`)).status, 400);
    assert.equal((await fetch(`${base}/alerts/unsubscribe`)).status, 400);
    assert.equal((await getAlertPreference(U1, "event"))?.weeklyEmail, true);
    assert.equal((await fetch(`${base}/alerts/unsubscribe?token=${pref.unsubscribeToken}`)).status, 200);
    assert.equal((await getAlertPreference(U1, "event"))?.weeklyEmail, false);
  });
  assert.equal(await unsubscribeByToken(""), false);
});

test("weekly digest: only new events in chosen categories, never retried, 0 events → no mail", async () => {
  const [ev] = await db.insert(eventsTable).values({
    title: TITLE, venue: TITLE, category: "AI", city: "하노이", startDate: "2099-01-01", source: "auto",
  }).returning();
  await db.insert(eventsTable).values({
    title: TITLE + "-제조", venue: TITLE, category: "제조", city: "하노이", startDate: "2099-01-02", source: "auto",
  });
  await saveAlertPreference(U1, "event", { categories: ["AI"], weeklyEmail: true, email: "a@example.com" });
  await saveAlertPreference(U2, "event", { categories: ["물류"], weeklyEmail: true, email: "b@example.com" });
  const mails: { to: string; text: string }[] = [];
  const url = (t: string) => `https://app.example/api/alerts/unsubscribe?token=${t}`;
  const send = async (to: string, _s: string, text: string) => { mails.push({ to, text }); };

  const first = await sendWeeklyEventAlerts(url, send);
  const mine = mails.filter(m => m.to === "a@example.com");
  assert.equal(mine.length, 1);
  assert.ok(mine[0].text.includes(ev.title));
  assert.ok(!mine[0].text.includes(TITLE + "-제조"), "other categories excluded");
  assert.ok(mine[0].text.includes("unsubscribe?token="));
  assert.equal(mails.filter(m => m.to === "b@example.com").length, 0, "no matching events → no mail");
  assert.ok(first.sent >= 1);

  // A second run right away sends nothing (already sent, nothing new).
  const before = mails.length;
  await sendWeeklyEventAlerts(url, send);
  assert.equal(mails.length, before);

  // A failed send is logged but NOT retried: lastSentAt was already claimed.
  await db.update(userAlertPreferencesTable).set({ lastSentAt: new Date(Date.now() - 8 * 86400_000) })
    .where(eq(userAlertPreferencesTable.clerkUserId, U1));
  await db.insert(eventsTable).values({
    title: TITLE + "-새", venue: TITLE, category: "AI", city: "하노이", startDate: "2099-02-01", source: "auto",
  });
  let attempts = 0;
  const failing = async () => { attempts++; throw new Error("boom"); };
  const failRun = await sendWeeklyEventAlerts(url, failing);
  assert.ok(failRun.failed >= 1);
  await sendWeeklyEventAlerts(url, failing);
  assert.equal(attempts, failRun.failed, "no retry on the next run");
});

test("scheduled endpoints require the scheduler token and fail closed when unconfigured", async () => {
  let calls = 0;
  const app = express();
  app.post("/collect", createScheduledEventsCollectHandler(async () => { calls++; return { inserted: 1, skipped: 2, events: [] }; }, () => secret));
  app.post("/alerts", createWeeklyAlertsHandler(async () => { calls++; return { sent: 0, failed: 0, skipped: 0 }; }, () => secret));
  app.post("/unconfigured", createWeeklyAlertsHandler(async () => { calls++; return { sent: 0, failed: 0, skipped: 0 }; }, () => undefined));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    for (const p of ["/collect", "/alerts"]) {
      assert.equal((await fetch(base + p, { method: "POST", headers: { Cookie: "admin_auth=1" } })).status, 401);
      assert.equal((await fetch(base + p, { method: "POST", headers: { Authorization: "Bearer wrong" } })).status, 401);
    }
    assert.equal((await fetch(base + "/unconfigured", { method: "POST" })).status, 503);
    assert.equal(calls, 0);
    const ok = await fetch(base + "/collect", { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { inserted: 1, skipped: 2 });
    assert.equal((await fetch(base + "/alerts", { method: "POST", headers: { Authorization: `Bearer ${secret}` } })).status, 200);
  } finally { await new Promise<void>((res, rej) => server.close(e => e ? rej(e) : res())); }
});

test("alert recipient must be one of the member's verified emails", () => {
  const user = {
    primaryEmailAddressId: "e2",
    emailAddresses: [
      { id: "e1", emailAddress: "work@example.com", verification: { status: "verified" } },
      { id: "e2", emailAddress: "Main@example.com", verification: { status: "verified" } },
      { id: "e3", emailAddress: "pending@example.com", verification: { status: "unverified" } },
      { id: "e4", emailAddress: "none@example.com", verification: null },
    ],
  };
  assert.deepEqual(verifiedEmails(user), ["Main@example.com", "work@example.com"]);
  // default → primary verified
  assert.deepEqual(resolveAlertEmail(user, null), { email: "Main@example.com" });
  // verified address allowed (case-insensitive, returns the stored spelling)
  assert.deepEqual(resolveAlertEmail(user, "WORK@example.com"), { email: "work@example.com" });
  // unverified, no-status and third-party addresses rejected
  assert.equal(resolveAlertEmail(user, "pending@example.com"), "invalid");
  assert.equal(resolveAlertEmail(user, "none@example.com"), "invalid");
  assert.equal(resolveAlertEmail(user, "victim@other.com"), "invalid");
  // no verified email at all → no default
  assert.deepEqual(resolveAlertEmail({ primaryEmailAddressId: null, emailAddresses: [] }, null), { email: null });
});
