// One-off, development-only replacement approved by the user.
// Defaults to a dry run; never install this in a build/startup/publish hook.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";

const requireDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = requireDb("pg");
const csvPath = process.argv.find((arg) => arg.endsWith(".csv"));
const apply = process.argv.includes("--apply-development");
if (!csvPath) throw new Error("Pass the approved CSV file path.");
if (process.env.NODE_ENV === "production") throw new Error("Development only.");

const parsed = spawnSync("python3", ["-c", `
import csv,json,sys
with open(sys.argv[1], encoding="utf-8-sig", newline="") as f:
    print(json.dumps(list(csv.DictReader(f)), ensure_ascii=False))
`, resolve(csvPath)], { encoding: "utf8", maxBuffer: 2_000_000 });
if (parsed.status !== 0) throw new Error("CSV parsing failed.");
const sourceRows = JSON.parse(parsed.stdout);
const incoming = sourceRows.map((r) => ({
  id: Number(r.id),
  name: r["회사명"],
  type: r["구분"] === "고객사(제조)" ? "customer" : r["구분"] === "공급사" ? "supplier" : null,
  description: r["업종"],
  location: `${r["지역"]} — ${r["주소"]}`,
  tax_code: r["사업자번호(MST)"],
}));
if (incoming.length !== 1421 || new Set(incoming.map((r) => r.id)).size !== 1421)
  throw new Error("Expected exactly 1,421 unique companies.");
for (const r of incoming) {
  if (!Number.isSafeInteger(r.id) || r.id <= 0 || !r.name || !r.type ||
      !r.description || !/^\d{10}(\d{3})?$/.test(r.tax_code))
    throw new Error(`Invalid company row ${r.id}.`);
}
const ids = incoming.map((r) => r.id);
const incomingById = new Map(incoming.map((r) => [r.id, r]));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const mutableTables = ["companies", "matches", "supply_offers", "solutions"];

async function snapshotHashes(tables) {
  const result = {};
  for (const t of tables) {
    result[t] = (await client.query(
      `SELECT count(*)::int AS count,
       md5(coalesce(string_agg(to_jsonb(x)::text, E'\\n' ORDER BY to_jsonb(x)::text), '')) AS hash
       FROM "${t}" x`,
    )).rows[0];
  }
  return result;
}

try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  await client.query("SET LOCAL lock_timeout = '10s'");
  const tables = (await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",
    ["public"],
  )).rows.map((r) => r.tablename);
  if (tables.some((t) => !/^[a-z_][a-z0-9_]*$/.test(t))) throw new Error("Invalid identifier.");
  await client.query(`LOCK TABLE ${tables.map((t) => `"${t}"`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
  const companiesBefore = (await client.query("SELECT * FROM companies ORDER BY id")).rows;
  const beforeById = new Map(companiesBefore.map((r) => [r.id, r]));
  for (const r of incoming) {
    if (beforeById.get(r.id)?.name !== r.name)
      throw new Error(`ID/name mismatch for ${r.id}; replacement stopped.`);
  }
  const removedIds = companiesBefore.filter((r) => !incomingById.has(r.id)).map((r) => r.id);

  // Stop if new dependencies have appeared since the user's deletion approval.
  const referenceColumns = (await client.query(
    `SELECT table_name,column_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name IN ('company_id','owner_company_id')`,
  )).rows;
  for (const { table_name: table, column_name: column } of referenceColumns) {
    if (["matches", "supply_offers"].includes(table)) continue;
    if (!tables.includes(table) || !["company_id", "owner_company_id"].includes(column))
      throw new Error("Unexpected dependency identifier.");
    const result = await client.query(
      `SELECT count(*)::int AS count FROM "${table}" WHERE "${column}"=ANY($1::int[])`,
      [removedIds],
    );
    if (result.rows[0].count) throw new Error(`Unapproved dependent records in ${table}.`);
  }
  const matchesBefore = (await client.query("SELECT * FROM matches ORDER BY id")).rows;
  const offersBefore = (await client.query("SELECT * FROM supply_offers ORDER BY id")).rows;
  const solutionsBefore = (await client.query("SELECT * FROM solutions ORDER BY id")).rows;
  const removedSet = new Set(removedIds);
  const affectedMatches = matchesBefore.filter((r) => removedSet.has(r.company_id));
  const affectedOffers = offersBefore.filter((r) => removedSet.has(r.company_id));
  // Also remove stale references to old company IDs already absent from the DB.
  const affectedSolutions = solutionsBefore.filter((r) => r.company_ids.some((id) => !incomingById.has(id)));
  if (affectedMatches.length > 4 || affectedOffers.length > 10 || affectedSolutions.length > 2)
    throw new Error("Deletion scope has grown beyond the user's approval.");
  const offerMatches = await client.query(
    "SELECT count(*)::int AS count FROM offer_matches WHERE offer_id=ANY($1::int[])",
    [affectedOffers.map((r) => r.id)],
  );
  if (offerMatches.rows[0].count) throw new Error("Unapproved offer-match dependencies.");
  const unchangedTables = tables.filter((t) => !mutableTables.includes(t));
  const unchangedBefore = await snapshotHashes(unchangedTables);
  const plan = {
    before: companiesBefore.length, after: incoming.length, removeCompanies: removedIds.length,
    removeMatches: affectedMatches.length, removeOffers: affectedOffers.length,
    detachSolutions: affectedSolutions.length, customer: incoming.filter((r) => r.type === "customer").length,
    supplier: incoming.filter((r) => r.type === "supplier").length,
    includesReviewFlagged: sourceRows.filter((r) => r["검수필요"] === "Y").length,
  };
  if (!apply) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ dryRun: true, ...plan }, null, 2));
  } else {
    const backupDir = resolve(".local/private-data-backups");
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = resolve(backupDir, `member-replacement-${Date.now()}.json`);
    writeFileSync(backupPath, JSON.stringify({
      companies: companiesBefore, matches: matchesBefore,
      supply_offers: offersBefore, solutions: solutionsBefore,
    }), { mode: 0o600, flag: "wx" });

    await client.query(
      `UPDATE companies c SET name=u.name,type=u.type,description=u.description,
       location=u.location,tax_code=u.tax_code
       FROM jsonb_to_recordset($1::jsonb)
       AS u(id integer,name text,type text,description text,location text,tax_code text)
       WHERE c.id=u.id`,
      [JSON.stringify(incoming)],
    );
    await client.query("DELETE FROM matches WHERE company_id=ANY($1::int[])", [removedIds]);
    await client.query("DELETE FROM supply_offers WHERE company_id=ANY($1::int[])", [removedIds]);
    for (const s of affectedSolutions) {
      await client.query("UPDATE solutions SET company_ids=$1 WHERE id=$2",
        [s.company_ids.filter((id) => incomingById.has(id)), s.id]);
    }
    await client.query("DELETE FROM companies WHERE id=ANY($1::int[])", [removedIds]);

    const companiesAfter = (await client.query("SELECT * FROM companies ORDER BY id")).rows;
    if (companiesAfter.length !== incoming.length) throw new Error("Final company count mismatch.");
    for (const r of companiesAfter) {
      const expected = { ...beforeById.get(r.id), ...incomingById.get(r.id) };
      if (!isDeepStrictEqual(expected, r)) throw new Error(`Company preservation mismatch: ${r.id}.`);
    }
    const expectedMatches = matchesBefore.filter((r) => !removedSet.has(r.company_id));
    const expectedOffers = offersBefore.filter((r) => !removedSet.has(r.company_id));
    const expectedSolutions = solutionsBefore.map((r) => ({
      ...r, company_ids: r.company_ids.filter((id) => incomingById.has(id)),
    }));
    for (const [table, expected] of [
      ["matches", expectedMatches], ["supply_offers", expectedOffers], ["solutions", expectedSolutions],
    ]) {
      const actual = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
      if (!isDeepStrictEqual(expected, actual)) throw new Error(`Dependent verification failed: ${table}.`);
    }
    if (!isDeepStrictEqual(unchangedBefore, await snapshotHashes(unchangedTables)))
      throw new Error("Unexpected change to unrelated data.");
    await client.query("COMMIT");
    console.log(JSON.stringify({
      committed: true, ...plan, csvMatchesExactly: true,
      retainedContactAndOtherFieldsPreserved: true, unrelatedTablesUnchanged: true, backupPath,
    }, null, 2));
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Replacement stopped; transaction rolled back:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
