import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
import { db, talentContactRequestsTable, talentPostsTable } from "@workspace/db";
import {
  ListTalentContactRequestsResponse,
  CreateTalentContactRequestBody,
  CreateTalentContactRequestResponse,
  UpdateTalentContactRequestParams,
  UpdateTalentContactRequestBody,
  UpdateTalentContactRequestResponse,
  DeleteTalentContactRequestParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectShape = {
  id: talentContactRequestsTable.id,
  talentPostId: talentContactRequestsTable.talentPostId,
  seekerName: talentPostsTable.authorName,
  postTitle: talentPostsTable.title,
  companyName: talentContactRequestsTable.companyName,
  contactPerson: talentContactRequestsTable.contactPerson,
  phone: talentContactRequestsTable.phone,
  email: talentContactRequestsTable.email,
  status: talentContactRequestsTable.status,
  createdAt: talentContactRequestsTable.createdAt,
};

type RawRow = {
  seekerName: string | null;
  postTitle: string | null;
  [k: string]: unknown;
};

function shape(r: RawRow) {
  return {
    ...r,
    seekerName: r.seekerName ?? "",
    postTitle: r.postTitle ?? "",
  };
}

router.get("/talent-contact-requests", async (req, res): Promise<void> => {
  const rows = await db
    .select(selectShape)
    .from(talentContactRequestsTable)
    .leftJoin(
      talentPostsTable,
      eq(talentContactRequestsTable.talentPostId, talentPostsTable.id),
    )
    .orderBy(desc(talentContactRequestsTable.createdAt));

  res.json(ListTalentContactRequestsResponse.parse(toJson(rows.map(shape))));
});

router.post("/talent-contact-requests", async (req, res): Promise<void> => {
  const parsed = CreateTalentContactRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  const [post] = await db
    .select()
    .from(talentPostsTable)
    .where(eq(talentPostsTable.id, data.talentPostId));
  if (!post) {
    res.status(404).json({ error: "Talent post not found" });
    return;
  }
  if (post.postType !== "seeking") {
    res.status(400).json({ error: "연락 요청은 구직 게시글에만 할 수 있습니다." });
    return;
  }

  const [inserted] = await db
    .insert(talentContactRequestsTable)
    .values({
      talentPostId: data.talentPostId,
      companyName: data.companyName,
      contactPerson: data.contactPerson,
      phone: data.phone ?? "",
      email: data.email ?? "",
    })
    .returning();

  const [row] = await db
    .select(selectShape)
    .from(talentContactRequestsTable)
    .leftJoin(
      talentPostsTable,
      eq(talentContactRequestsTable.talentPostId, talentPostsTable.id),
    )
    .where(eq(talentContactRequestsTable.id, inserted.id));

  res.status(201).json(CreateTalentContactRequestResponse.parse(toJson(shape(row))));
});

router.patch("/talent-contact-requests/:id", async (req, res): Promise<void> => {
  const params = UpdateTalentContactRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTalentContactRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(talentContactRequestsTable)
    .where(eq(talentContactRequestsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Contact request not found" });
    return;
  }

  await db
    .update(talentContactRequestsTable)
    .set(parsed.data)
    .where(eq(talentContactRequestsTable.id, params.data.id));

  const [row] = await db
    .select(selectShape)
    .from(talentContactRequestsTable)
    .leftJoin(
      talentPostsTable,
      eq(talentContactRequestsTable.talentPostId, talentPostsTable.id),
    )
    .where(eq(talentContactRequestsTable.id, params.data.id));

  res.json(UpdateTalentContactRequestResponse.parse(toJson(shape(row))));
});

router.delete("/talent-contact-requests/:id", async (req, res): Promise<void> => {
  const params = DeleteTalentContactRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(talentContactRequestsTable)
    .where(eq(talentContactRequestsTable.id, params.data.id));

  res.status(204).send();
});

export default router;
