import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, resumeSubmissionsTable, talentPostsTable } from "@workspace/db";
import {
  ListResumeSubmissionsQueryParams,
  ListResumeSubmissionsResponse,
  CreateResumeSubmissionBody,
  CreateResumeSubmissionResponse,
  UpdateResumeSubmissionParams,
  UpdateResumeSubmissionBody,
  UpdateResumeSubmissionResponse,
  DeleteResumeSubmissionParams,
} from "@workspace/api-zod";

import { sendDataUrl } from "../lib/media";
import { validateResumeData } from "../lib/validation";

const router: IRouter = Router();

const selectShape = {
  id: resumeSubmissionsTable.id,
  talentPostId: resumeSubmissionsTable.talentPostId,
  jobTitle: talentPostsTable.title,
  jobAuthorName: talentPostsTable.authorName,
  applicantName: resumeSubmissionsTable.applicantName,
  contactEmail: resumeSubmissionsTable.contactEmail,
  contactPhone: resumeSubmissionsTable.contactPhone,
  message: resumeSubmissionsTable.message,
  resumeFileName: resumeSubmissionsTable.resumeFileName,
  resumeFileData: resumeSubmissionsTable.resumeFileData,
  status: resumeSubmissionsTable.status,
  adminNote: resumeSubmissionsTable.adminNote,
  createdAt: resumeSubmissionsTable.createdAt,
};

type RawRow = {
  jobTitle: string | null;
  jobAuthorName: string | null;
  [k: string]: unknown;
};

function shape(r: RawRow) {
  return {
    ...r,
    jobTitle: r.jobTitle ?? "",
    jobAuthorName: r.jobAuthorName ?? "",
  };
}

router.get("/resume-submissions", async (req, res): Promise<void> => {
  const query = ListResumeSubmissionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const where: SQL | undefined = query.data.talentPostId
    ? eq(resumeSubmissionsTable.talentPostId, query.data.talentPostId)
    : undefined;

  const rows = await db
    .select({
      ...selectShape,
      // Only fetch whether a file exists, not the (large) file itself.
      resumeFileData: sql<string>`case when ${resumeSubmissionsTable.resumeFileData} <> '' then '1' else '' end`,
    })
    .from(resumeSubmissionsTable)
    .leftJoin(
      talentPostsTable,
      eq(resumeSubmissionsTable.talentPostId, talentPostsTable.id),
    )
    .where(where)
    .orderBy(desc(resumeSubmissionsTable.createdAt));

  // Don't ship whole files in the list; link to the download endpoint instead.
  const listed = rows.map((r) => ({
    ...shape(r),
    resumeFileData: r.resumeFileData ? `/api/resume-submissions/${r.id}/file` : "",
  }));
  res.json(ListResumeSubmissionsResponse.parse(toJson(listed)));
});

/** Admin-only (see ADMIN_READS in lib/auth.ts): download a resume file. */
router.get("/resume-submissions/:id/file", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "잘못된 ID입니다." });
    return;
  }
  const [row] = await db
    .select({
      data: resumeSubmissionsTable.resumeFileData,
      name: resumeSubmissionsTable.resumeFileName,
    })
    .from(resumeSubmissionsTable)
    .where(eq(resumeSubmissionsTable.id, id));
  if (!row || !sendDataUrl(res, row.data, { downloadName: row.name || `resume-${id}` })) {
    res.status(404).json({ error: "파일이 없습니다." });
  }
});

router.post("/resume-submissions", async (req, res): Promise<void> => {
  const parsed = CreateResumeSubmissionBody.safeParse(req.body);
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
  if (post.postType !== "hiring") {
    res
      .status(400)
      .json({ error: "이력서는 구인 공고에만 접수할 수 있습니다." });
    return;
  }

  const resumeResult = validateResumeData(data.resumeFileData ?? "");
  if ("error" in resumeResult) {
    res.status(400).json({ error: resumeResult.error });
    return;
  }

  const [inserted] = await db
    .insert(resumeSubmissionsTable)
    .values({
      talentPostId: data.talentPostId,
      applicantName: data.applicantName,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      message: data.message ?? "",
      resumeFileName: data.resumeFileName ?? "",
      resumeFileData: resumeResult.value,
    })
    .returning();

  const [row] = await db
    .select(selectShape)
    .from(resumeSubmissionsTable)
    .leftJoin(
      talentPostsTable,
      eq(resumeSubmissionsTable.talentPostId, talentPostsTable.id),
    )
    .where(eq(resumeSubmissionsTable.id, inserted.id));

  res
    .status(201)
    .json(CreateResumeSubmissionResponse.parse(toJson(shape(row))));
});

router.patch("/resume-submissions/:id", async (req, res): Promise<void> => {
  const params = UpdateResumeSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateResumeSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(resumeSubmissionsTable)
    .where(eq(resumeSubmissionsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Resume submission not found" });
    return;
  }

  await db
    .update(resumeSubmissionsTable)
    .set(parsed.data)
    .where(eq(resumeSubmissionsTable.id, params.data.id));

  const [row] = await db
    .select(selectShape)
    .from(resumeSubmissionsTable)
    .leftJoin(
      talentPostsTable,
      eq(resumeSubmissionsTable.talentPostId, talentPostsTable.id),
    )
    .where(eq(resumeSubmissionsTable.id, params.data.id));

  res.json(UpdateResumeSubmissionResponse.parse(toJson(shape(row))));
});

router.delete("/resume-submissions/:id", async (req, res): Promise<void> => {
  const params = DeleteResumeSubmissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(resumeSubmissionsTable)
    .where(eq(resumeSubmissionsTable.id, params.data.id));

  res.status(204).send();
});

export default router;
