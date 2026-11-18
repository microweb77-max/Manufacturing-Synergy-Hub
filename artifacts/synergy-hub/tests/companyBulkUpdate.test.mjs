import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { transformWithEsbuild } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = path.join(root, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const temp = await mkdtemp(path.join(cache, "bulk-update-"));
after(() => rm(temp, { recursive: true, force: true }));
// Strip the excelImport dependency (not needed for pure parsing) before transpiling.
let source = await readFile(path.join(root, "src/pages/admin/companyBulkUpdate.ts"), "utf8");
source = source.replace('import { readExcel } from "./excelImport";', "const readExcel = null;");
const { code } = await transformWithEsbuild(source, "companyBulkUpdate.ts", { loader: "ts", format: "esm" });
const modulePath = path.join(temp, "bulk.mjs");
await writeFile(modulePath, code);
const { buildBulkPreview, parseTags } = await import(pathToFileURL(modulePath).href);

const existing = [
  { id: 1, name: "A사", taxCode: null, phone: "010", capabilityTags: ["기존"], location: "하노이" },
  { id: 2, name: "B사", taxCode: "111", capabilityTags: [] },
];

test("blank cells keep existing values; only filled columns change", () => {
  const p = buildBulkPreview([["id", "name", "tax_code", "phone", "location"], ["1", "A사", "0312345678", "", ""], ["2", "", "", "", ""]], existing);
  assert.equal(p.items.length, 1);
  assert.deepEqual(p.items[0], { id: 1, row: 2, taxCode: "0312345678" });
  assert.equal(p.unchanged, 1);
  assert.deepEqual(p.columns, ["MST(사업자번호)"]);
});

test("unknown / missing / duplicate ids are errors and never created", () => {
  const p = buildBulkPreview([["id", "tax_code"], ["999", "1"], ["", "2"], ["1", "3"], ["1", "4"]], existing);
  assert.equal(p.items.length, 1);
  assert.deepEqual(p.errors.map((e) => e.row), [2, 3, 5]);
  assert.match(p.errors[0].reason, /id 999/);
});

test("capability tags are split by comma and trimmed; (비움) clears", () => {
  assert.deepEqual(parseTags(" 용접, 열처리 ,도장,용접"), ["용접", "열처리", "도장"]);
  const p = buildBulkPreview([["id", "capability_tags", "tax_code"], ["1", "용접, 열처리, 도장", ""], ["2", "(비움)", "(비움)"]], existing);
  assert.deepEqual(p.items[0].capabilityTags, ["용접", "열처리", "도장"]);
  assert.equal(p.items.find((i) => i.id === 2)?.taxCode, "(비움)");
});

test("id column and at least one updatable column are required", () => {
  assert.throws(() => buildBulkPreview([["tax_code"], ["1"]], existing), /id 열/);
  assert.throws(() => buildBulkPreview([["id"], ["1"]], existing), /수정할 열/);
  assert.throws(() => buildBulkPreview([["id", "bogus"], ["1", "x"]], existing), /지원하지 않는 열/);
});
