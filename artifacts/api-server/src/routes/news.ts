import { Router, type IRouter } from "express";
import { toJson } from "../lib/serialize";
import { desc } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";
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

  const topic = (parsed.data.topic ?? "").trim();
  const focus = topic
    ? `특히 "${topic}" 주제에 집중해서 찾아줘.`
    : "제조업 투자(FDI), 공장 신설/증설, 자동화, 전자/반도체, 물류/공급망, 산업단지, 무역/수출 등 폭넓은 주제를 포함해줘.";

  if (collectInProgress) {
    res
      .status(429)
      .json({ error: "이미 수집이 진행 중입니다. 잠시 후 다시 시도해주세요." });
    return;
  }
  const sinceLast = Date.now() - lastCollectAt;
  if (sinceLast < COLLECT_COOLDOWN_MS) {
    const waitSec = Math.ceil((COLLECT_COOLDOWN_MS - sinceLast) / 1000);
    res.status(429).json({
      error: `잠시 후 다시 시도해주세요. (${waitSec}초 후 가능)`,
    });
    return;
  }
  collectInProgress = true;
  lastCollectAt = Date.now();

  try {
    const { ai } = await import("@workspace/integrations-gemini-ai");

    const searchPrompt = `베트남 제조업/산업 분야의 최신 뉴스를 웹에서 검색해서 8건 정리해줘. ${focus}
가능한 한 최근(최근 몇 주 이내) 기사 위주로 찾아줘.
각 뉴스마다 다음을 포함해줘: 기사 원제목, 언론사/출처명, 보도 날짜, 핵심 내용 요약.
베트남 제조업/산업/투자/무역과 무관한 뉴스는 제외해줘.`;

    const searchResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: { tools: [{ googleSearch: {} }] },
    });

    const searchText = searchResp.text ?? "";
    if (!searchText.trim()) {
      res.status(502).json({ error: "뉴스 검색 결과를 가져오지 못했습니다." });
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
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    });

    const arr = extractJsonArray(structureResp.text ?? "");
    if (!Array.isArray(arr)) {
      res.status(502).json({ error: "뉴스 데이터를 해석하지 못했습니다." });
      return;
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

    const inserted =
      toInsert.length > 0
        ? await db
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

    res.json(
      CollectNewsResponse.parse(
        toJson({
          inserted: inserted.length,
          skipped,
          articles: inserted,
        }),
      ),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to collect news");
    res.status(502).json({
      error: "뉴스 자동 수집 중 오류가 발생했습니다.",
    });
  } finally {
    collectInProgress = false;
  }
});

export default router;
