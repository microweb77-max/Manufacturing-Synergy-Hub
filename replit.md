# Manufacturing Synergy Hub (제조업 시너지 허브)

A B2B manufacturing collaboration network for Vietnam that matches hardware specialists (equipment, logistics, molding, robotics) with software specialists (MES, automation, ERP, machine-vision) via a synergy-score matching engine so they can co-sell joint solutions. UI is in Korean.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` — run codegen after edits.
- DB schema (source of truth): `lib/db/src/schema/{companies,projects,matches,solutions,performance}.ts` + barrel `index.ts`.
- API routes: `artifacts/api-server/src/routes/` (one router per domain), wired in `routes/index.ts`.
- Matching engine: `artifacts/api-server/src/lib/synergy.ts` (synergy score + recommendation reason).
- Date serialization helper: `artifacts/api-server/src/lib/serialize.ts`.
- Frontend: `artifacts/synergy-hub/src/` — pages in `src/pages/`, theme in `src/index.css`, routes in `src/App.tsx`.

## Architecture decisions

- Persistence uses Replit PostgreSQL + Drizzle, not the MSSQL the user originally mentioned (noted to user).
- Synergy score (0-100) blends required-tag coverage (60%), trust score (25%), and completed-project track record (15%).
- Creating a project auto-triggers the matching engine, inserting up to 5 pending matches for top synergy partners.
- Generated Zod response schemas expect ISO date-time strings, but Drizzle returns `Date` objects — route handlers wrap responses in `toJson()` (JSON round-trip) before `.parse()`.

## Product

Company capability directory, demand-project posting with smart partner matching (synergy score + reasons), a co-selling matchboard, joint-solution packages, and a contribution/performance board with a trust leaderboard. UI labels are in Korean.

On the new-company page, users can upload an existing promotional material (image or PDF); Gemini (via Replit AI Integrations) reads the text/visuals and auto-fills the registration form. Endpoint: `POST /companies/analyze-material` in `artifacts/api-server/src/routes/companies.ts`; the Gemini client lives in `lib/integrations-gemini-ai`.

## User preferences

- UI labels and user-facing text should be in Korean.
- User originally specified MSSQL; we use Replit PostgreSQL instead (accepted).

## Gotchas

- Always wrap API responses in `toJson()` before validating with generated Zod response schemas, or Date fields throw `invalid_type` ZodErrors.
- Workflow names are prefixed: `artifacts/<slug>: <service>` (e.g. `artifacts/api-server: API Server`).
- esbuild externalizes `@google/*` (see `api-server/build.mjs`), so `@google/genai` must be a DIRECT api-server dependency or the bundle fails at runtime with `ERR_MODULE_NOT_FOUND`. Import integration clients lazily inside handlers so a missing integration can't crash server startup.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
