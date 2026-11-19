import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, test } from "node:test";
import { eq, like } from "drizzle-orm";
import { db, pool, companiesTable } from "@workspace/db";
// @ts-expect-error plain .mjs operator script module (no type declarations)
import { applyPlan, buildPlan, formatSummary, namesMatch, parseCsv } from "../scripts/seed-tax-codes-lib.mjs";

const MARK = "ZZ-TEST-SEED-";
const csvPath = path.resolve(process.cwd(), "../../attached_assets/kovima_mst_1421_v2_1791278203983.csv");

after(async () => {
  await db.delete(companiesTable).where(like(companiesTable.name, `${MARK}%`));
  await pool.end();
});

const csv = (rows: string[]) =>
  "﻿id,회사명,구분,업종,지역,주소,사업자번호(MST),근거출처수,판정,재조회교정,중복그룹,검수필요\n" + rows.join("\n");

test("repository CSV: 1,421 rows, 140 flagged for review, 1,281 targets", async () => {
  const rows = parseCsv(await readFile(csvPath, "utf8"));
  assert.equal(rows.length, 1421);
  const plan = buildPlan(rows, rows.map((r: Record<string, string>) => ({ id: Number(r.id), name: r["회사명"], tax_code: null })));
  assert.equal(plan.skippedReview.length, 140);
  assert.equal(plan.targets.length, 1281);
});

test("parseCsv strips BOM and handles quoted commas", () => {
  const rows = parseCsv(csv(['1,A,x,y,z,"a, b",0123456789,1,ok,,g,']));
  assert.equal(rows[0].id, "1");
  assert.equal(rows[0]["주소"], "a, b");
  assert.equal(rows[0]["사업자번호(MST)"], "0123456789");
});

test("buildPlan classifies rows and namesMatch is containment-based", () => {
  assert.ok(namesMatch("DAHAM VINA CO., LTD", "daham"));
  assert.ok(!namesMatch("ABC", "XYZ"));
  const rows = parseCsv(csv([
    "1,AAA,,,,,1111111111,,,,,",
    "2,BBB,,,,,2222222222,,,,,Y",
    "3,CCC,,,,,333,,,,,",
    "4,DDD,,,,,4444444444,,,,,",
    "5,EEE,,,,,5555555555,,,,,",
    "6,FFF,,,,,6666666666,,,,,",
    "7,GGG,,,,,7777777777,,,,,",
    "8,HHH,,,,,8888888888,,,,,",
  ]));
  const plan = buildPlan(rows, [
    { id: 1, name: "AAA", tax_code: null },
    { id: 2, name: "BBB", tax_code: null },
    { id: 3, name: "CCC", tax_code: null },
    { id: 5, name: "other", tax_code: null },
    { id: 6, name: "FFF", tax_code: "6666666666" },
    { id: 7, name: "GGG", tax_code: "9999999999" },
    { id: 8, name: "HHH", tax_code: "" },
  ]);
  assert.deepEqual(plan.targets.map((t: { id: number }) => t.id), [1, 8]);
  assert.equal(plan.skippedReview.length, 1);
  assert.equal(plan.invalidMst.length, 1);
  assert.equal(plan.missing.length, 1);
  assert.equal(plan.nameMismatch.length, 1);
  assert.equal(plan.alreadySame.length, 1);
  assert.equal(plan.conflicts.length, 1);
  assert.match(formatSummary(plan), /경고: id 7/);
  assert.match(formatSummary(plan), /--apply/);
});

test("applyPlan writes only tax_code, never overwrites, and is idempotent", async () => {
  const [a, b, c] = await db.insert(companiesTable).values([
    { name: `${MARK}A`, type: "supplier", phone: "010", location: "Hanoi" },
    { name: `${MARK}B`, type: "supplier", taxCode: "0000000001" },
    { name: `${MARK}C`, type: "supplier" },
  ]).returning();
  const before = [a, b, c];
  const rows = parseCsv(csv([
    `${a.id},${MARK}A,,,,,1111111111,,,,,`,
    `${b.id},${MARK}B,,,,,2222222222,,,,,`,
    `${c.id},${MARK}C,,,,,3333333333,,,,,Y`,
  ]));
  const load = async () => (await db.select().from(companiesTable).where(like(companiesTable.name, `${MARK}%`)))
    .map((r) => ({ id: r.id, name: r.name, tax_code: r.taxCode }));
  const client = await pool.connect();
  try {
    const plan1 = buildPlan(rows, await load());
    assert.equal(await applyPlan(client, plan1.targets), 1);
    const afterRows = await db.select().from(companiesTable).where(like(companiesTable.name, `${MARK}%`));
    const byId = new Map(afterRows.map((r) => [r.id, r]));
    assert.equal(byId.get(a.id)!.taxCode, "1111111111");
    assert.equal(byId.get(b.id)!.taxCode, "0000000001");
    assert.equal(byId.get(c.id)!.taxCode, null);
    for (const o of before) {
      const n = byId.get(o.id)!;
      assert.deepEqual({ ...n, taxCode: null }, { ...o, taxCode: null }); // tax_code 외 컬럼 불변
    }
    const plan2 = buildPlan(rows, await load());
    assert.equal(plan2.targets.length, 0);
    assert.equal(await applyPlan(client, plan2.targets), 0);
  } finally {
    client.release();
  }
});

test("applyPlan rolls back everything on failure", async () => {
  const [a] = await db.insert(companiesTable).values([{ name: `${MARK}R`, type: "supplier" }]).returning();
  const client = await pool.connect();
  try {
    // UPDATE 는 성공하지만 COMMIT 이 실패하는 상황 → 전부 롤백되어야 한다.
    const failingCommit = {
      query: (sql: string, params?: unknown[]) =>
        sql === "COMMIT" ? Promise.reject(new Error("commit failed")) : client.query(sql, params),
    };
    await assert.rejects(applyPlan(failingCommit, [{ id: a.id, name: "x", mst: "1234567890" }]), /commit failed/);
    const [row] = await db.select().from(companiesTable).where(eq(companiesTable.id, a.id));
    assert.equal(row.taxCode, null);
  } finally {
    client.release();
  }
});
