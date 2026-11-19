import { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, eventsTable, tendersTable } from "@workspace/db";
import {
  ListMyBookmarksQueryParams,
  AddMyBookmarkBody,
  RemoveMyBookmarkQueryParams,
  GetMyAlertPreferencesQueryParams,
  PutMyAlertPreferencesBody,
} from "@workspace/api-zod";
import { toJson } from "../lib/serialize";
import {
  listBookmarks, addBookmark, removeBookmark,
  getAlertPreference, saveAlertPreference, isValidEmail, verifiedEmails, resolveAlertEmail,
} from "../lib/userItems";
import { EVENT_CATEGORIES } from "../lib/events";
import { isValidTenderAlertValue } from "../lib/tenders";
import type { Identity } from "../middlewares/apiAuthorization";

// Everything here is "my own data": the access policy lives in apiAuthorization.ts
// (any signed-in member) and every query is scoped to identity.userId.
const router: IRouter = Router();

function me(res: Response): Identity {
  return res.locals.identity as Identity;
}

router.get("/me/bookmarks", async (req: Request, res: Response): Promise<void> => {
  const q = ListMyBookmarksQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  res.json(toJson(await listBookmarks(me(res).userId, q.data.itemType)));
});

router.post("/me/bookmarks", async (req: Request, res: Response): Promise<void> => {
  const body = AddMyBookmarkBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (body.data.itemType === "event") {
    const [ev] = await db.select({ id: eventsTable.id }).from(eventsTable)
      .where(eq(eventsTable.id, body.data.itemId));
    if (!ev) { res.status(404).json({ error: "행사를 찾을 수 없습니다." }); return; }
  }
  if (body.data.itemType === "tender") {
    // Hidden tenders can't be bookmarked either (members never see them).
    const [t] = await db.select({ id: tendersTable.id }).from(tendersTable)
      .where(and(eq(tendersTable.id, body.data.itemId), eq(tendersTable.status, "published")));
    if (!t) { res.status(404).json({ error: "공고를 찾을 수 없습니다." }); return; }
  }
  res.json(toJson(await addBookmark(me(res).userId, body.data.itemType, body.data.itemId)));
});

router.delete("/me/bookmarks", async (req: Request, res: Response): Promise<void> => {
  const q = RemoveMyBookmarkQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  await removeBookmark(me(res).userId, q.data.itemType, q.data.itemId);
  res.status(204).end();
});

router.get("/me/alert-preferences", async (req: Request, res: Response): Promise<void> => {
  const q = GetMyAlertPreferencesQueryParams.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  const pref = await getAlertPreference(me(res).userId, q.data.itemType);
  const availableEmails = await clerkClient.users.getUser(me(res).userId)
    .then(verifiedEmails).catch(() => [] as string[]);
  res.json(toJson({
    itemType: q.data.itemType,
    categories: pref?.categories ?? [],
    weeklyEmail: pref?.weeklyEmail ?? false,
    email: pref?.email ?? null,
    availableEmails,
    lastSentAt: pref?.lastSentAt ?? null,
  }));
});

router.put("/me/alert-preferences", async (req: Request, res: Response): Promise<void> => {
  const body = PutMyAlertPreferencesBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const { itemType, weeklyEmail } = body.data;
  const categories = [...new Set(body.data.categories.map((c) => c.trim()).filter(Boolean))];
  if (itemType === "event" && categories.some((c) => !(EVENT_CATEGORIES as readonly string[]).includes(c))) {
    res.status(400).json({ error: "유효하지 않은 분야입니다." });
    return;
  }
  if (itemType === "tender" && categories.some((c) => !isValidTenderAlertValue(c))) {
    res.status(400).json({ error: "유효하지 않은 유형 또는 분야입니다." });
    return;
  }
  const requested = body.data.email?.trim() || null;
  if (requested && !isValidEmail(requested)) { res.status(400).json({ error: "이메일 형식이 올바르지 않습니다." }); return; }
  let email: string | null = null;
  if (weeklyEmail || requested) {
    let user;
    try {
      user = await clerkClient.users.getUser(me(res).userId);
    } catch {
      res.status(502).json({ error: "계정 이메일을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." });
      return;
    }
    const resolved = resolveAlertEmail(user, requested);
    if (resolved === "invalid") {
      res.status(400).json({ error: "계정에 등록·인증된 이메일만 사용할 수 있습니다." });
      return;
    }
    email = resolved.email;
    if (weeklyEmail && !email) {
      res.status(400).json({ error: "인증된 이메일이 없어 알림을 켤 수 없습니다." });
      return;
    }
  }
  const row = await saveAlertPreference(me(res).userId, itemType, { categories, weeklyEmail, email });
  res.json(toJson({
    itemType: row.itemType, categories: row.categories, weeklyEmail: row.weeklyEmail,
    email: row.email, lastSentAt: row.lastSentAt,
  }));
});

export default router;
