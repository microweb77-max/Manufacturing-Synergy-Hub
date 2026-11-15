// Local development runner (Windows / macOS / Linux) — not used on Replit.
//
//   1. copy .env.example to .env and fill in DATABASE_URL / ADMIN_PASSWORD
//   2. pnpm run dev:local
//
// Builds & starts the API server (port API_PORT, default 8080) and the Vite
// web dev server (port WEB_PORT, default 5173) with an /api proxy to the API.
// Open http://localhost:5173
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
} else {
  console.warn("[dev-local] .env not found — copy .env.example to .env first.");
}
if (!process.env.DATABASE_URL) {
  console.error("[dev-local] DATABASE_URL is not set (.env). Aborting.");
  process.exit(1);
}

const apiPort = process.env.API_PORT || "8080";
const webPort = process.env.WEB_PORT || "5173";
const apiDir = path.join(root, "artifacts", "api-server");
const webDir = path.join(root, "artifacts", "synergy-hub");
const isWin = process.platform === "win32";

console.log("[dev-local] building API server…");
const build = spawnSync(process.execPath, ["./build.mjs"], {
  cwd: apiDir,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const children = [];
function run(name, cmd, args, cwd, env) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit", shell: isWin });
  child.on("exit", (code) => {
    console.log(`[dev-local] ${name} exited (${code}). Stopping.`);
    for (const c of children) if (c !== child) c.kill();
    process.exit(code ?? 0);
  });
  children.push(child);
}

run("api", process.execPath, ["--enable-source-maps", "./dist/index.mjs"], apiDir, {
  NODE_ENV: "development",
  PORT: apiPort,
});
run("web", isWin ? "pnpm.cmd" : "pnpm", ["exec", "vite", "--config", "vite.config.ts", "--port", webPort], webDir, {
  PORT: webPort,
  BASE_PATH: "/",
  API_PROXY_TARGET: `http://localhost:${apiPort}`,
});

console.log(`[dev-local] open http://localhost:${webPort}  (API on :${apiPort}). Ctrl+C to stop.`);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { for (const c of children) c.kill(); process.exit(0); });
}
