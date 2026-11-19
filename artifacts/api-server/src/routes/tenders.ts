import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, pool, tendersTable } from "@workspace/db";
import {
  ListTendersQueryParams,
  CreateTenderBody,
  GetTenderParams,
  UpdateTenderParams,
  UpdateTenderBody,
  DeleteTenderParams,
  CollectTendersBody,
} from "@workspace/api-zod";
import { toJson } from "../lib/serialize";
import { createOfferPriceVisibility } from "../middlewares/offerPriceVisibility";
import { cleanUrl, extractJsonArray, parseBoolQuery, parseIsoDate, pickAllowedUrl, toStr, vietnamToday } from "../lib/events";
import {
  TENDER_SOURCE_TYPES, TENDER_SOURCE_LABELS, addDays, deadlineLimit, dedupeTenders,
  normalizeTenderCategory, normalizeTenderSourceType, tenderDedupKey, viewTender, type TenderSourceType,
} from "../lib/tenders";


export class TenderCollectionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const COLLECT_COOLDOWN_MS = 30_000;
let lastCollectAt = 0;

// Same server-verified Clerk session check as offer prices; never trust the client to hide fields.
const canViewAll = (res: Response) => res.locals.canViewOfferPrices === true;

const nullable = (v: string | null | undefined) => v?.trim() || null;

/** `visibility` is injectable so tests can fake the verified Clerk session. */
export function createTendersRouter(visibility: RequestHandler = createOfferPriceVisibility()): IRouter {
  const router: IRouter = Router();
  router.get("/tenders", visibility, async (req, res): Promise<void> => {
    const q = ListTendersQueryParams.safeParse({ ...req.query, includeClosed: undefined });
    if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
    const includeClosed = parseBoolQuery(req.query.includeClosed);
    const today = vietnamToday();
    const conds = [eq(tendersTable.status, "published")];
    if (!includeClosed) conds.push(gte(tendersTable.deadline, today));
    if (q.data.sourceType) conds.push(eq(tendersTable.sourceType, q.data.sourceType));
    if (q.data.category) conds.push(eq(tendersTable.category, q.data.category));
    const limit = deadlineLimit(q.data.deadlineWithin, today);
    if (limit) conds.push(lte(tendersTable.deadline, limit));
    const rows = await db.select().from(tendersTable).where(and(...conds))
      .orderBy(asc(tendersTable.deadline), asc(tendersTable.id));
    res.json(toJson(rows.map((r) => viewTender(r, canViewAll(res)))));
  });

  // Platform-admin only (apiAuthorization.ts treats /admin/* reads as private).
  router.get("/admin/tenders", async (_req, res): Promise<void> => {
    const rows = await db.select().from(tendersTable).orderBy(desc(tendersTable.deadline), desc(tendersTable.id));
    res.json(toJson(rows.map((r) => ({ ...r, restricted: false }))));
  });

  router.post("/tenders/collect", async (req, res): Promise<void> => {
    const parsed = CollectTendersBody.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    try {
      const result = await collectTenders(parsed.data.sourceType);
      res.json(toJson({ ...result, tenders: result.tenders.map((r) => ({ ...r, restricted: false })) }));
    } catch (err) {
      if (err instanceof TenderCollectionError) { res.status(err.status).json({ error: err.message }); return; }
      req.log.error({ err }, "Failed to collect tenders");
      res.status(502).json({ error: "공고 자동 수집 중 오류가 발생했습니다." });
    }
  });

  router.get("/tenders/:id", visibility, async (req, res): Promise<void> => {
    const p = GetTenderParams.safeParse(req.params);
    if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
    const [row] = await db.select().from(tendersTable)
      .where(and(eq(tendersTable.id, p.data.id), eq(tendersTable.status, "published")));
    if (!row) { res.status(404).json({ error: "공고를 찾을 수 없습니다." }); return; }
    res.json(toJson(viewTender(row, canViewAll(res))));
  });


  router.post("/tenders", async (req, res): Promise<void> => {
    const parsed = CreateTenderBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const d = parsed.data;
    const deadline = parseIsoDate(d.deadline);
    const publishedDate = d.publishedDate ? parseIsoDate(d.publishedDate) : null;
    if (!d.title.trim() || !deadline || (d.publishedDate && !publishedDate)) {
      res.status(400).json({ error: "제목과 올바른 마감일(YYYY-MM-DD)을 입력해 주세요." });
      return;
    }
    const [row] = await db.insert(tendersTable).values({
      title: d.title.trim(),
      originalTitle: nullable(d.originalTitle),
      summary: d.summary?.trim() ?? "",
      sourceType: normalizeTenderSourceType(d.sourceType ?? ""),
      category: normalizeTenderCategory(d.category ?? ""),
      buyer: nullable(d.buyer), country: nullable(d.country), city: nullable(d.city),
      budget: nullable(d.budget), eligibility: nullable(d.eligibility), submission: nullable(d.submission),
      publishedDate, deadline,
      sourceUrl: cleanUrl(d.sourceUrl),
      source: "manual",
      status: d.status ?? "published",
    }).returning();
    res.status(201).json(toJson({ ...row, restricted: false }));
  });

  router.patch("/tenders/:id", async (req, res): Promise<void> => {
    const p = UpdateTenderParams.safeParse(req.params);
    const parsed = UpdateTenderBody.safeParse(req.body);
    if (!p.success || !parsed.success) {
      res.status(400).json({ error: (p.success ? parsed.error! : p.error).message });
      return;
    }
    const [current] = await db.select({ id: tendersTable.id }).from(tendersTable).where(eq(tendersTable.id, p.data.id));
    if (!current) { res.status(404).json({ error: "공고를 찾을 수 없습니다." }); return; }
    const d = parsed.data;
    const set: Partial<typeof tendersTable.$inferInsert> = { updatedAt: new Date() };
    if (d.title !== undefined) {
      if (!d.title.trim()) { res.status(400).json({ error: "제목을 입력해 주세요." }); return; }
      set.title = d.title.trim();
    }
    if (d.originalTitle !== undefined) set.originalTitle = nullable(d.originalTitle);
    if (d.summary !== undefined) set.summary = d.summary.trim();
    if (d.sourceType !== undefined) set.sourceType = normalizeTenderSourceType(d.sourceType);
    if (d.category !== undefined) set.category = normalizeTenderCategory(d.category);
    if (d.buyer !== undefined) set.buyer = nullable(d.buyer);
    if (d.country !== undefined) set.country = nullable(d.country);
    if (d.city !== undefined) set.city = nullable(d.city);
    if (d.budget !== undefined) set.budget = nullable(d.budget);
    if (d.eligibility !== undefined) set.eligibility = nullable(d.eligibility);
    if (d.submission !== undefined) set.submission = nullable(d.submission);
    if (d.sourceUrl !== undefined) set.sourceUrl = cleanUrl(d.sourceUrl);
    if (d.status !== undefined) set.status = d.status;
    if (d.deadline !== undefined) {
      const dl = parseIsoDate(d.deadline);
      if (!dl) { res.status(400).json({ error: "마감일 형식이 올바르지 않습니다." }); return; }
      set.deadline = dl;
    }
    if (d.publishedDate !== undefined) {
      const pd = d.publishedDate ? parseIsoDate(d.publishedDate) : null;
      if (d.publishedDate && !pd) { res.status(400).json({ error: "게시일 형식이 올바르지 않습니다." }); return; }
      set.publishedDate = pd;
    }
    const [row] = await db.update(tendersTable).set(set).where(eq(tendersTable.id, p.data.id)).returning();
    res.json(toJson({ ...row, restricted: false }));
  });

  router.delete("/tenders/:id", async (req, res): Promise<void> => {
    const p = DeleteTenderParams.safeParse(req.params);
    if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
    const deleted = await db.delete(tendersTable).where(eq(tendersTable.id, p.data.id)).returning({ id: tendersTable.id });
    if (!deleted.length) { res.status(404).json({ error: "공고를 찾을 수 없습니다." }); return; }
    res.status(204).end();
  });
  return router;
}

type Candidate = {
  title: string; originalTitle: string | null; summary: string; sourceType: TenderSourceType; category: string;
  buyer: string | null; country: string | null; city: string | null; budget: string | null;
  eligibility: string | null; submission: string | null; publishedDate: string | null; deadline: string;
  sourceUrl: string | null;
};

const SEARCH_FOCUS: Record<TenderSourceType, string> = {
  gov_vn: "베트남 정부·공공기관 입찰 공고(국가전자조달망 muasamcong 등) 중 제조, 설비, 자동화, IT 관련 건",
  kr_support: "KOTRA, KOCHAM, 중소벤처기업진흥공단 등 한국 기관의 베트남 진출·바이어 상담·전시 참가 지원사업 공고",
  buyer_rfq: "대기업·공기업이 공개적으로 올린 협력사 모집·구매(RFQ) 공고 중 베트남 제조 공급과 관련된 건 (비공개 RFQ 제외)",
};

// Admin button and the weekly scheduler share this lock/cooldown and collection logic.
export async function collectTenders(onlyType?: TenderSourceType) {
  const types = onlyType ? [onlyType] : [...TENDER_SOURCE_TYPES];
  const connection = await pool.connect();
  let locked = false;
  try {
    locked = (await connection.query("SELECT pg_try_advisory_lock(728302, 2) AS locked")).rows[0].locked;
    if (!locked) throw new TenderCollectionError(429, "이미 공고 수집이 진행 중입니다.");
    if (Date.now() - lastCollectAt < COLLECT_COOLDOWN_MS) {
      throw new TenderCollectionError(429, "잠시 후 다시 시도해주세요. (30초 쿨다운)");
    }
    lastCollectAt = Date.now();
    const { ai } = await import("@workspace/integrations-gemini-ai");
    const abortSignal = AbortSignal.timeout(280_000);
    const today = vietnamToday();
    const since = addDays(today, -30);

    const candidates: Candidate[] = [];
    let lastError: TenderCollectionError | null = null;
    for (const sourceType of types) {
      try {
        const searchPrompt = `오늘(${today}) 기준으로 최근 30일(${since} 이후) 안에 게시되었고 마감일이 아직 지나지 않은 ${SEARCH_FOCUS[sourceType]}을 웹에서 검색해 최대 8건 정리해줘. 마감이 임박하지 않았더라도 마감 전인 공고를 우선해줘.
각 공고마다 원제목, 발주처(기관), 게시일, 마감일, 국가·도시, 분야(설비/자동화/IT·소프트웨어/부품·소재/건설·인프라/서비스/기타), 예산(있으면), 참가 자격, 제출 방법, 핵심 내용 요약을 포함해줘. 원문을 그대로 복사하지 말고 요약해줘. 마감일을 확인할 수 없거나 이미 마감된 공고는 제외해줘.`;
        const searchResp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
          config: { tools: [{ googleSearch: {} }], abortSignal },
        });
        const searchText = searchResp.text ?? "";
        if (!searchText.trim()) throw new TenderCollectionError(502, "공고 검색 결과를 가져오지 못했습니다.");

        const chunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources = chunks
          .map((c) => ({ title: toStr(c.web?.title), uri: c.web?.uri ?? "" }))
          .filter((s) => s.uri.length > 0);
        const allowedUrls = new Set(sources.map((s) => s.uri));
        const fallbackUrl = sources[0]?.uri ?? null;
        const sourceList = sources.map((s, i) => `${i + 1}. ${s.title || "(제목 없음)"} => ${s.uri}`).join("\n");

        const structurePrompt = `아래 텍스트는 "${TENDER_SOURCE_LABELS[sourceType]}" 공고 정보야. 이를 JSON 배열로 변환하고 title, summary, eligibility, submission은 자연스러운 한국어로 작성해줘. 원문 전문을 복사하지 말고 요약·핵심 항목만 써줘.
각 원소의 키:
- "title": 공고명 (한국어)
- "originalTitle": 공고 원제목 (없으면 "")
- "summary": 공고 요약 (한국어 2~4문장)
- "category": "설비", "자동화", "IT·소프트웨어", "부품·소재", "건설·인프라", "서비스", "기타" 중 하나
- "buyer": 발주처/주관기관 (없으면 "")
- "country": 국가 (없으면 "")
- "city": 도시 (없으면 "")
- "budget": 예산 (없으면 "")
- "eligibility": 참가 자격 요약 (없으면 "")
- "submission": 제출 방법 요약 (없으면 "")
- "publishedDate": 게시일 "YYYY-MM-DD" (모르면 "")
- "deadline": 마감일 "YYYY-MM-DD" (알 수 없으면 "")
- "sourceUrl": 아래 [출처 목록]에서 이 공고와 가장 관련된 URL을 그대로 선택. 없으면 "". 목록에 없는 URL은 절대 만들지 마.
JSON 배열만 출력하고 다른 설명은 붙이지 마.

[출처 목록]
${sourceList || "(없음)"}

[원본 텍스트]
${searchText}`;
        const structureResp = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: structurePrompt }] }],
          config: { responseMimeType: "application/json", maxOutputTokens: 8192, abortSignal },
        });
        const arr = extractJsonArray(structureResp.text ?? "");
        if (!Array.isArray(arr)) throw new TenderCollectionError(502, "공고 데이터를 해석하지 못했습니다.");

        for (const item of arr) {
          if (typeof item !== "object" || item === null) continue;
          const o = item as Record<string, unknown>;
          const title = toStr(o.title);
          const deadline = parseIsoDate(toStr(o.deadline));
          if (!title || !deadline || deadline < today) continue; // 마감 지난 공고는 저장하지 않음
          candidates.push({
            title,
            originalTitle: toStr(o.originalTitle) || null,
            summary: toStr(o.summary),
            sourceType,
            category: normalizeTenderCategory(toStr(o.category)),
            buyer: toStr(o.buyer) || null,
            country: toStr(o.country) || null,
            city: toStr(o.city) || null,
            budget: toStr(o.budget) || null,
            eligibility: toStr(o.eligibility) || null,
            submission: toStr(o.submission) || null,
            publishedDate: parseIsoDate(toStr(o.publishedDate)),
            deadline,
            sourceUrl: pickAllowedUrl(toStr(o.sourceUrl), allowedUrls, fallbackUrl),
          });
        }
      } catch (err) {
        // One failing source type must not discard the others when collecting all three.
        if (types.length === 1) throw err;
        lastError = err instanceof TenderCollectionError ? err : new TenderCollectionError(502, "공고 수집 중 오류가 발생했습니다.");
      }
    }
    if (!candidates.length) throw lastError ?? new TenderCollectionError(502, "유효한 공고를 찾지 못했습니다.");

    const existing = await db.select({
      title: tendersTable.title, originalTitle: tendersTable.originalTitle,
      buyer: tendersTable.buyer, deadline: tendersTable.deadline,
    }).from(tendersTable);
    const existingKeys = existing.flatMap((e) => [
      tenderDedupKey(e.title, e.buyer, e.deadline),
      ...(e.originalTitle ? [tenderDedupKey(e.originalTitle, e.buyer, e.deadline)] : []),
    ]);
    const { keep, skipped } = dedupeTenders(existingKeys, candidates);
    const inserted = keep.length
      ? await db.insert(tendersTable).values(keep.map((c) => ({ ...c, source: "auto", status: "published" }))).returning()
      : [];
    return { inserted: inserted.length, skipped, tenders: inserted };
  } finally {
    try {
      if (locked) await connection.query("SELECT pg_advisory_unlock(728302, 2)");
    } catch {
      connection.release(true);
      locked = false;
      throw new Error("Failed to release the tender collection lock.");
    }
    connection.release();
  }
}

export default createTendersRouter();
