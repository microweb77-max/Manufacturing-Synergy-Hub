import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { desc } from "drizzle-orm";
import { db, pool, newsArticlesTable, newsRefreshSlotsTable } from "@workspace/db";
import {
  ListNewsResponse,
  CollectNewsBody,
  CollectNewsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type CollectedArticle = {
  title: string;
  summary: string;
  category: string;
  originalTitle: string | null;
  source: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
};

const COLLECT_COOLDOWN_MS = 30_000;
let lastCollectAt = 0;

export class NewsCollectionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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

const NEWS_CATEGORIES = new Set([
  "투자·FDI",
  "생산·공장",
  "자동화·기술",
  "전자·반도체",
  "물류·공급망",
  "무역·수출",
  "산업단지",
  "기타",
]);

function normalizeCategory(v: string): string {
  return NEWS_CATEGORIES.has(v) ? v : "기타";
}

router.get("/news", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(newsArticlesTable)
    .orderBy(desc(newsArticlesTable.createdAt));

  res.json(ListNewsResponse.parse(toJson(rows)));
});

router.post("/news/collect", async (req, res): Promise<void> => {
  const parsed = CollectNewsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await collectNews((parsed.data.topic ?? "").trim());
    res.json(CollectNewsResponse.parse(toJson(result)));
  } catch (err) {
    if (err instanceof NewsCollectionError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to collect news");
    res.status(502).json({ error: "뉴스 자동 수집 중 오류가 발생했습니다." });
  }
});

// How many recently saved headlines are passed to the search prompt so an
// hourly run looks for stories we don't already have.
const RECENT_TITLES_FOR_PROMPT = 40;

// Both admin/manual and scheduler paths share this lock and collection logic.
// `scheduledSlot` is the Vietnam-time hour ("YYYY-MM-DDTHH") of a scheduler run;
// a slot that already completed is skipped without contacting Gemini.
export async function collectNews(topic = "", scheduledSlot?: string) {
  const focus = topic
    ? `특히 "${topic}" 주제에 집중해서 찾아줘.`
    : "제조업 투자(FDI), 공장 신설/증설, 자동화, 전자/반도체, 물류/공급망, 산업단지, 무역/수출 등 폭넓은 주제를 포함해줘.";

  const connection = await pool.connect();
  let locked = false;
  try {
    // Session advisory lock works across Autoscale instances and process restarts.
    locked = (await connection.query("SELECT pg_try_advisory_lock(728301, 1) AS locked")).rows[0].locked;
    if (!locked) throw new NewsCollectionError(429, "이미 뉴스 수집이 진행 중입니다.");
    if (scheduledSlot) {
      const completed = await connection.query(
        "SELECT inserted, skipped FROM news_refresh_slots WHERE scheduled_slot=$1",
        [scheduledSlot],
      );
      if (completed.rowCount) return {
        inserted: 0, skipped: 0, articles: [], alreadyCompleted: true,
      };
    }
    if (Date.now() - lastCollectAt < COLLECT_COOLDOWN_MS) {
      throw new NewsCollectionError(429, "잠시 후 다시 시도해주세요. (30초 쿨다운)");
    }
    lastCollectAt = Date.now();
    const { ai } = await import("@workspace/integrations-gemini-ai");
    const abortSignal = AbortSignal.timeout(240_000);

    const recent = await db
      .select({ title: newsArticlesTable.title, originalTitle: newsArticlesTable.originalTitle })
      .from(newsArticlesTable)
      .orderBy(desc(newsArticlesTable.createdAt))
      .limit(RECENT_TITLES_FOR_PROMPT);
    const knownList = recent
      .map((r) => `- ${r.originalTitle || r.title}`)
      .join("\n");
    const today = scheduledSlot?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

    const searchPrompt = `베트남 제조업/산업 분야의 최신 뉴스를 웹에서 검색해서 8건 정리해줘. ${focus}
최근 24~48시간 이내에 보도된 기사를 최우선으로 찾고, 부족하면 최근 1주일 이내 기사로 채워줘.
오늘 날짜는 ${today}야.${knownList ? `
아래는 이미 수집한 기사 목록이야. 같은 사건을 다룬 기사는 제외하고 새로운 기사만 찾아줘:
${knownList}` : ""}
각 뉴스마다 다음을 포함해줘: 기사 원제목, 언론사/출처명, 보도 날짜, 핵심 내용 요약.
베트남 제조업/산업/투자/무역과 무관한 뉴스는 제외해줘.`;

    const searchResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: { tools: [{ googleSearch: {} }], abortSignal },
    });

    const searchText = searchResp.text ?? "";
    if (!searchText.trim()) {
      throw new NewsCollectionError(502, "뉴스 검색 결과를 가져오지 못했습니다.");
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

    const structurePrompt = `아래 텍스트는 베트남 제조업/산업 관련 뉴스야. 이를 JSON 배열로 변환하고 모든 내용을 한국어로 번역해줘.
각 원소는 다음 키를 가진 객체야:
- "title": 기사 제목 (한국어로 번역, 자연스럽게)
- "originalTitle": 기사 원제목 (원문 그대로, 없으면 "")
- "summary": 기사 핵심 내용 요약 (한국어 3~5문장)
- "category": 뉴스 분야 (다음 중 하나로 분류: "투자·FDI", "생산·공장", "자동화·기술", "전자·반도체", "물류·공급망", "무역·수출", "산업단지", "기타")
- "source": 언론사/출처명 (없으면 "")
- "publishedAt": 보도 날짜 (알 수 있으면 "YYYY-MM-DD" 또는 원문 표기, 없으면 "")
- "sourceUrl": 아래 [출처 목록]에서 이 기사와 가장 관련된 URL을 그대로 선택해서 넣어줘. 관련 출처가 없으면 ""로 둬. 목록에 없는 URL은 절대 만들지 마.
title과 summary는 반드시 자연스러운 한국어로 작성해줘. JSON 배열만 출력하고 다른 설명은 절대 붙이지 마.

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
    if (!Array.isArray(arr)) {
      throw new NewsCollectionError(502, "뉴스 데이터를 해석하지 못했습니다.");
    }

    const articles: CollectedArticle[] = arr
      .map((item): CollectedArticle | null => {
        if (typeof item !== "object" || item === null) return null;
        const o = item as Record<string, unknown>;
        const title = toStr(o.title);
        if (!title) return null;
        const picked = toStr(o.sourceUrl);
        const sourceUrl = allowedUrls.has(picked) ? picked : fallbackUrl;
        const originalTitle = toStr(o.originalTitle);
        const source = toStr(o.source);
        const publishedAt = toStr(o.publishedAt);
        return {
          title,
          summary: toStr(o.summary),
          category: normalizeCategory(toStr(o.category)),
          originalTitle: originalTitle || null,
          source: source || null,
          sourceUrl,
          publishedAt: publishedAt || null,
        };
      })
      .filter((a): a is CollectedArticle => a !== null);
    if (!articles.length) {
      throw new NewsCollectionError(502, "유효한 뉴스 기사를 찾지 못했습니다.");
    }

    const existing = await db
      .select({ title: newsArticlesTable.title })
      .from(newsArticlesTable);

    const seen = new Set(existing.map((e) => e.title.toLowerCase()));

    const toInsert: CollectedArticle[] = [];
    let skipped = 0;
    for (const article of articles) {
      const key = article.title.toLowerCase();
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      toInsert.push(article);
    }

    // Articles and completion marker are committed together. A failed attempt
    // never marks the slot as completed, so the scheduler can safely retry.
    const inserted = await db.transaction(async (tx) => {
      const rows = toInsert.length > 0
        ? await tx
            .insert(newsArticlesTable)
            .values(
              toInsert.map((article) => ({
                title: article.title,
                summary: article.summary,
                category: article.category,
                originalTitle: article.originalTitle,
                source: article.source,
                sourceUrl: article.sourceUrl,
                publishedAt: article.publishedAt,
              })),
            )
            .returning()
        : [];
      if (scheduledSlot) {
        await tx.insert(newsRefreshSlotsTable).values({
          scheduledSlot, inserted: rows.length, skipped,
        });
      }
      return rows;
    });
    return { inserted: inserted.length, skipped, articles: inserted, alreadyCompleted: false };
  } finally {
    try {
      if (locked) await connection.query("SELECT pg_advisory_unlock(728301, 1)");
    } catch {
      // A broken connection must never go back into the pool with a held lock.
      connection.release(true);
      locked = false;
      throw new Error("Failed to release the news collection lock.");
    }
    connection.release();
  }
}

export default router;
