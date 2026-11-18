import { readExcel } from "./excelImport";

export { readExcel };

export const CLEAR_MARKER = "(비움)";
export const MAX_BULK_ROWS = 5000;

export type BulkField = { key: string; header: string; label: string; aliases: string[] };

/** Columns that may be overwritten. `id` is the only matching key. */
export const BULK_FIELDS: BulkField[] = [
  { key: "name", header: "name", label: "기업명", aliases: ["name", "기업명"] },
  { key: "taxCode", header: "tax_code", label: "MST(사업자번호)", aliases: ["tax_code", "taxcode", "mst", "사업자번호", "mst(사업자번호)"] },
  { key: "phone", header: "phone", label: "전화번호", aliases: ["phone", "전화번호"] },
  { key: "kakaoTalkId", header: "kakaotalk_id", label: "카카오톡 ID", aliases: ["kakaotalk_id", "kakaotalkid", "카카오톡id"] },
  { key: "location", header: "location", label: "지역", aliases: ["location", "지역"] },
  { key: "contactEmail", header: "contact_email", label: "이메일", aliases: ["contact_email", "contactemail", "이메일"] },
  { key: "capabilityTags", header: "capability_tags", label: "역량 태그", aliases: ["capability_tags", "capabilitytags", "역량태그"] },
  { key: "description", header: "description", label: "기업 소개", aliases: ["description", "기업소개"] },
  { key: "techSpecs", header: "tech_specs", label: "기술 사양", aliases: ["tech_specs", "techspecs", "기술사양"] },
];

export type ExistingCompany = {
  id: number; name: string; taxCode?: string | null; phone?: string | null; kakaoTalkId?: string | null;
  location?: string | null; contactEmail?: string | null; capabilityTags: string[]; description?: string | null; techSpecs?: string | null;
};

export type BulkItem = { id: number; row: number; [field: string]: string | string[] | number };
export type BulkChange = { row: number; id: number; name: string; changes: { label: string; before: string; after: string }[] };
export type BulkPreview = {
  items: BulkItem[]; changed: BulkChange[]; unchanged: number;
  errors: { row: number; id?: number; reason: string }[]; columns: string[];
};

const key = (v: string) => v.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");

/** Comma-separated cell → trimmed, de-duplicated array. */
export function parseTags(cell: string): string[] {
  return [...new Set(cell.split(/[,，、]/).map((t) => t.trim()).filter(Boolean))];
}

function currentText(c: ExistingCompany, field: string): string {
  const v = (c as unknown as Record<string, unknown>)[field];
  return Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : "";
}

/**
 * Parse an uploaded sheet against the current companies and compute what WOULD change.
 * Blank cells mean "keep" (never sent); `(비움)` is the only way to clear a value.
 */
export function buildBulkPreview(grid: string[][], existing: ExistingCompany[]): BulkPreview {
  if (!grid.length) throw new Error("첫 번째 시트에 데이터가 없습니다.");
  const headers = grid[0];
  let idColumn = -1;
  const mapping = new Map<number, BulkField>();
  headers.forEach((raw, index) => {
    const header = key(raw ?? "");
    if (!header) return;
    if (header === "id") { idColumn = index; return; }
    const field = BULK_FIELDS.find((f) => f.aliases.includes(header));
    if (!field) throw new Error(`지원하지 않는 열: "${raw.trim()}". [현재 데이터 내보내기]로 받은 양식을 사용하세요.`);
    if ([...mapping.values()].some((f) => f.key === field.key)) throw new Error(`중복된 열: ${field.label}`);
    mapping.set(index, field);
  });
  if (idColumn < 0) throw new Error("id 열이 없습니다. [현재 데이터 내보내기]로 받은 양식을 사용하세요.");
  if (!mapping.size) throw new Error("수정할 열이 없습니다. id 외에 변경할 열을 하나 이상 포함하세요.");

  const byId = new Map(existing.map((c) => [c.id, c]));
  const items: BulkItem[] = [];
  const changed: BulkChange[] = [];
  const errors: BulkPreview["errors"] = [];
  const seen = new Set<number>();
  const touched = new Set<string>();
  let unchanged = 0;
  let dataRows = 0;

  grid.slice(1).forEach((cells, index) => {
    if (!cells.some((c) => c?.trim())) return;
    const row = index + 2;
    if (++dataRows > MAX_BULK_ROWS) throw new Error(`한 번에 최대 ${MAX_BULK_ROWS.toLocaleString()}행까지 처리할 수 있습니다.`);
    const rawId = (cells[idColumn] ?? "").trim();
    if (!rawId) { errors.push({ row, reason: "id가 비어 있습니다." }); return; }
    if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) { errors.push({ row, reason: `id "${rawId}"는 양의 정수여야 합니다.` }); return; }
    const id = Number(rawId);
    const company = byId.get(id);
    if (!company) { errors.push({ row, id, reason: `id ${id}를 찾을 수 없습니다.` }); return; }
    if (seen.has(id)) { errors.push({ row, id, reason: `id ${id}가 파일에 중복되었습니다.` }); return; }
    seen.add(id);

    const item: BulkItem = { id, row };
    const changes: BulkChange["changes"] = [];
    let rowError = "";
    mapping.forEach((field, column) => {
      const cell = (cells[column] ?? "").trim();
      if (!cell) return; // blank = keep
      const clear = cell === CLEAR_MARKER;
      if (clear && field.key === "name") { rowError = "기업명은 비울 수 없습니다."; return; }
      const before = currentText(company, field.key);
      let after: string;
      if (field.key === "capabilityTags") {
        const tags = clear ? [] : parseTags(cell);
        if (!tags.length) return;
        item.capabilityTags = clear ? [CLEAR_MARKER] : tags;
        after = tags.join(", ");
      } else {
        item[field.key] = cell;
        after = clear ? "" : cell;
      }
      if (field.key === "contactEmail" && !clear && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) rowError = "이메일 형식을 확인하세요.";
      if (after !== before) { changes.push({ label: field.label, before, after }); touched.add(field.label); }
      else delete item[field.key];
    });
    if (rowError) { errors.push({ row, id, reason: rowError }); return; }
    if (!changes.length) { unchanged++; return; }
    items.push(item);
    changed.push({ row, id, name: company.name, changes });
  });
  if (!dataRows) throw new Error("제목 행 아래에 수정할 데이터가 없습니다.");
  return { items, changed, unchanged, errors, columns: [...touched] };
}

export async function downloadCurrentData(companies: ExistingCompany[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("데이터");
  sheet.columns = [
    { header: "id", key: "id", width: 10, style: { numFmt: "@" } },
    ...BULK_FIELDS.map((f) => ({ header: f.header, key: f.key, width: 25, style: { numFmt: "@" } })),
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  companies.forEach((c) => sheet.addRow({ id: String(c.id), ...Object.fromEntries(BULK_FIELDS.map((f) => [f.key, currentText(c, f.key)])) }));
  const help = workbook.addWorksheet("작성 안내");
  help.columns = [{ header: "항목", width: 20 }, { header: "안내", width: 90 }];
  help.addRow(["id", "수정할 회원사의 ID입니다. 변경하지 마세요. 없는 id는 건너뛰고 오류로 보고됩니다(새로 만들지 않음)."]);
  help.addRow(["빈 셀", "비워 두면 기존 값을 그대로 유지합니다."]);
  help.addRow([CLEAR_MARKER, "값을 지우려면 셀에 (비움)이라고 입력하세요. (기업명은 비울 수 없음)"]);
  help.addRow(["capability_tags", "쉼표로 구분해 입력하세요. 예: 용접, 열처리, 도장 (입력하면 기존 태그를 대체합니다)"]);
  help.addRow(["주의", "변경하지 않을 열은 삭제하거나 비워 두세요. 데이터 시트(첫 번째 시트)만 읽습니다."]);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "회원사_일괄수정_양식.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
