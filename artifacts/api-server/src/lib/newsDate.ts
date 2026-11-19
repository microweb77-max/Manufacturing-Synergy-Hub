// Article dates come back from Gemini in mixed notations ("2026-11-17",
// "2026년 11월 17일", "2026년 7월 6일 (추정)", "2026-05-27 ~ 28", "최근 보도").
// Normalise what we can to YYYY-MM-DD so the list can be ordered by article date.

const DATE_PATTERN = /(\d{4})\s*(?:[-./]|년)\s*(\d{1,2})\s*(?:[-./]|월)\s*(\d{1,2})/;

/** First recognisable date in the text as "YYYY-MM-DD", or null. */
export function normalizePublishedDate(value: string | null | undefined): string | null {
  const match = value ? DATE_PATTERN.exec(value) : null;
  if (!match) return null;
  const [, year, month, day] = match;
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type SortableArticle = { publishedAt: string | null; createdAt: Date };

/**
 * Newest article date first. Articles without a readable date fall back to the
 * day they were collected; ties keep the most recently collected first.
 */
export function compareNewsByDate(a: SortableArticle, b: SortableArticle): number {
  const keyA = normalizePublishedDate(a.publishedAt) ?? a.createdAt.toISOString().slice(0, 10);
  const keyB = normalizePublishedDate(b.publishedAt) ?? b.createdAt.toISOString().slice(0, 10);
  if (keyA !== keyB) return keyA < keyB ? 1 : -1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}
