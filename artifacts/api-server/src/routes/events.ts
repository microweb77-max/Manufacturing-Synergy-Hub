import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, pool, eventsTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
  CollectEventsBody,
} from "@workspace/api-zod";
import { toJson } from "../lib/serialize";
import {
  dedupeEvents, eventDedupKey, isHttpUrl, normalizeEventCategory, normalizeEventCity,
  parseBoolQuery, parseIsoDate, periodEnd, pickAllowedUrl,
} from "../lib/events";

const router: IRouter = Router();

export class EventCollectionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const COLLECT_COOLDOWN_MS = 30_000;
let lastCollectAt = 0;

const vietnamToday = (now = new Date()) =>
  new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON array found in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

// Only http(s) links may be stored (blocks javascript: etc. from manual input).
function cleanUrl(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t && isHttpUrl(t) ? t : null;
}

router.get("/events", async (req, res): Promise<void> => {
  const q = ListEventsQueryParams.safeParse({ ...req.query, includePast: undefined });
  if (!q.success) { res.status(400).json({ error: q.error.message }); return; }
  const includePast = parseBoolQuery(req.query.includePast);
  const today = vietnamToday();
  const conds = [eq(eventsTable.status, "published")];
  if (!includePast) {
    // A multi-day event stays visible until its last day.
    conds.push(sql`coalesce(${eventsTable.endDate}, ${eventsTable.startDate}) >= ${today}`);
  }
  if (q.data.category) conds.push(eq(eventsTable.category, q.data.category));
  if (q.data.city) conds.push(eq(eventsTable.city, q.data.city));
  const end = periodEnd(q.data.period, today);
  if (end) conds.push(lte(eventsTable.startDate, end));
  const rows = await db.select().from(eventsTable).where(and(...conds))
    .orderBy(asc(eventsTable.startDate), asc(eventsTable.id));
  res.json(toJson(rows));
});

// Platform-admin only (apiAuthorization.ts treats /admin/* reads as private).
router.get("/admin/events", async (_req, res): Promise<void> => {
  res.json(toJson(await db.select().from(eventsTable).orderBy(desc(eventsTable.startDate), desc(eventsTable.id))));
});

router.post("/events/collect", async (req, res): Promise<void> => {
  const parsed = CollectEventsBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    res.json(toJson(await collectEvents((parsed.data.topic ?? "").trim())));
  } catch (err) {
    if (err instanceof EventCollectionError) { res.status(err.status).json({ error: err.message }); return; }
    req.log.error({ err }, "Failed to collect events");
    res.status(502).json({ error: "행사 자동 수집 중 오류가 발생했습니다." });
  }
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const p = GetEventParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const [row] = await db.select().from(eventsTable)
    .where(and(eq(eventsTable.id, p.data.id), eq(eventsTable.status, "published")));
  if (!row) { res.status(404).json({ error: "행사를 찾을 수 없습니다." }); return; }
  res.json(toJson(row));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const startDate = parseIsoDate(d.startDate);
  const endDate = d.endDate ? parseIsoDate(d.endDate) : null;
  if (!d.title.trim() || !startDate || (d.endDate && !endDate) || (endDate && endDate < startDate)) {
    res.status(400).json({ error: "제목과 올바른 일정(YYYY-MM-DD)을 입력해 주세요." });
    return;
  }
  const [row] = await db.insert(eventsTable).values({
    title: d.title.trim(),
    originalTitle: d.originalTitle?.trim() || null,
    summary: d.summary?.trim() ?? "",
    category: normalizeEventCategory(d.category ?? ""),
    city: normalizeEventCity(d.city ?? ""),
    venue: d.venue?.trim() || null,
    organizer: d.organizer?.trim() || null,
    startDate, endDate,
    isOnline: d.isOnline ?? false,
    sourceUrl: cleanUrl(d.sourceUrl),
    source: "manual",
    status: d.status ?? "published",
  }).returning();
  res.status(201).json(toJson(row));
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const p = UpdateEventParams.safeParse(req.params);
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!p.success || !parsed.success) {
    res.status(400).json({ error: (p.success ? parsed.error! : p.error).message });
    return;
  }
  const [current] = await db.select().from(eventsTable).where(eq(eventsTable.id, p.data.id));
  if (!current) { res.status(404).json({ error: "행사를 찾을 수 없습니다." }); return; }
  const d = parsed.data;
  const set: Partial<typeof eventsTable.$inferInsert> = { updatedAt: new Date() };
  if (d.title !== undefined) {
    if (!d.title.trim()) { res.status(400).json({ error: "제목을 입력해 주세요." }); return; }
    set.title = d.title.trim();
  }
  if (d.originalTitle !== undefined) set.originalTitle = d.originalTitle?.trim() || null;
  if (d.summary !== undefined) set.summary = d.summary.trim();
  if (d.category !== undefined) set.category = normalizeEventCategory(d.category);
  if (d.city !== undefined) set.city = normalizeEventCity(d.city);
  if (d.venue !== undefined) set.venue = d.venue?.trim() || null;
  if (d.organizer !== undefined) set.organizer = d.organizer?.trim() || null;
  if (d.isOnline !== undefined) set.isOnline = d.isOnline;
  if (d.sourceUrl !== undefined) set.sourceUrl = cleanUrl(d.sourceUrl);
  if (d.status !== undefined) set.status = d.status;
  if (d.startDate !== undefined) {
    const s = parseIsoDate(d.startDate);
    if (!s) { res.status(400).json({ error: "시작일 형식이 올바르지 않습니다." }); return; }
    set.startDate = s;
  }
  if (d.endDate !== undefined) {
    const e = d.endDate ? parseIsoDate(d.endDate) : null;
    if (d.endDate && !e) { res.status(400).json({ error: "종료일 형식이 올바르지 않습니다." }); return; }
    set.endDate = e;
  }
  const start = set.startDate ?? current.startDate;
  const end = d.endDate !== undefined ? set.endDate : current.endDate;
  if (end && end < start) { res.status(400).json({ error: "종료일은 시작일 이후여야 합니다." }); return; }
  const [row] = await db.update(eventsTable).set(set).where(eq(eventsTable.id, p.data.id)).returning();
  res.json(toJson(row));
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const p = DeleteEventParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const deleted = await db.delete(eventsTable).where(eq(eventsTable.id, p.data.id)).returning({ id: eventsTable.id });
  if (!deleted.length) { res.status(404).json({ error: "행사를 찾을 수 없습니다." }); return; }
  res.status(204).end();
});

type Candidate = {
  title: string; originalTitle: string | null; summary: string; category: string; city: string;
  venue: string | null; organizer: string | null; startDate: string; endDate: string | null;
  isOnline: boolean; sourceUrl: string | null;
};

// Admin button and the weekly scheduler share this lock/cooldown and collection logic.
export async function collectEvents(topic = "") {
  const focus = topic
    ? `특히 "${topic}" 주제에 집중해서 찾아줘.`
    : "제조, 스마트팩토리/자동화, AI, 전자·반도체, 물류·공급망 분야를 폭넓게 포함해줘.";

  const connection = await pool.connect();
  let locked = false;
  try {
    locked = (await connection.query("SELECT pg_try_advisory_lock(728302, 1) AS locked")).rows[0].locked;
    if (!locked) throw new EventCollectionError(429, "이미 행사 수집이 진행 중입니다.");
    if (Date.now() - lastCollectAt < COLLECT_COOLDOWN_MS) {
      throw new EventCollectionError(429, "잠시 후 다시 시도해주세요. (30초 쿨다운)");
    }
    lastCollectAt = Date.now();
    const { ai } = await import("@workspace/integrations-gemini-ai");
    const abortSignal = AbortSignal.timeout(240_000);
    const today = vietnamToday();

    const searchPrompt = `오늘(${today})부터 향후 6개월 안에 베트남에서 열리거나 베트남 제조업과 관련된 전시회, 컨퍼런스, 세미나, 상담회를 웹에서 검색해서 최대 12건 정리해줘. ${focus}
참고할 출처 예: 전시회 일정 사이트, MTA Vietnam, NEPCON Vietnam, Vietnam Manufacturing Expo, 베트남 AI 컨퍼런스, KOTRA·KOCHAM 행사.
각 행사마다 행사 원제목, 시작일, 종료일, 도시, 장소, 주최, 온라인 여부, 분야, 핵심 내용 요약을 포함해줘. 이미 종료된 행사와 날짜를 확인할 수 없는 행사는 제외해줘.`;

    const searchResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
      config: { tools: [{ googleSearch: {} }], abortSignal },
    });
    const searchText = searchResp.text ?? "";
    if (!searchText.trim()) throw new EventCollectionError(502, "행사 검색 결과를 가져오지 못했습니다.");

    const chunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((c) => ({ title: toStr(c.web?.title), uri: c.web?.uri ?? "" }))
      .filter((s) => s.uri.length > 0);
    const allowedUrls = new Set(sources.map((s) => s.uri));
    const fallbackUrl = sources[0]?.uri ?? null;
    const sourceList = sources.map((s, i) => `${i + 1}. ${s.title || "(제목 없음)"} => ${s.uri}`).join("\n");

    const structurePrompt = `아래 텍스트는 베트남 제조·자동화·AI 관련 행사 정보야. 이를 JSON 배열로 변환하고 title과 summary는 자연스러운 한국어로 작성해줘.
각 원소의 키:
- "title": 행사명 (한국어)
- "originalTitle": 행사 원제목 (없으면 "")
- "summary": 행사 요약 (한국어 2~4문장)
- "category": "제조", "자동화", "AI", "전자·반도체", "물류", "기타" 중 하나
- "city": "하노이", "호치민", "다낭", "기타·온라인" 중 하나
- "venue": 장소 (없으면 "")
- "organizer": 주최 (없으면 "")
- "startDate": 시작일 "YYYY-MM-DD" (알 수 없으면 "")
- "endDate": 종료일 "YYYY-MM-DD" (없거나 하루짜리면 "")
- "isOnline": 온라인 행사면 true
- "sourceUrl": 아래 [출처 목록]에서 이 행사와 가장 관련된 URL을 그대로 선택. 없으면 "". 목록에 없는 URL은 절대 만들지 마.
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
    if (!Array.isArray(arr)) throw new EventCollectionError(502, "행사 데이터를 해석하지 못했습니다.");

    const candidates = arr.map((item): Candidate | null => {
      if (typeof item !== "object" || item === null) return null;
      const o = item as Record<string, unknown>;
      const title = toStr(o.title);
      const startDate = parseIsoDate(toStr(o.startDate));
      if (!title || !startDate) return null;
      const endRaw = parseIsoDate(toStr(o.endDate));
      const endDate = endRaw && endRaw > startDate ? endRaw : null;
      const isOnline = o.isOnline === true;
      return {
        title,
        originalTitle: toStr(o.originalTitle) || null,
        summary: toStr(o.summary),
        category: normalizeEventCategory(toStr(o.category)),
        city: normalizeEventCity(toStr(o.city) || (isOnline ? "온라인" : "")),
        venue: toStr(o.venue) || null,
        organizer: toStr(o.organizer) || null,
        startDate, endDate, isOnline,
        sourceUrl: pickAllowedUrl(toStr(o.sourceUrl), allowedUrls, fallbackUrl),
      };
    }).filter((c): c is Candidate => c !== null);
    if (!candidates.length) throw new EventCollectionError(502, "유효한 행사를 찾지 못했습니다.");

    const existing = await db.select({ title: eventsTable.title, originalTitle: eventsTable.originalTitle, startDate: eventsTable.startDate })
      .from(eventsTable).where(gte(eventsTable.startDate, "1900-01-01"));
    const existingKeys = existing.flatMap((e) => [
      eventDedupKey(e.title, e.startDate),
      ...(e.originalTitle ? [eventDedupKey(e.originalTitle, e.startDate)] : []),
    ]);
    const { keep, skipped } = dedupeEvents(existingKeys, candidates);
    const inserted = keep.length
      ? await db.insert(eventsTable).values(keep.map((c) => ({ ...c, source: "auto", status: "published" }))).returning()
      : [];
    return { inserted: inserted.length, skipped, events: inserted };
  } finally {
    try {
      if (locked) await connection.query("SELECT pg_advisory_unlock(728302, 1)");
    } catch {
      connection.release(true);
      locked = false;
      throw new Error("Failed to release the event collection lock.");
    }
    connection.release();
  }
}

export default router;
