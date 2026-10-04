import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifact = fileURLToPath(new URL("../", import.meta.url));
const cache = path.join(artifact, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const temp = await mkdtemp(path.join(cache, "auth-tests-"));
const databaseDependency = {
  name: "database-dependency-location",
  setup(builder) {
    builder.onResolve({ filter: /^pg$/ }, () => ({
      path: path.resolve(artifact, "../../lib/db/node_modules/pg/lib/index.js"),
      external: true,
    }));
  },
};
try {
  const output = path.join(temp, "tests.mjs");
  await build({
    entryPoints: [path.join(artifact, "tests/authorization.test.ts")],
    outfile: output, bundle: true, packages: "external", platform: "node", format: "esm",
    alias: { "@workspace/db": path.resolve(artifact, "../../lib/db/src/index.ts"), "@workspace/api-zod": path.resolve(artifact, "../../lib/api-zod/src/index.ts") },
    plugins: [databaseDependency],
    // Source test route discovery must stay relative to its original file.
    define: { "import.meta.url": JSON.stringify(new URL("./authorization.test.ts", import.meta.url).href) },
  });
  const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
  const membershipOutput = path.join(temp, "membership.mjs");
  await build({
    entryPoints: [path.join(artifact, "tests/membership.test.ts")],
    outfile: membershipOutput, bundle: true, packages: "external", platform: "node", format: "esm",
    alias: { "@workspace/db": path.resolve(artifact, "../../lib/db/src/index.ts"), "@workspace/api-zod": path.resolve(artifact, "../../lib/api-zod/src/index.ts") },
    plugins: [databaseDependency],
  });
  const membershipResult = spawnSync(process.execPath, ["--test", membershipOutput], { stdio: "inherit" });
  if (membershipResult.status !== 0) process.exitCode = membershipResult.status ?? 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}