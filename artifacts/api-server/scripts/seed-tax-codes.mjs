// 일회성 수동 시드: 저장소 CSV 의 MST 를 companies.tax_code 에만 채운다.
// 기본은 dry-run. --apply 를 붙여야 쓴다. 서버 시작/빌드/배포 경로에서 호출하지 말 것.
//   pnpm --filter @workspace/api-server db:seed:tax-codes
//   pnpm --filter @workspace/api-server db:seed:tax-codes -- --apply
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyPlan, buildPlan, formatSummary, parseCsv } from "./seed-tax-codes-lib.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fileArg = args.find((a) => a.startsWith("--file="))?.slice("--file=".length);
const csvPath = fileArg ?? fileURLToPath(new URL("../../../attached_assets/kovima_mst_1421_v2_1791278203983.csv", import.meta.url));

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");

// @workspace/db 와 같은 pg 를 같은 DATABASE_URL 로 사용한다 (db 패키지는 TS 소스라 node 로 직접 import 할 수 없음).
const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const pg = requireFromDb("pg");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const csvRows = parseCsv(await readFile(csvPath, "utf8"));
  const { rows } = await client.query("SELECT id, name, tax_code FROM companies");
  const plan = buildPlan(csvRows, rows);
  const updated = apply ? await applyPlan(client, plan.targets) : 0;
  console.info(formatSummary(plan, { apply, updated }));
} finally {
  await client.end();
}
