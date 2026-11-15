import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { asc, eq } from "drizzle-orm";
import { db, bannersTable } from "@workspace/db";
import {
  ListBannersResponse,
  CreateBannerBody,
  CreateBannerResponse,
  UpdateBannerParams,
  UpdateBannerBody,
  UpdateBannerResponse,
  DeleteBannerParams,
} from "@workspace/api-zod";

import { isMediaUrl } from "../lib/media";

const router: IRouter = Router();

const IMAGE_DATA_URL_RE =
  /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function validateImageUrl(value: string): { value: string } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") {
    return { error: "배너 이미지를 입력해주세요." };
  }

  const dataMatch = IMAGE_DATA_URL_RE.exec(trimmed);
  if (dataMatch) {
    const base64 = dataMatch[2];
    const decodedBytes =
      Math.floor((base64.length * 3) / 4) -
      (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (decodedBytes > MAX_IMAGE_BYTES) {
      return { error: "배너 이미지는 2MB 이하여야 합니다." };
    }
    return { value: trimmed };
  }

  if (/^https:\/\/\S+$/.test(trimmed)) {
    return { value: trimmed };
  }

  return {
    error:
      "유효하지 않은 배너 이미지입니다. 이미지(PNG, JPG, WEBP, GIF) 파일을 업로드하거나 https URL을 입력해주세요.",
  };
}

router.get("/banners", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(bannersTable)
    .orderBy(asc(bannersTable.displayOrder), asc(bannersTable.id));

  res.json(ListBannersResponse.parse(toJson(rows)));
});

router.post("/banners", async (req, res): Promise<void> => {
  const parsed = CreateBannerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const imageResult = validateImageUrl(parsed.data.imageUrl);
  if ("error" in imageResult) {
    res.status(400).json({ error: imageResult.error });
    return;
  }

  const [banner] = await db
    .insert(bannersTable)
    .values({
      title: parsed.data.title ?? "",
      imageUrl: imageResult.value,
      linkUrl: parsed.data.linkUrl ?? null,
      durationSeconds: parsed.data.durationSeconds ?? 5,
      displayOrder: parsed.data.displayOrder ?? 0,
      active: parsed.data.active ?? true,
    })
    .returning();

  res.status(201).json(CreateBannerResponse.parse(toJson(banner)));
});

router.patch("/banners/:id", async (req, res): Promise<void> => {
  const params = UpdateBannerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBannerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.imageUrl !== undefined && !isMediaUrl(parsed.data.imageUrl)) {
    const imageResult = validateImageUrl(parsed.data.imageUrl);
    if ("error" in imageResult) {
      res.status(400).json({ error: imageResult.error });
      return;
    }
    updates.imageUrl = imageResult.value;
  }
  if (parsed.data.linkUrl !== undefined) updates.linkUrl = parsed.data.linkUrl;
  if (parsed.data.durationSeconds !== undefined)
    updates.durationSeconds = parsed.data.durationSeconds;
  if (parsed.data.displayOrder !== undefined)
    updates.displayOrder = parsed.data.displayOrder;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  const [banner] = await db
    .update(bannersTable)
    .set(updates)
    .where(eq(bannersTable.id, params.data.id))
    .returning();

  res.json(UpdateBannerResponse.parse(toJson(banner)));
});

router.delete("/banners/:id", async (req, res): Promise<void> => {
  const params = DeleteBannerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }

  await db.delete(bannersTable).where(eq(bannersTable.id, params.data.id));

  res.status(204).end();
});

export default router;
