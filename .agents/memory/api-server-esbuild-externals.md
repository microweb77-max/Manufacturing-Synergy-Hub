---
name: api-server esbuild externals + integration client init
description: Why a transitive runtime dep can crash the bundled api-server at startup, and how to wire AI-integration clients safely.
---

# api-server esbuild bundling: externalized packages need direct deps

The api-server is bundled by `artifacts/api-server/build.mjs` (esbuild, ESM). Its `external` list intentionally excludes many packages from the bundle, including the glob `@google/*` (and other native-ish or path-traversing packages).

**Rule:** any package that matches the `external` list AND is imported at runtime must be a *direct* dependency of `@workspace/api-server` — not just a transitive dep of a workspace lib. Otherwise the bundle keeps the bare `import "@google/genai"`, and at runtime Node throws `ERR_MODULE_NOT_FOUND` because pnpm only links it under the lib's own `node_modules`, not the api-server's.

**Why:** esbuild leaves externalized imports as-is; Node then resolves them relative to `dist/`, which only sees api-server's `node_modules`. Symlink for a direct dep is created by pnpm; transitive deps live elsewhere in the pnpm store.

**How to apply:** when adding a `lib/integrations-*` package (or any lib that pulls in an externalized runtime package), add that underlying package (e.g. `@google/genai`) to `artifacts/api-server/package.json` dependencies too, then `pnpm install`. Verify with `ls artifacts/api-server/node_modules/@google/`.

The same resolution constraint applies to bundled tests: `packages: "external"`
leaves workspace TypeScript exports uncompiled, and bundling a workspace library
does not make its external dependencies available beside the emitted test.

**Why:** Node resolves bare imports from the emitted bundle, not from the original
workspace library. A test can first fail on an unknown `.ts` extension, then fail
on a library-only dependency after the TypeScript source is bundled.

**How to apply:** bundle workspace sources explicitly and resolve library-only
externals to their owning package's installation, or declare them directly in the
bundle-owning package. Keep this dependency-resolution check separate from
business-policy test failures.

# AI-integration clients throw at import time — load lazily in handlers

`lib/integrations-gemini-ai/src/client.ts` throws at module-eval time if `AI_INTEGRATIONS_GEMINI_*` env vars are missing. A top-level `import { ai }` in a route file therefore couples *all* routes in that file to the integration: missing env crashes API startup, not just the AI feature.

**Rule:** import the integration client lazily inside the handler (`const { ai } = await import("@workspace/integrations-gemini-ai")` in a try/catch) so a misconfigured integration degrades to a controlled 503 instead of taking down the whole server.

**Also:** Express default JSON body limit is 100kb — too small for base64 file uploads. The analyze-material feature raised it to `12mb` in `app.ts` to fit the 7MB file cap after base64 expansion.
