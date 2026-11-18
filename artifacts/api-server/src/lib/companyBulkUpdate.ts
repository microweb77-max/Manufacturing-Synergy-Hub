import type { CompanyBulkUpdateItem } from "@workspace/api-zod";

/** Explicit marker that clears a field. Empty/omitted values always mean "keep". */
export const CLEAR_MARKER = "(비움)";

export type CompanyPatch = Partial<{
  name: string;
  taxCode: string | null;
  phone: string | null;
  kakaoTalkId: string | null;
  description: string;
  location: string;
  capabilityTags: string[];
  techSpecs: string;
  contactEmail: string;
}>;

const nullableText = ["taxCode", "phone", "kakaoTalkId"] as const;
const requiredText = ["description", "location", "techSpecs", "contactEmail"] as const;

/**
 * Convert one bulk-update item into a DB patch containing ONLY the fields that
 * were explicitly provided. Blank values are never written (data preservation).
 */
export function buildCompanyPatch(item: CompanyBulkUpdateItem): { patch: CompanyPatch } | { error: string } {
  const patch: CompanyPatch = {};

  if (item.name !== undefined && item.name.trim()) {
    if (item.name.trim() === CLEAR_MARKER) return { error: "기업명은 비울 수 없습니다." };
    patch.name = item.name.trim();
  }
  for (const key of nullableText) {
    const value = item[key]?.trim();
    if (!value) continue;
    patch[key] = value === CLEAR_MARKER ? null : value;
  }
  for (const key of requiredText) {
    const value = item[key]?.trim();
    if (!value) continue;
    patch[key] = value === CLEAR_MARKER ? "" : value;
  }
  if (item.capabilityTags !== undefined) {
    const tags = [...new Set(item.capabilityTags.map((t) => t.trim()).filter(Boolean))];
    if (tags.length === 1 && tags[0] === CLEAR_MARKER) patch.capabilityTags = [];
    else if (tags.includes(CLEAR_MARKER)) return { error: `역량 태그에서 ${CLEAR_MARKER}는 단독으로만 사용할 수 있습니다.` };
    else if (tags.length) patch.capabilityTags = tags;
  }
  return { patch };
}
