import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { eq, and, desc } from "drizzle-orm";
import { db, talentPostsTable } from "@workspace/db";
import {
  ListTalentPostsQueryParams,
  ListTalentPostsResponse,
  CreateTalentPostBody,
  CreateTalentPostResponse,
  UpdateTalentPostParams,
  UpdateTalentPostBody,
  UpdateTalentPostResponse,
  DeleteTalentPostParams,
  CollectJobsBody,
  CollectJobsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type CollectedJob = {
  title: string;
  authorName: string;
  position: string;
  location: string;
  employmentType: string | null;
  experienceLevel: string | null;
  skills: string[];
  description: string;
  sourceUrl: string | null;
};

const COLLECT_COOLDOWN_MS = 30_000;
const lastCollectAt: Record<"hiring" | "seeking", number> = {
  hiring: 0,
  seeking: 0,
};
let collectInProgress = false;

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in model output");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

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

router.patch("/talent/:id", async (req, res): Promise<void> => {
  const params = UpdateTalentPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTalentPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(talentPostsTable)
    .where(eq(talentPostsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Talent post not found" });
    return;
  }

  const [post] = await db
    .update(talentPostsTable)
    .set(parsed.data)
    .where(eq(talentPostsTable.id, params.data.id))
    .returning();

  res.json(UpdateTalentPostResponse.parse(toJson(post)));
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

router.post("/talent/collect-jobs", async (req, res): Promise<void> => {
  const parsed = CollectJobsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const region = (parsed.data.region ?? "").trim();
  const postType = parsed.data.postType ?? "hiring";
  const focus = region
    ? `특히 "${region}" 지역/분야에 집중해서 찾아줘.`
    : "호치민, 하노이, 박닌, 빈증, 동나이 등 주요 산업단지를 폭넓게 포함해줘.";

  if (collectInProgress) {
    res
      .status(429)
      .json({ error: "이미 수집이 진행 중입니다. 잠시 후 다시 시도해주세요." });
    return;
  }
  const sinceLast = Date.now() - lastCollectAt[postType];
  if (sinceLast < COLLECT_COOLDOWN_MS) {
    const waitSec = Math.ceil((COLLECT_COOLDOWN_MS - sinceLast) / 1000);
    res.status(429).json({
      error: `잠시 후 다시 시도해주세요. (${waitSec}초 후 가능)`,
    });
    return;
  }
  collectInProgress = true;
  lastCollectAt[postType] = Date.now();

  try {
    const { ai } = await import("@workspace/integrations-gemini-ai");

    const searchPrompt =
      postType === "seeking"
        ? `베트남 내 제조업(공장, 설비, 자동화, 금형, 전자, 생산관리, 품질, 물류 등) 분야에서 일자리를 찾고 있는 구직자/인재 프로필 또는 이력 정보를 웹에서 검색해서 8건 정리해줘. ${focus}
각 구직자마다 다음을 포함해줘: 구직자 이름 또는 식별명, 희망 직무, 희망 근무 지역, 보유 경력 수준, 본인 소개/경력 요약, 보유 기술/역량.
실제 구직 활동 중인 사람 위주로, 제조업과 무관한 프로필은 제외해줘.`
        : `베트남 내 제조업(공장, 설비, 자동화, 금형, 전자, 생산관리, 품질, 물류 등) 관련 최신 채용/구인 공고를 웹에서 검색해서 8건 정리해줘. ${focus}
각 공고마다 다음을 포함해줘: 채용 회사명, 모집 직무, 근무 지역, 고용 형태(정규직/계약직 등), 요구 경력, 주요 업무/자격요건 요약, 필요 기술/역량.
실제 채용 중인 공고 위주로, 제조업과 무관한 공고는 제외해줘.`;

    const searchResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: { tools: [{ googleSearch: {} }] },
    });

    const searchText = searchResp.text ?? "";
    if (!searchText.trim()) {
      res.status(502).json({ error: "검색 결과를 가져오지 못했습니다." });
      return;
    }

    const chunks =
      searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((c) => ({ title: toStr(c.web?.title), uri: c.web?.uri ?? "" }))
      .filter((s) => s.uri.length > 0);
    const allowedUrls = new Set(sources.map((s) => s.uri));
    const fallbackUrl = sources[0]?.uri ?? null;

    const sourceList = sources
      .map((s, i) => `${i + 1}. ${s.title || "(제목 없음)"} => ${s.uri}`)
      .join("\n");

    const structurePrompt =
      postType === "seeking"
        ? `아래 텍스트는 베트남 제조업 분야 구직자(일자리를 찾는 사람) 정보야. 이를 JSON 배열로 변환해줘.
각 원소는 다음 키를 가진 객체야:
- "title": 구직 게시물 제목 (한국어, 예: "생산관리 경력 7년 - 박닌 지역 구직")
- "authorName": 구직자 이름 또는 식별명
- "position": 희망 직무
- "location": 희망 근무 지역
- "employmentType": 희망 고용 형태 (없으면 "")
- "experienceLevel": 보유 경력 수준 (없으면 "")
- "skills": 보유 기술/역량 문자열 배열 (없으면 [])
- "description": 본인 소개 및 경력 요약 (한국어 2~4문장)
- "sourceUrl": 아래 [출처 목록]에서 이 구직자와 가장 관련된 URL을 그대로 선택해서 넣어줘. 관련 출처가 없으면 ""로 둬. 목록에 없는 URL은 절대 만들지 마.
모든 텍스트 값은 한국어로 작성해줘. JSON 배열만 출력하고 다른 설명은 절대 붙이지 마.

[출처 목록]
${sourceList || "(없음)"}

[원본 텍스트]
${searchText}`
        : `아래 텍스트는 베트남 제조업 채용 공고 정보야. 이를 JSON 배열로 변환해줘.
각 원소는 다음 키를 가진 객체야:
- "title": 공고 제목 (한국어, 예: "삼성전자 베트남 - 생산관리 경력직 채용")
- "authorName": 채용 회사명
- "position": 모집 직무
- "location": 근무 지역
- "employmentType": 고용 형태 (없으면 "")
- "experienceLevel": 요구 경력 (없으면 "")
- "skills": 필요 기술/역량 문자열 배열 (없으면 [])
- "description": 주요 업무 및 자격요건 요약 (한국어 2~4문장)
- "sourceUrl": 아래 [출처 목록]에서 이 공고와 가장 관련된 URL을 그대로 선택해서 넣어줘. 관련 출처가 없으면 ""로 둬. 목록에 없는 URL은 절대 만들지 마.
모든 텍스트 값은 한국어로 작성해줘. JSON 배열만 출력하고 다른 설명은 절대 붙이지 마.

[출처 목록]
${sourceList || "(없음)"}

[원본 텍스트]
${searchText}`;

    const structureResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: structurePrompt }] }],
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    });

    const arr = extractJsonArray(structureResp.text ?? "");
    if (!Array.isArray(arr)) {
      res.status(502).json({ error: "공고 데이터를 해석하지 못했습니다." });
      return;
    }

    const jobs: CollectedJob[] = arr
      .map((item): CollectedJob | null => {
        if (typeof item !== "object" || item === null) return null;
        const o = item as Record<string, unknown>;
        const title = toStr(o.title);
        const authorName = toStr(o.authorName);
        if (!title || !authorName) return null;
        const skills = Array.isArray(o.skills)
          ? o.skills.map(toStr).filter((s) => s.length > 0)
          : [];
        const employmentType = toStr(o.employmentType);
        const experienceLevel = toStr(o.experienceLevel);
        const picked = toStr(o.sourceUrl);
        const sourceUrl = allowedUrls.has(picked) ? picked : fallbackUrl;
        return {
          title,
          authorName,
          position: toStr(o.position),
          location: toStr(o.location),
          employmentType: employmentType || null,
          experienceLevel: experienceLevel || null,
          skills,
          description: toStr(o.description),
          sourceUrl,
        };
      })
      .filter((j): j is CollectedJob => j !== null);

    const existing = await db
      .select({
        title: talentPostsTable.title,
        authorName: talentPostsTable.authorName,
      })
      .from(talentPostsTable)
      .where(eq(talentPostsTable.postType, postType));

    const seen = new Set(
      existing.map((e) => `${e.title}__${e.authorName}`.toLowerCase()),
    );

    const toInsert: CollectedJob[] = [];
    let skipped = 0;
    for (const job of jobs) {
      const key = `${job.title}__${job.authorName}`.toLowerCase();
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      toInsert.push(job);
    }

    const inserted =
      toInsert.length > 0
        ? await db
            .insert(talentPostsTable)
            .values(
              toInsert.map((job) => ({
                postType,
                title: job.title,
                authorName: job.authorName,
                position: job.position,
                location: job.location,
                employmentType: job.employmentType,
                experienceLevel: job.experienceLevel,
                skills: job.skills,
                description: job.description,
                source: "auto",
                sourceUrl: job.sourceUrl,
              })),
            )
            .returning()
        : [];

    res.json(
      CollectJobsResponse.parse(
        toJson({
          inserted: inserted.length,
          skipped,
          posts: inserted,
        }),
      ),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to collect jobs");
    res.status(502).json({
      error: `${
        postType === "seeking" ? "구직" : "구인"
      } 정보 자동 수집 중 오류가 발생했습니다.`,
    });
  } finally {
    collectInProgress = false;
  }
});

export default router;
