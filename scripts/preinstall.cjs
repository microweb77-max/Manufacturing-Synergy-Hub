// Cross-platform replacement for the former `sh -c` preinstall (works on Windows).
// Enforces pnpm and removes lockfiles of other package managers.
const fs = require("node:fs");
for (const f of ["package-lock.json", "yarn.lock"]) {
  try { fs.rmSync(f, { force: true }); } catch {}
}
const ua = process.env.npm_config_user_agent || "";
if (!ua.startsWith("pnpm/")) {
  console.error("Use pnpm instead (npm/yarn are not supported in this workspace).");
  process.exit(1);
}
