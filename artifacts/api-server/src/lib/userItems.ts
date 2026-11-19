import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db, eventsTable, userBookmarksTable, userAlertPreferencesTable } from "@workspace/db";
import { buildDigestText } from "./events";
import { sendDigestMail } from "./membershipMail";
import { logger } from "./logger";

export type ItemType = "event" | "tender";

const EMAIL_RE = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
export const isValidEmail = (v: string) => EMAIL_RE.test(v);

// ---------- Bookmarks: every query is scoped to the caller's own clerkUserId ----------

export async function listBookmarks(userId: string, itemType?: ItemType) {
  return db.select().from(userBookmarksTable)
    .where(itemType
      ? and(eq(userBookmarksTable.clerkUserId, userId), eq(userBookmarksTable.itemType, itemType))
      : eq(userBookmarksTable.clerkUserId, userId))
    .orderBy(userBookmarksTable.createdAt);
}

export async function addBookmark(userId: string, itemType: ItemType, itemId: number) {
  await db.insert(userBookmarksTable)
    .values({ clerkUserId: userId, itemType, itemId })
    .onConflictDoNothing();
  const [row] = await db.select().from(userBookmarksTable).where(and(
    eq(userBookmarksTable.clerkUserId, userId),
    eq(userBookmarksTable.itemType, itemType),
    eq(userBookmarksTable.itemId, itemId),
  ));
  return row;
}

export async function removeBookmark(userId: string, itemType: ItemType, itemId: number) {
  await db.delete(userBookmarksTable).where(and(
    eq(userBookmarksTable.clerkUserId, userId),
    eq(userBookmarksTable.itemType, itemType),
    eq(userBookmarksTable.itemId, itemId),
  ));
}

// ---------- Alert preferences ----------

export function newUnsubscribeToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getAlertPreference(userId: string, itemType: ItemType) {
  const [row] = await db.select().from(userAlertPreferencesTable).where(and(
    eq(userAlertPreferencesTable.clerkUserId, userId),
    eq(userAlertPreferencesTable.itemType, itemType),
  ));
  return row ?? null;
}

export async function saveAlertPreference(
  userId: string,
  itemType: ItemType,
  input: { categories: string[]; weeklyEmail: boolean; email: string | null },
) {
  const [row] = await db.insert(userAlertPreferencesTable)
    .values({ clerkUserId: userId, itemType, ...input, unsubscribeToken: newUnsubscribeToken() })
    .onConflictDoUpdate({
      target: [userAlertPreferencesTable.clerkUserId, userAlertPreferencesTable.itemType],
      // The unsubscribe token stays stable so links in old mails keep working.
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/** Turns weekly mail off for the token's owner. Returns false for an unknown token. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const rows = await db.update(userAlertPreferencesTable)
    .set({ weeklyEmail: false, updatedAt: new Date() })
    .where(eq(userAlertPreferencesTable.unsubscribeToken, token))
    .returning({ id: userAlertPreferencesTable.clerkUserId });
  return rows.length > 0;
}

// ---------- Weekly digest ----------

const MIN_RESEND_MS = 6 * 24 * 60 * 60 * 1000;
const FIRST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function sendWeeklyEventAlerts(
  unsubscribeUrlFor: (token: string) => string,
  send: (to: string, subject: string, text: string) => Promise<void> = sendDigestMail,
  now = new Date(),
) {
  const prefs = await db.select().from(userAlertPreferencesTable).where(and(
    eq(userAlertPreferencesTable.itemType, "event"),
    eq(userAlertPreferencesTable.weeklyEmail, true),
  ));
  const today = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  let sent = 0, failed = 0, skipped = 0;
  for (const pref of prefs) {
    const since = pref.lastSentAt ?? new Date(now.getTime() - FIRST_WINDOW_MS);
    if (!pref.email || !isValidEmail(pref.email) || !pref.categories.length
      || (pref.lastSentAt && now.getTime() - pref.lastSentAt.getTime() < MIN_RESEND_MS)) {
      skipped += 1;
      continue;
    }
    const fresh = await db.select().from(eventsTable).where(and(
      eq(eventsTable.status, "published"),
      inArray(eventsTable.category, pref.categories),
      gt(eventsTable.createdAt, since),
      sql`${eventsTable.startDate} >= ${today}`,
    )).orderBy(eventsTable.startDate);
    if (!fresh.length) {
      skipped += 1; // 0 new events → no mail
      continue;
    }
    // Claim the send BEFORE mailing, and only if nobody else did meanwhile.
    // A failed send is therefore never retried (a lost response may have delivered it).
    const claimed = await db.update(userAlertPreferencesTable)
      .set({ lastSentAt: now })
      .where(and(
        eq(userAlertPreferencesTable.clerkUserId, pref.clerkUserId),
        eq(userAlertPreferencesTable.itemType, pref.itemType),
        pref.lastSentAt ? eq(userAlertPreferencesTable.lastSentAt, pref.lastSentAt) : isNull(userAlertPreferencesTable.lastSentAt),
      ))
      .returning({ id: userAlertPreferencesTable.clerkUserId });
    if (!claimed.length) {
      skipped += 1;
      continue;
    }
    try {
      await send(
        pref.email,
        `[제조업 시너지 허브] 새 행사 ${fresh.length}건 알림`,
        buildDigestText(fresh, unsubscribeUrlFor(pref.unsubscribeToken)),
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, userId: pref.clerkUserId }, "Weekly alert mail failed (not retried)");
    }
  }
  return { sent, failed, skipped };
}

