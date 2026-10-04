import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifact = fileURLToPath(new URL("../", import.meta.url));
const cache = path.join(artifact, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const temp = await mkdtemp(path.join(cache, "auth-tests-"));
try {
  const output = path.join(temp, "tests.mjs");
  await build({
    entryPoints: [path.join(artifact, "tests/authorization.test.ts")],
    outfile: output, bundle: true, packages: "external", platform: "node", format: "esm",
    // Source test route discovery must stay relative to its original file.
    define: { "import.meta.url": JSON.stringify(new URL("./authorization.test.ts", import.meta.url).href) },
  });
  const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}