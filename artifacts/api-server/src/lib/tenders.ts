// Pure helpers for the 사업공고 feature (no DB / network) so they are unit-testable.

export const TENDER_SOURCE_TYPES = ["gov_vn", "kr_support", "buyer_rfq"] as const;
export type TenderSourceType = (typeof TENDER_SOURCE_TYPES)[number];
export const TENDER_CATEGORIES = ["설비", "자동화", "IT·소프트웨어", "부품·소재", "건설·인프라", "서비스", "기타"] as const;

export const TENDER_SOURCE_LABELS: Record<TenderSourceType, string> = {
  gov_vn: "베트남 정부 입찰",
  kr_support: "한국 지원사업",
  buyer_rfq: "대형 발주처 RFQ",
};

export function normalizeTenderSourceType(v: string): TenderSourceType {
  return (TENDER_SOURCE_TYPES as readonly string[]).includes(v) ? (v as TenderSourceType) : "gov_vn";
}

export function normalizeTenderCategory(v: string): string {
  return (TENDER_CATEGORIES as readonly string[]).includes(v) ? v : "기타";
}

/** Alert preference values may be source types or categories. */
export function isValidTenderAlertValue(v: string): boolean {
  return (TENDER_SOURCE_TYPES as readonly string[]).includes(v) || (TENDER_CATEGORIES as readonly string[]).includes(v);
}

/** Dedup key: normalized title + buyer + deadline. */
export function tenderDedupKey(title: string, buyer: string | null | undefined, deadline: string): string {
  const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  return `${norm(title)}__${norm(buyer ?? "")}__${deadline}`;
}

export function dedupeTenders<T extends { title: string; buyer: string | null; deadline: string }>(
  existingKeys: Iterable<string>,
  candidates: T[],
): { keep: T[]; skipped: number } {
  const seen = new Set(existingKeys);
  const keep: T[] = [];
  let skipped = 0;
  for (const c of candidates) {
    const key = tenderDedupKey(c.title, c.buyer, c.deadline);
    if (seen.has(key)) { skipped += 1; continue; }
    seen.add(key);
    keep.push(c);
  }
  return { keep, skipped };
}

/** Upper bound (YYYY-MM-DD, inclusive) for 마감 7일/30일 이내 filters, or null. */
export function deadlineLimit(within: string | undefined, today: string): string | null {
  const days = within === "7" ? 7 : within === "30" ? 30 : 0;
  return days ? addDays(today, days) : null;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^[\s\S]*?[.!?。](?=\s|$)/.exec(t);
  return (m ? m[0] : t).trim();
}

type TenderLike = {
  summary: string; budget?: string | null; eligibility?: string | null; submission?: string | null; sourceUrl?: string | null;
};

/**
 * Anonymous view: restricted fields are REMOVED (not blanked) on the server,
 * summary is cut to its first sentence.
 */
export function restrictTender<T extends TenderLike>(t: T): Omit<T, "budget" | "eligibility" | "submission" | "sourceUrl"> & { restricted: true } {
  const { budget: _b, eligibility: _e, submission: _s, sourceUrl: _u, ...rest } = t;
  return { ...rest, summary: firstSentence(t.summary), restricted: true };
}

export function viewTender<T extends TenderLike>(t: T, canViewAll: boolean) {
  return canViewAll ? { ...t, restricted: false as const } : restrictTender(t);
}

/** Member's alert values: a tender matches if its type/category fits the chosen groups. */
export function tenderMatchesAlert(t: { sourceType: string; category: string }, values: string[]): boolean {
  const types = values.filter((v) => (TENDER_SOURCE_TYPES as readonly string[]).includes(v));
  const cats = values.filter((v) => !(TENDER_SOURCE_TYPES as readonly string[]).includes(v));
  return (!types.length || types.includes(t.sourceType)) && (!cats.length || cats.includes(t.category));
}

type DigestTender = { title: string; buyer?: string | null; deadline: string; sourceType: string; sourceUrl?: string | null };

function tenderLines(items: DigestTender[]): string {
  return items.map((t) => {
    const type = TENDER_SOURCE_LABELS[t.sourceType as TenderSourceType] ?? t.sourceType;
    return `■ ${t.title}\n  유형: ${type}${t.buyer ? `\n  발주처: ${t.buyer}` : ""}\n  마감: ${t.deadline}${t.sourceUrl ? `\n  링크: ${t.sourceUrl}` : ""}`;
  }).join("\n\n");
}

const UNSUB = (url: string) => `\n\n---\n주간 알림 메일을 더 이상 받지 않으려면 아래 링크를 열어 주세요.\n${url}\n`;

export function buildTenderDigestText(fresh: DigestTender[], closing: DigestTender[], unsubscribeUrl: string): string {
  const parts: string[] = [];
  if (fresh.length) parts.push(`관심 유형·분야의 새 사업공고 ${fresh.length}건이 등록되었습니다.\n\n${tenderLines(fresh)}`);
  if (closing.length) parts.push(`관심등록한 공고 ${closing.length}건이 3일 이내 마감됩니다.\n\n${tenderLines(closing)}`);
  return parts.join("\n\n") + UNSUB(unsubscribeUrl) + "공고 정보는 원문 기준이며 참고용입니다.\n";
}
