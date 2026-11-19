import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, tendersTable, tenderDeadlineRemindersTable, userBookmarksTable, userAlertPreferencesTable,
} from "@workspace/db";
import {
  addDays, buildTenderDigestText, dedupeTenders, deadlineLimit, firstSentence, isValidTenderAlertValue,
  restrictTender, tenderDedupKey, tenderMatchesAlert, viewTender,
} from "../src/lib/tenders";
import { addBookmark, saveAlertPreference, sendWeeklyTenderAlerts } from "../src/lib/userItems";
import { createOfferPriceVisibility } from "../src/middlewares/offerPriceVisibility";
import { createTendersRouter } from "../src/routes/tenders";
import { createScheduledTendersCollectHandler } from "../src/jobs/tendersSchedule";

const U1 = "test-user-tenders-1";
const U2 = "test-user-tenders-2";
const MARK = "TEST-TENDERS";
const secret = "test-only-tenders-scheduler-token-not-a-real-secret";
const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

after(async () => {
  const rows = await db.select({ id: tendersTable.id }).from(tendersTable).where(eq(tendersTable.country, MARK));
  const ids = rows.map(r => r.id);
  if (ids.length) await db.delete(tenderDeadlineRemindersTable).where(inArray(tenderDeadlineRemindersTable.tenderId, ids));
  await db.delete(userBookmarksTable).where(inArray(userBookmarksTable.clerkUserId, [U1, U2]));
  await db.delete(userAlertPreferencesTable).where(inArray(userAlertPreferencesTable.clerkUserId, [U1, U2]));
  await db.delete(tendersTable).where(eq(tendersTable.country, MARK));
  await pool.end();
});

const full = {
  summary: "첫 문장입니다. 두 번째 문장입니다.", budget: "10억 동", eligibility: "제조업 등록", submission: "온라인",
  sourceUrl: "https://example.com/t", title: "공고",
};

test("restrictTender removes restricted fields and keeps only the first summary sentence", () => {
  const r = restrictTender(full) as Record<string, unknown>;
  for (const k of ["budget", "eligibility", "submission", "sourceUrl"]) assert.ok(!(k in r), k);
  assert.equal(r.summary, "첫 문장입니다.");
  assert.equal(r.restricted, true);
  assert.equal(r.title, "공고");
  const m = viewTender(full, true);
  assert.equal(m.restricted, false);
  assert.equal(m.budget, "10억 동");
  assert.equal(firstSentence("한 줄 요약"), "한 줄 요약");
});

test("dedupe key = normalized title + buyer + deadline; filters, matching helpers", () => {
  assert.equal(tenderDedupKey("Smart Factory RFQ!", "KOTRA", "2027-01-01"), tenderDedupKey(" smart  factory rfq", "kotra ", "2027-01-01"));
  assert.notEqual(tenderDedupKey("A", "B", "2027-01-01"), tenderDedupKey("A", "B", "2027-01-02"));
  const { keep, skipped } = dedupeTenders([tenderDedupKey("A", "B", "2027-01-01")], [
    { title: "a", buyer: "b", deadline: "2027-01-01" },
    { title: "C", buyer: null, deadline: "2027-01-01" },
    { title: "c", buyer: null, deadline: "2027-01-01" },
  ]);
  assert.equal(keep.length, 1);
  assert.equal(skipped, 2);
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(deadlineLimit("7", "2026-11-19"), "2026-11-26");
  assert.equal(deadlineLimit("30", "2026-11-19"), "2026-12-19");
  assert.equal(deadlineLimit("all", "2026-11-19"), null);
  assert.ok(isValidTenderAlertValue("gov_vn") && isValidTenderAlertValue("설비") && !isValidTenderAlertValue("행사"));
  assert.ok(tenderMatchesAlert({ sourceType: "gov_vn", category: "설비" }, ["gov_vn"]));
  assert.ok(!tenderMatchesAlert({ sourceType: "gov_vn", category: "설비" }, ["kr_support"]));
  assert.ok(!tenderMatchesAlert({ sourceType: "gov_vn", category: "설비" }, ["gov_vn", "자동화"]));
  assert.match(buildTenderDigestText([], [{ title: "T", deadline: "2027-01-01", sourceType: "gov_vn" }], "https://x/u"), /3일 이내 마감/);
});

async function withApi(
  session: { userId: string | null; sessionId: string | null },
  run: (base: string) => Promise<void>,
) {
  const app = express();
  app.use("/api", createTendersRouter(createOfferPriceVisibility(() => session)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  try { await run(`http://127.0.0.1:${addr.port}/api`); }
  finally { await new Promise<void>((res, rej) => server.close(e => e ? rej(e) : res())); }
}

test("API: anonymous responses drop restricted fields on the server; members get everything; closed/hidden are filtered", async () => {
  const base = { title: MARK, country: MARK, sourceType: "gov_vn", category: "설비", source: "manual" };
  const [open] = await db.insert(tendersTable).values({
    ...base, title: MARK + "-open", summary: "첫 문장. 둘째 문장.", budget: "BUDGET-SECRET", eligibility: "ELIG-SECRET",
    submission: "SUB-SECRET", sourceUrl: "https://example.com/secret", deadline: addDays(today, 5),
  }).returning();
  const [closed] = await db.insert(tendersTable).values({ ...base, title: MARK + "-closed", deadline: addDays(today, -1) }).returning();
  const [hidden] = await db.insert(tendersTable).values({ ...base, title: MARK + "-hidden", deadline: addDays(today, 5), status: "hidden" }).returning();

  await withApi({ userId: null, sessionId: null }, async url => {
    const res = await fetch(`${url}/tenders?isSignedIn=true`, { headers: { Cookie: "admin_auth=1", "X-User-Id": "admin" } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("cache-control") ?? "", /private.*no-store/);
    assert.match(res.headers.get("vary") ?? "", /Cookie/);
    const text = await res.text();
    for (const secretValue of ["BUDGET-SECRET", "ELIG-SECRET", "SUB-SECRET", "example.com/secret", "둘째 문장"]) {
      assert.ok(!text.includes(secretValue), secretValue);
    }
    const list = JSON.parse(text) as { id: number; restricted: boolean; summary: string }[];
    const mine = list.find(t => t.id === open.id);
    assert.ok(mine && mine.restricted === true && mine.summary === "첫 문장.");
    assert.ok(!list.some(t => t.id === closed.id), "closed hidden by default");
    assert.ok(!list.some(t => t.id === hidden.id), "hidden never listed");
    const detail = await (await fetch(`${url}/tenders/${open.id}`)).text();
    assert.ok(!detail.includes("BUDGET-SECRET") && !detail.includes("example.com/secret"));
    assert.equal((await fetch(`${url}/tenders/${hidden.id}`)).status, 404);
    assert.equal((await fetch(`${url}/tenders?deadlineWithin=7`)).status, 200);
  });

  await withApi({ userId: U1, sessionId: "verified" }, async url => {
    const list = await (await fetch(`${url}/tenders?includeClosed=true`)).json() as Record<string, unknown>[];
    const mine = list.find(t => t.id === open.id);
    assert.ok(mine);
    assert.equal(mine.restricted, false);
    assert.equal(mine.budget, "BUDGET-SECRET");
    assert.equal(mine.sourceUrl, "https://example.com/secret");
    assert.ok(list.some(t => t.id === closed.id), "includeClosed shows closed");
    const soon = await (await fetch(`${url}/tenders?deadlineWithin=7&sourceType=kr_support`)).json() as unknown[];
    assert.ok(!soon.some(t => (t as { id: number }).id === open.id), "sourceType filter");
  });
});

test("weekly tender alerts: new tenders in chosen types, deadline-3-days reminder sent exactly once, 0 items → no mail", async () => {
  const base = { country: MARK, source: "auto", category: "자동화", sourceType: "kr_support" };
  const [soon] = await db.insert(tendersTable).values({ ...base, title: MARK + "-soon", deadline: addDays(today, 2) }).returning();
  await db.insert(tendersTable).values({ ...base, title: MARK + "-gov", sourceType: "gov_vn", deadline: addDays(today, 20) });
  await addBookmark(U1, "tender", soon.id);
  await saveAlertPreference(U1, "tender", { categories: ["kr_support"], weeklyEmail: true, email: "a@example.com" });
  await saveAlertPreference(U2, "tender", { categories: ["buyer_rfq"], weeklyEmail: true, email: "b@example.com" });
  const mails: { to: string; text: string }[] = [];
  const send = async (to: string, _s: string, text: string) => { mails.push({ to, text }); };
  const url = (t: string) => `https://app.example/api/alerts/unsubscribe?token=${t}`;

  await sendWeeklyTenderAlerts(url, send);
  const mine = mails.filter(m => m.to === "a@example.com");
  assert.equal(mine.length, 1);
  assert.ok(mine[0].text.includes(MARK + "-soon"));
  assert.ok(!mine[0].text.includes(MARK + "-gov"), "other type excluded");
  assert.ok(mine[0].text.includes("3일 이내 마감"));
  assert.ok(mine[0].text.includes("unsubscribe?token="));
  assert.equal(mails.filter(m => m.to === "b@example.com").length, 0, "no matching items → no mail");

  // Immediate rerun: nothing new and the reminder was already claimed → no mail.
  const before = mails.length;
  await sendWeeklyTenderAlerts(url, send);
  assert.equal(mails.length, before);

  // Even once the weekly cadence has passed (digest may repeat), the reminder is never repeated.
  await db.update(userAlertPreferencesTable).set({ lastSentAt: new Date(Date.now() - 8 * 86400_000) })
    .where(eq(userAlertPreferencesTable.clerkUserId, U1));
  await sendWeeklyTenderAlerts(url, send);
  for (const m of mails.filter(m => m.to === "a@example.com").slice(1)) {
    assert.ok(!m.text.includes("3일 이내 마감"), "reminder sent only once");
  }
  const reminders = await db.select().from(tenderDeadlineRemindersTable).where(eq(tenderDeadlineRemindersTable.clerkUserId, U1));
  assert.equal(reminders.filter(r => r.tenderId === soon.id).length, 1);
});

test("scheduled tenders collection requires the scheduler token and fails closed when unconfigured", async () => {
  let calls = 0;
  const app = express();
  app.post("/collect", createScheduledTendersCollectHandler(async () => { calls++; return { inserted: 1, skipped: 2, tenders: [] }; }, () => secret));
  app.post("/unconfigured", createScheduledTendersCollectHandler(async () => { calls++; return { inserted: 0, skipped: 0, tenders: [] }; }, () => undefined));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    assert.equal((await fetch(base + "/collect", { method: "POST", headers: { Cookie: "admin_auth=1" } })).status, 401);
    assert.equal((await fetch(base + "/collect", { method: "POST", headers: { Authorization: "Bearer wrong" } })).status, 401);
    assert.equal((await fetch(base + "/unconfigured", { method: "POST" })).status, 503);
    assert.equal(calls, 0);
    const ok = await fetch(base + "/collect", { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { inserted: 1, skipped: 2 });
  } finally { await new Promise<void>((res, rej) => server.close(e => e ? rej(e) : res())); }
});
