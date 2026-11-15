import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { transformWithEsbuild } from "vite";
import ExcelJS from "exceljs";

// Use the existing Vite TS transformer without adding another test toolchain.
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = path.join(root, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const temp = await mkdtemp(path.join(cache, "excel-import-"));
after(() => rm(temp, { recursive: true, force: true }));
const source = await readFile(path.join(root, "src/pages/admin/excelImport.ts"), "utf8");
const { code } = await transformWithEsbuild(source, "excelImport.ts", { loader: "ts", format: "esm" });
const modulePath = path.join(temp, "excel-import.mjs");
await writeFile(modulePath, code);
const { validateImport, readExcel, downloadTemplate, MAX_IMPORT_ROWS, MAX_IMPORT_BYTES } = await import(pathToFileURL(modulePath).href);

const fields = [
  { name: "name", label: "기업명", type: "text", required: true },
  { name: "type", label: "유형", type: "select", required: true, options: [{ value: "supplier", label: "공급사" }, { value: "customer", label: "제조 (고객사)" }] },
  { name: "location", label: "지역", type: "text" },
  { name: "contactEmail", label: "이메일", type: "text" },
  { name: "phone", label: "전화번호", type: "text" },
  { name: "companyId", label: "기업 ID", type: "number" },
  { name: "capabilityTags", label: "역량 태그", type: "tags" },
  { name: "createdAt", label: "생성일", type: "readonly" },
];
const defaults = { name: "", type: "supplier", location: "", contactEmail: "", phone: "", companyId: "", capabilityTags: "" };
const check = (grid, existing = []) => validateImport(grid, fields, defaults, existing);
async function excelFile(rows) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("데이터");
  rows.forEach((row) => sheet.addRow(row));
  return new File([await book.xlsx.writeBuffer()], "업로드.xlsx");
}

test("Korean/English headers, select labels, defaults and leading zero text are preserved", () => {
  const [row] = check([["기업명", "유형", "phone", "역량 태그"], [" 새기업 ", "제조 (고객사)", "0012345", "CNC, 사출"]]);
  assert.deepEqual(row.errors, []);
  assert.equal(row.line, 2);
  assert.equal(row.values.name, "새기업");
  assert.equal(row.values.type, "customer");
  assert.equal(row.values.phone, "0012345");
  assert.equal(row.values.capabilityTags, "CNC, 사출");
  assert.equal(check([["name"], ["기본 공급사"]])[0].values.type, "supplier");
});
test("unknown, duplicate, missing and readonly headers fail instead of silently dropping data", () => {
  for (const grid of [
    [["ID", "기업명"], ["12", "기존기업"]],
    [["기업명", "name"], ["A", "B"]],
    [["지역"], ["하노이"]],
    [["기업명", "", "유형"], ["A", "숨은 값", "supplier"]],
    [["기업명", "생성일"], ["A", "2026-01-01"]],
  ]) assert.throws(() => check(grid));
});
test("all rows are validated with actual line numbers; empty rows do not become records", () => {
  const rows = check([["기업명", "유형"], ["", ""], ["", "supplier"], ["정상", "은행"]]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].line, 3);
  assert.match(rows[0].errors.join(), /필수/);
  assert.match(rows[1].errors.join(), /중 선택/);
});
test("duplicates within the file and current list are reported without modifying the list", () => {
  const existing = [{ ...defaults, name: "기존", location: "하노이" }];
  const snapshot = JSON.stringify(existing);
  const rows = check([["기업명", "지역"], ["기존", "하노이"], ["신규", "박닌"], [" 신규 ", "박닌"], ["기존", "호치민"]], existing);
  assert.match(rows[0].errors.join(), /기존 항목/);
  assert.deepEqual(rows[1].errors, []);
  assert.match(rows[2].errors.join(), /중복/);
  assert.deepEqual(rows[3].errors, []); // same company name, different branch/location
  assert.equal(JSON.stringify(existing), snapshot);
});
test("invalid integer IDs, emails and values in untitled columns are rejected", () => {
  for (const value of ["0", "-1", "1.5", "NaN", "9007199254740992"]) {
    assert.match(check([["기업명", "기업 ID"], ["A", value]])[0].errors.join(), /정수|이상/);
  }
  assert.equal(check([["기업명", "기업 ID"], ["A", "1,234"]])[0].values.companyId, "1234");
  assert.match(check([["기업명", "이메일"], ["A", "not-email"]])[0].errors.join(), /이메일/);
  assert.match(check([["기업명"], ["A", "추가 값"]])[0].errors.join(), /제목이 없는/);
});
test("an empty sheet and an oversized batch cannot be imported", () => {
  assert.throws(() => check([]), /데이터/);
  assert.throws(() => check([["기업명"]]), /데이터/);
  assert.throws(() => check([["기업명"], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [`업체${i}`])]), /최대/);
});
test("real XLSX bytes are parsed, including text phone numbers and dates", async () => {
  const grid = await readExcel(await excelFile([["기업명", "전화번호", "마감일"], ["A", "00123", new Date("2026-12-01T00:00:00Z")]]));
  assert.deepEqual(grid[1], ["A", "00123", "2026-12-01"]);
});
test("malformed, oversized and unsupported files, formulas and Excel errors are blocked", async () => {
  await assert.rejects(readExcel(new File(["name"], "data.csv")), /\.xlsx/);
  await assert.rejects(readExcel(new File(["bad"], "data.xlsx")), /읽을 수 없/);
  await assert.rejects(readExcel(new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], "large.xlsx")), /5MB/);
  await assert.rejects(readExcel(await excelFile([["기업명"], [{ formula: 'HYPERLINK("https://example.com","A")', result: "A" }]])), /수식/);
  await assert.rejects(readExcel(await excelFile([["기업명"], [{ error: "#REF!" }]])), /오류 값/);
});
test("downloaded template has editable headers only and includes field guidance", async () => {
  let captured;
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const anchor = { click() {}, href: "", download: "" };
  globalThis.document = { createElement: () => anchor };
  URL.createObjectURL = (blob) => { captured = blob; return "blob:test"; };
  URL.revokeObjectURL = () => {};
  try {
    await downloadTemplate("기업", fields, defaults);
    assert.equal(anchor.download, "기업_업로드_양식.xlsx");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await captured.arrayBuffer());
    assert.equal(book.worksheets[0].name, "데이터");
    assert.deepEqual(book.worksheets[0].getRow(1).values.slice(1), fields.filter((f) => f.type !== "readonly").map((f) => f.label));
    assert.match(book.worksheets[1].getRow(3).getCell(3).text, /공급사/);
  } finally {
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
