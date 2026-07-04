import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq } from "drizzle-orm";
import { db, navSettingsTable } from "@workspace/db";
import {
  ListNavSettingsResponse,
  UpsertNavSettingParams,
  UpsertNavSettingBody,
  UpsertNavSettingResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_NAV_KEYS = new Set([
  "dashboard",
  "companies",
  "client-companies",
  "offers",
  "projects",
  "matches",
  "solutions",
  "talent",
]);

router.get("/nav-settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(navSettingsTable);
  res.json(ListNavSettingsResponse.parse(toJson(rows)));
});

router.put("/nav-settings/:key", async (req, res): Promise<void> => {
  const params = UpsertNavSettingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!VALID_NAV_KEYS.has(params.data.key)) {
    res.status(400).json({ error: "유효하지 않은 메뉴 키입니다." });
    return;
  }

  const parsed = UpsertNavSettingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(navSettingsTable)
    .values({ key: params.data.key, hidden: parsed.data.hidden })
    .onConflictDoUpdate({
      target: navSettingsTable.key,
      set: { hidden: parsed.data.hidden, updatedAt: new Date() },
    })
    .returning();

  res.json(UpsertNavSettingResponse.parse(toJson(row)));
});

export default router;
