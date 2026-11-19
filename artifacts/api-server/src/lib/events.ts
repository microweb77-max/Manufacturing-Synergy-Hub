// Pure helpers for the 행사·세미나 feature (no DB / network) so they are unit-testable.

export const EVENT_CATEGORIES = ["제조", "자동화", "AI", "전자·반도체", "물류", "기타"] as const;
export const EVENT_CITIES = ["하노이", "호치민", "다낭", "기타·온라인"] as const;

export function normalizeEventCategory(v: string): string {
  return (EVENT_CATEGORIES as readonly string[]).includes(v) ? v : "기타";
}

export function normalizeEventCity(v: string): string {
  if ((EVENT_CITIES as readonly string[]).includes(v)) return v;
  const t = v.toLowerCase();
  if (/hanoi|ha noi|하노이/.test(t)) return "하노이";
  if (/ho chi minh|hcm|saigon|sai gon|호치민|사이공/.test(t)) return "호치민";
  if (/da nang|danang|다낭/.test(t)) return "다낭";
  return "기타·온라인";
}

/** Accepts only a real calendar date written as YYYY-MM-DD. */
export function parseIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return null;
  }
  return v.trim();
}

/** Dedup key: normalized title + start date. */
export function eventDedupKey(title: string, startDate: string): string {
  const t = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  return `${t}__${startDate}`;
}

/** Drops candidates already known (or repeated in the batch). Returns kept + skipped count. */
export function dedupeEvents<T extends { title: string; startDate: string }>(
  existingKeys: Iterable<string>,
  candidates: T[],
): { keep: T[]; skipped: number } {
  const seen = new Set(existingKeys);
  const keep: T[] = [];
  let skipped = 0;
  for (const c of candidates) {
    const key = eventDedupKey(c.title, c.startDate);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    keep.push(c);
  }
  return { keep, skipped };
}

/** Only URLs that Gemini actually returned as grounding sources are trusted. */
export function pickAllowedUrl(picked: string, allowed: Set<string>, fallback: string | null): string | null {
  return allowed.has(picked) ? picked : fallback;
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Upper bound (YYYY-MM-DD, inclusive) of the 기간 filter, or null for 전체. */
export function periodEnd(period: string | undefined, today: string): string | null {
  const [y, m] = today.split("-").map(Number);
  if (period === "month") {
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  }
  if (period === "three-months") {
    return new Date(Date.UTC(y, m + 3, 0)).toISOString().slice(0, 10);
  }
  return null;
}

export function parseBoolQuery(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

export function buildDigestText(
  events: { title: string; startDate: string; endDate?: string | null; city: string; venue?: string | null; sourceUrl?: string | null }[],
  unsubscribeUrl: string,
): string {
  const lines = events.map((e) => {
    const when = e.endDate && e.endDate !== e.startDate ? `${e.startDate} ~ ${e.endDate}` : e.startDate;
    const where = [e.city, e.venue].filter(Boolean).join(" · ");
    return `■ ${e.title}\n  일정: ${when}\n  장소: ${where}${e.sourceUrl ? `\n  링크: ${e.sourceUrl}` : ""}`;
  });
  return `관심 분야의 새 행사 ${events.length}건이 등록되었습니다.\n\n${lines.join("\n\n")}\n\n---\n주간 알림 메일을 더 이상 받지 않으려면 아래 링크를 열어 주세요.\n${unsubscribeUrl}\n`;
}
