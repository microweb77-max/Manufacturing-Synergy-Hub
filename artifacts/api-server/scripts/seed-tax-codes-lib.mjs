// MST(사업자번호) 일회성 시드 — 순수 로직. DB 접근은 applyPlan 에서만 일어난다.

/** BOM 제거 + 따옴표/줄바꿈을 지원하는 최소 CSV 파서. 헤더 기준 객체 배열 반환. */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  const [header = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const normalizeName = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** 한쪽 이름이 다른 쪽을 포함하면 일치로 본다. */
export function namesMatch(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

export const isValidMst = (v) => /^\d{10}$/.test(v);

/**
 * @param {Record<string,string>[]} csvRows
 * @param {{id:number,name:string,tax_code:string|null}[]} dbRows
 */
export function buildPlan(csvRows, dbRows) {
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  const plan = {
    total: csvRows.length,
    targets: [], // {id, name, mst}
    skippedReview: [],
    invalidId: [],
    invalidMst: [],
    missing: [],
    nameMismatch: [],
    alreadySame: [],
    conflicts: [], // {id, name, existing, mst}
  };
  for (const r of csvRows) {
    if (r["검수필요"].toUpperCase() === "Y") { plan.skippedReview.push(r); continue; }
    const id = /^\d+$/.test(r.id) ? Number(r.id) : NaN;
    if (!Number.isSafeInteger(id)) { plan.invalidId.push(r); continue; }
    const mst = r["사업자번호(MST)"];
    if (!isValidMst(mst)) { plan.invalidMst.push({ id, name: r["회사명"], mst }); continue; }
    const db = byId.get(id);
    if (!db) { plan.missing.push({ id, name: r["회사명"] }); continue; }
    if (!namesMatch(db.name, r["회사명"])) {
      plan.nameMismatch.push({ id, csvName: r["회사명"], dbName: db.name });
      continue;
    }
    const existing = (db.tax_code ?? "").trim();
    if (existing) {
      if (existing === mst) plan.alreadySame.push({ id, name: db.name });
      else plan.conflicts.push({ id, name: db.name, existing, mst });
      continue;
    }
    plan.targets.push({ id, name: db.name, mst });
  }
  return plan;
}

/**
 * 하나의 트랜잭션으로 tax_code 만 갱신한다. 이미 값이 있는 행은 WHERE 절에서 다시 한 번 걸러진다.
 * @param {{query:(sql:string, params?:unknown[])=>Promise<{rowCount:number|null}>}} client
 */
export async function applyPlan(client, targets) {
  await client.query("BEGIN");
  try {
    const res = await client.query(
      `UPDATE companies c SET tax_code = v.mst
         FROM unnest($1::int[], $2::text[]) AS v(id, mst)
        WHERE c.id = v.id AND (c.tax_code IS NULL OR btrim(c.tax_code) = '')`,
      [targets.map((t) => t.id), targets.map((t) => t.mst)],
    );
    await client.query("COMMIT");
    return res.rowCount ?? 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export function formatSummary(plan, { apply, updated } = {}) {
  const n = (v) => v.toLocaleString("en-US");
  const lines = [
    `대상 ${n(plan.targets.length)}건 / 건너뜀 ${n(plan.skippedReview.length)}건(검수 필요) / 이미 값 있음 ${n(plan.alreadySame.length + plan.conflicts.length)}건 / 미발견 id ${n(plan.missing.length)}건`,
    `  (CSV ${n(plan.total)}행 · 회사명 불일치 ${plan.nameMismatch.length}건 · MST 형식 오류 ${plan.invalidMst.length}건 · id 오류 ${plan.invalidId.length}건)`,
  ];
  for (const c of plan.conflicts) lines.push(`⚠ 경고: id ${c.id} ${c.name} — DB 값 ${c.existing} ≠ CSV ${c.mst} (덮어쓰지 않음)`);
  for (const m of plan.nameMismatch) lines.push(`⚠ 건너뜀(회사명 불일치): id ${m.id} DB="${m.dbName}" CSV="${m.csvName}"`);
  for (const m of plan.invalidMst) lines.push(`⚠ 건너뜀(MST 형식): id ${m.id} ${m.name} "${m.mst}"`);
  for (const m of plan.missing) lines.push(`⚠ 건너뜀(미발견 id): ${m.id} ${m.name}`);
  for (const m of plan.invalidId) lines.push(`⚠ 건너뜀(id 오류): "${m.id}" ${m["회사명"]}`);
  const sample = plan.targets.slice(0, 10).map((t) => `id ${t.id} ${t.name} -> ${t.mst}`);
  if (sample.length) lines.push(`샘플 ${sample.length}건: ${sample.join(" | ")}`);
  lines.push(apply ? `적용 완료: ${n(updated ?? 0)}건 갱신` : "※ 실제 적용하려면 --apply 를 붙이세요. (현재 dry-run: 아무것도 쓰지 않았습니다)");
  return lines.join("\n");
}
