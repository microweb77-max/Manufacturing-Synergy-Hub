// Applies the Drizzle schema to the local DB using DATABASE_URL from .env.
// Usage: pnpm run db:push:local
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (.env). Aborting.");
  process.exit(1);
}
const isWin = process.platform === "win32";
const r = spawnSync(isWin ? "pnpm.cmd" : "pnpm", ["--filter", "@workspace/db", "run", "push"], {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
});
process.exit(r.status ?? 1);
