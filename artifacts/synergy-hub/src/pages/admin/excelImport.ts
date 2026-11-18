import type { AdminField, FormValues } from "./AdminSection";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportRow = {
  line: number;
  values: FormValues;
  errors: string[];
  status: "pending" | "saved" | "uncertain";
};

const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
const headerKey = (value: string) => normalize(value).replace(/\s+/g, "");

function normalizeValue(value: string, field: AdminField): string {
  const text = value.trim();
  if (field.type === "select" && text) {
    const option = field.options?.find(
      (o) => normalize(o.value) === normalize(text) || normalize(o.label) === normalize(text),
    );
    return option?.value ?? text;
  }
  if (field.type === "number" && /^[+-]?\d{1,3}(,\d{3})+$/.test(text)) {
    return text.replace(/,/g, "");
  }
  return text;
}

/** Validate the whole sheet before any requests. Headers may use labels or API field names. */
export function validateImport(
  grid: string[][],
  fields: AdminField[],
  defaults: FormValues,
  existing: FormValues[],
): ImportRow[] {
  if (!grid.length) throw new Error("첫 번째 시트에 데이터가 없습니다.");
  const editable = fields.filter((f) => f.type !== "readonly");
  const headers = grid[0];
  const mapping: (AdminField | undefined)[] = [];
  const seenFields = new Set<string>();
  for (let index = 0; index < headers.length; index++) {
    const header = headers[index]?.trim() ?? "";
    if (!header) {
      if (grid.slice(1).some((r) => r[index]?.trim())) {
        throw new Error(`${index + 1}번째 열의 제목이 없습니다.`);
      }
      continue;
    }
    const field = editable.find(
      (f) => headerKey(f.name) === headerKey(header) || headerKey(f.label) === headerKey(header),
    );
    if (!field) throw new Error(`지원하지 않는 열: "${header}". 양식을 내려받아 사용하세요. ID로 기존 항목을 수정하는 기능은 아닙니다.`);
    if (seenFields.has(field.name)) throw new Error(`중복된 열: ${field.label}`);
    seenFields.add(field.name);
    mapping[index] = field;
  }
  if (!seenFields.size) throw new Error("인식할 수 있는 열이 없습니다. 첫 행에 양식의 열 제목을 넣어주세요.");
  const missingHeaders = editable.filter((f) => f.required && !seenFields.has(f.name) && !defaults[f.name]?.trim());
  if (missingHeaders.length) throw new Error(`필수 열이 없습니다: ${missingHeaders.map((f) => f.label).join(", ")}`);
  const selected = editable.filter((f) => seenFields.has(f.name));
  const signature = (v: FormValues) =>
    JSON.stringify(selected.map((f) => normalize(normalizeValue(v[f.name] ?? "", f))));
  const existingSignatures = new Set(existing.map(signature));
  const fileSignatures = new Set<string>();
  const rows: ImportRow[] = [];
  grid.slice(1).forEach((cells, index) => {
    if (!cells.some((c) => c.trim())) return;
    if (rows.length >= MAX_IMPORT_ROWS) throw new Error(`한 번에 최대 ${MAX_IMPORT_ROWS.toLocaleString()}행까지 업로드할 수 있습니다.`);
    const values: FormValues = { ...defaults };
    const errors: string[] = [];
    if (cells.slice(headers.length).some((c) => c.trim())) errors.push("제목이 없는 열에 값이 있습니다.");
    mapping.forEach((field, column) => {
      if (field) values[field.name] = normalizeValue(cells[column] ?? "", field);
    });
    for (const field of editable) {
      const value = values[field.name]?.trim() ?? "";
      if (field.required && !value) errors.push(`${field.label}: 필수 항목입니다.`);
      if (!value) continue;
      if (field.type === "select" && !field.options?.some((o) => o.value === value)) {
        errors.push(`${field.label}: ${field.options?.map((o) => o.label).join(" / ")} 중 선택하세요.`);
      }
      if (field.type === "number") {
        const number = Number(value);
        if (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(number)) errors.push(`${field.label}: 정수를 입력하세요.`);
        else if ((field.name.endsWith("Id") || ["headcount", "durationSeconds"].includes(field.name)) && number <= 0) errors.push(`${field.label}: 1 이상이어야 합니다.`);
        else if (["synergyScore", "contributionPercent"].includes(field.name) && (number < 0 || number > 100)) errors.push(`${field.label}: 0~100 범위여야 합니다.`);
      }
      if (field.name.endsWith("Email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${field.label}: 이메일 형식을 확인하세요.`);
      if (field.name === "companyIds" && value.split(",").some((id) => !/^[1-9]\d*$/.test(id.trim()) || !Number.isSafeInteger(Number(id.trim())))) errors.push(`${field.label}: 양의 정수 ID를 쉼표로 구분하세요.`);
    }
    const key = signature(values);
    if (existingSignatures.has(key)) errors.push("업로드 열의 값이 모두 같은 기존 항목이 있습니다.");
    if (fileSignatures.has(key)) errors.push("파일 안에 같은 항목이 중복되었습니다.");
    fileSignatures.add(key);
    rows.push({ line: index + 2, values, errors, status: "pending" });
  });
  if (!rows.length) throw new Error("제목 행 아래에 추가할 데이터를 입력해 주세요.");
  return rows;
}

export async function readExcel(file: File): Promise<string[][]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("엑셀 .xlsx 파일을 선택해 주세요. .xls 또는 CSV는 .xlsx로 저장 후 업로드해 주세요.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("5MB 이하의 엑셀 파일을 선택해 주세요.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("엑셀 파일을 읽을 수 없습니다. 암호를 해제하고 정상적인 .xlsx 파일인지 확인해 주세요.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || !sheet.actualRowCount) throw new Error("첫 번째 시트에 데이터가 없습니다.");
  if (sheet.rowCount > MAX_IMPORT_ROWS + 1) throw new Error(`첫 번째 시트는 제목을 제외하고 최대 ${MAX_IMPORT_ROWS.toLocaleString()}행까지 지원합니다. 불필요한 빈 행도 삭제해 주세요.`);
  if (sheet.columnCount > 100) throw new Error("사용하지 않는 열을 삭제해 주세요. 최대 100열까지 읽을 수 있습니다.");
  const grid: string[][] = [];
  for (let row = 1; row <= sheet.rowCount; row++) {
    const values: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      const cell = sheet.getCell(row, column);
      if (cell.type === 6) throw new Error(`${row}행 ${column}열에 수식이 있습니다. 값으로 붙여넣은 후 업로드해 주세요.`);
      if (cell.type === 10) throw new Error(`${row}행 ${column}열에 엑셀 오류 값이 있습니다.`);
      values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text);
    }
    grid.push(values);
  }
  return grid;
}

export async function downloadTemplate(title: string, fields: AdminField[], defaults: FormValues) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("데이터");
  const editable = fields.filter((f) => f.type !== "readonly");
  sheet.columns = editable.map((f) => ({ header: f.label, key: f.name, width: 25, style: { numFmt: "@" } }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.addRow(Object.fromEntries(editable.map((f) => [f.name, defaults[f.name] ?? ""])));
  const help = workbook.addWorksheet("작성 안내");
  help.columns = [{ header: "열 제목", width: 25 }, { header: "필수", width: 10 }, { header: "입력 안내", width: 80 }];
  editable.forEach((f) => help.addRow([f.label, f.required ? "필수" : "선택", f.options?.map((o) => `${o.label} (${o.value})`).join(" / ") || (f.type === "tags" ? "쉼표로 구분" : f.type === "number" ? "정수" : f.placeholder ?? "텍스트")]));
  help.addRow(["주의", "", "데이터 시트만 읽습니다. 기존 항목 수정·삭제 없이 새 항목을 추가합니다. 수식 대신 값을 입력하세요."]);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}_업로드_양식.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
