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

Company capability directory, demand-project posting with smart partner matching (synergy score + reasons), a co-selling matchboard, joint-solution packages, and a talent pool (인력 Pool) where companies post hiring openings (구인) and individuals post job-seeking profiles (구직). UI labels are in Korean.

A 고객사 디렉토리 (`/client-companies`, in the sidebar nav) lists 1,221 Korean FDI manufacturing companies in Vietnam (KOTRA directory 2024.12), with client-side search, region/industry filters, and pagination. This is static reference data served from a bundled JSON file (`artifacts/api-server/src/data/clientCompanies.json`, imported in `routes/clientCompanies.ts`, requires `resolveJsonModule` in the api-server tsconfig) via `GET /client-companies` — no DB table, so it works identically in dev and prod with no seeding. Frontend page: `artifacts/synergy-hub/src/pages/client-companies/index.tsx`. This is distinct from 기업 디렉토리 (`/companies`), the platform's own registered partner companies.

An ADMIN console (`/admin`, NOT in the sidebar nav — direct URL only) provides full create/edit/delete for all 6 entities (companies, projects, matches, solutions, performance, talent) via tabs. Built on a generic `src/pages/admin/AdminSection.tsx` (table + create/edit Dialog form + delete AlertDialog) with thin per-entity wrappers in `src/pages/admin/index.tsx` wiring the generated orval hooks. Note: matches "update" sends status only (MatchUpdate); project "create" omits status (ProjectInput); these per-entity body shapes are built explicitly in each wrapper. The app has NO auth, so `/admin` is publicly reachable.

The talent pool replaced the former performance/trust-leaderboard board in the sidebar. Talent schema: `lib/db/src/schema/talent.ts` (`talent_posts`); API routes: `artifacts/api-server/src/routes/talent.ts` (GET `/talent` with `postType` filter, POST `/talent`, DELETE `/talent/{id}`); frontend page: `artifacts/synergy-hub/src/pages/talent/index.tsx`. The performance backend (schema/routes) remains but is no longer linked in the frontend nav.

On the new-company page, users can upload an existing promotional material (image or PDF); Gemini (via Replit AI Integrations) reads the text/visuals and auto-fills the registration form. Endpoint: `POST /companies/analyze-material` in `artifacts/api-server/src/routes/companies.ts`; the Gemini client lives in `lib/integrations-gemini-ai`.

A 공급 오퍼 / 오퍼 매칭 (supply-offer marketplace) lets 기업 디렉토리 companies post supply offers (원재료/자재/부자재/기타, 품명, 단가, 단위, 통화, 최소주문수량) and lets 고객사 (from the 1,221-row KOTRA 고객사 디렉토리) request a match against an offer. Schema: `lib/db/src/schema/offers.ts` (`supply_offers`, `offer_matches`). API: `artifacts/api-server/src/routes/supplyOffers.ts` (GET list w/ `category`+`search`, POST, PATCH, DELETE; leftJoin companies for `companyName`) and `offerMatches.ts` (GET, POST, PATCH, DELETE; leftJoin offers+companies for `itemName`/`supplierCompanyName`). Public frontend page: `/offers` (오퍼 리스트, in sidebar nav) — offer list + search + category filter, a 공급 오퍼 등록 dialog (supplier picks a company from 기업 디렉토리), and a 매칭 요청 dialog (client searches the 1,221-row 고객사 디렉토리, then submits contact + message). Match status enum: `pending|reviewing|matched|rejected`. The matching process & results are surfaced ONLY in the ADMIN console (`/admin`) via two tabs: 공급 오퍼 (full CRUD) and 오퍼 매칭 (view + status/adminNote update + delete, `canCreate={false}` since matches originate from the public side). Like every other admin function in this no-auth app, offer-match endpoints are not server-side restricted — admin-only here means surfaced only in the URL-only `/admin` UI, never on public pages (the public `/offers` page never lists matches).

## User preferences

- UI labels and user-facing text should be in Korean.
- User originally specified MSSQL; we use Replit PostgreSQL instead (accepted).

## Gotchas

- Always wrap API responses in `toJson()` before validating with generated Zod response schemas, or Date fields throw `invalid_type` ZodErrors.
- Workflow names are prefixed: `artifacts/<slug>: <service>` (e.g. `artifacts/api-server: API Server`).
- esbuild externalizes `@google/*` (see `api-server/build.mjs`), so `@google/genai` must be a DIRECT api-server dependency or the bundle fails at runtime with `ERR_MODULE_NOT_FOUND`. Import integration clients lazily inside handlers so a missing integration can't crash server startup.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
