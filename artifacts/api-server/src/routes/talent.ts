import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import { db, talentPostsTable } from "@workspace/db";
import {
  ListTalentPostsQueryParams,
  ListTalentPostsResponse,
  CreateTalentPostBody,
  CreateTalentPostResponse,
  DeleteTalentPostParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/talent", async (req, res): Promise<void> => {
  const query = ListTalentPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(talentPostsTable)
    .where(
      query.data.postType !== undefined
        ? eq(talentPostsTable.postType, query.data.postType)
        : undefined,
    )
    .orderBy(desc(talentPostsTable.createdAt));

  res.json(ListTalentPostsResponse.parse(toJson(rows)));
});

router.post("/talent", async (req, res): Promise<void> => {
  const parsed = CreateTalentPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [post] = await db
    .insert(talentPostsTable)
    .values({
      postType: data.postType,
      title: data.title,
      authorName: data.authorName,
      position: data.position ?? "",
      location: data.location ?? "",
      employmentType: data.employmentType ?? null,
      experienceLevel: data.experienceLevel ?? null,
      headcount: data.headcount ?? null,
      skills: data.skills ?? [],
      description: data.description ?? "",
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
    })
    .returning();

  res.status(201).json(CreateTalentPostResponse.parse(toJson(post)));
});

router.delete("/talent/:id", async (req, res): Promise<void> => {
  const params = DeleteTalentPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(talentPostsTable)
    .where(eq(talentPostsTable.id, params.data.id));

  res.status(204).send();
});

export default router;
