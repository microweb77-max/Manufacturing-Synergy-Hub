import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, desc } from "drizzle-orm";
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

const router: IRouter = Router();

const RESUME_DATA_URL_RE =
  /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/**
 * Validates an uploaded resume file value. Accepts a PDF / Word / raster image
 * data URL (<= 5MB decoded). Empty string is allowed (no file attached).
 * Never trust the client-only size/type checks.
 */
function validateResumeData(value: string): { value: string } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { value: "" };

  const match = RESUME_DATA_URL_RE.exec(trimmed);
  if (!match) {
    return {
      error:
        "유효하지 않은 이력서 파일입니다. PDF, Word 또는 이미지(PNG, JPG, WEBP) 파일을 업로드해주세요.",
    };
  }

  const base64 = match[match.length - 1];
  const decodedBytes =
    Math.floor((base64.length * 3) / 4) -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (decodedBytes > MAX_RESUME_BYTES) {
    return { error: "이력서 파일은 5MB 이하여야 합니다." };
  }

  return { value: trimmed };
}

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
    .select(selectShape)
    .from(resumeSubmissionsTable)
    .leftJoin(
      talentPostsTable,
      eq(resumeSubmissionsTable.talentPostId, talentPostsTable.id),
    )
    .where(where)
    .orderBy(desc(resumeSubmissionsTable.createdAt));

  res.json(ListResumeSubmissionsResponse.parse(toJson(rows.map(shape))));
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
