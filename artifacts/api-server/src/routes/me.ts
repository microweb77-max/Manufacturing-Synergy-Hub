import { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
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
  getAlertPreference, saveAlertPreference, isValidEmail,
} from "../lib/userItems";
import { EVENT_CATEGORIES } from "../lib/events";
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
  res.json(toJson({
    itemType: q.data.itemType,
    categories: pref?.categories ?? [],
    weeklyEmail: pref?.weeklyEmail ?? false,
    email: pref?.email ?? null,
    lastSentAt: pref?.lastSentAt ?? null,
  }));
});

async function primaryEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
    ?? user.emailAddresses[0];
  return primary?.emailAddress ?? null;
}

router.put("/me/alert-preferences", async (req: Request, res: Response): Promise<void> => {
  const body = PutMyAlertPreferencesBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const { itemType, weeklyEmail } = body.data;
  const categories = [...new Set(body.data.categories.map((c) => c.trim()).filter(Boolean))];
  if (itemType === "event" && categories.some((c) => !(EVENT_CATEGORIES as readonly string[]).includes(c))) {
    res.status(400).json({ error: "유효하지 않은 분야입니다." });
    return;
  }
  let email = body.data.email?.trim() || null;
  if (email && !isValidEmail(email)) { res.status(400).json({ error: "이메일 형식이 올바르지 않습니다." }); return; }
  if (weeklyEmail && !email) {
    email = await primaryEmail(me(res).userId).catch(() => null);
    if (!email) { res.status(400).json({ error: "알림을 받을 이메일을 입력해 주세요." }); return; }
  }
  const row = await saveAlertPreference(me(res).userId, itemType, { categories, weeklyEmail, email });
  res.json(toJson({
    itemType: row.itemType, categories: row.categories, weeklyEmail: row.weeklyEmail,
    email: row.email, lastSentAt: row.lastSentAt,
  }));
});

export default router;
