# Manufacturing Synergy Hub (제조업 시너지 허브)

A B2B manufacturing collaboration network for Vietnam that matches hardware specialists (equipment, logistics, molding, robotics) with software specialists (MES, automation, ERP, machine-vision) via a synergy-score matching engine so they can co-sell joint solutions. UI is in Korean.

Companies have a `type` of `hardware` | `software` | `service` (서비스: 컨설팅/유지보수/엔지니어링). The `type` enum is defined in `lib/api-spec/openapi.yaml` (5 occurrences — regenerate codegen after edits) and is plain `text` in the DB (no migration needed to add a value). Frontend rendering of a company type (label/icon/badge color/icon color) is centralized in `artifacts/synergy-hub/src/lib/companyType.ts` (`getCompanyTypeMeta()` with a hardware fallback) — use it instead of `type === "hardware" ? ... : ...` ternaries. Backend type-label strings (synergy reason, dashboard activity, the analyze-material Gemini prompt) are separate inline 3-way maps in api-server.

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

An ADMIN console (`/admin`, NOT in the sidebar nav — direct URL only) provides full create/edit/delete for all entities via tabs, plus an `AdminDashboard` summary-count card row at the top. Built on a generic `src/pages/admin/AdminSection.tsx` with thin per-entity wrappers in `src/pages/admin/index.tsx` wiring the generated orval hooks. `AdminSection` supports optional, backward-compatible props: `getSearchText`/`searchPlaceholder` (toolbar search), `filters` (AdminFilter[] → select dropdowns, with an `__all__` sentinel for "전체"), per-column `sortValue` (tri-state asc→desc→none sortable headers), `pageSize` (client-side pagination, default 10), and `headerActions` (extra header controls). `AdminField.type` includes an `"image"` type (used by company `logoUrl` + solution `imageUrl`): rendered by the in-file `AdminImageField`, it shows a URL text input PLUS a direct file-upload button that converts the picked image to a base64 data URL stored in the same field value (raster-only allow-list, ≤2MB, thumbnail preview + remove + onError fallback). `AdminField.type` also includes a `"readonly"` type: renders the value in a non-editable bordered block (`whitespace-pre-wrap` for multiline) — used by the 오퍼 매칭 admin tab to display request content (고객사/담당자/연락처/요청일/요청 메시지) that must be viewable but never edited; still included in `values`/`toFormValues` but ignored by the entity's `onUpdate` body builder. Same inline-base64 storage as the company new-page logo; no object storage. Company `logoUrl` is server-validated via `validateLogoUrl`; solution `imageUrl` is NOT server-validated (pre-existing). The table = table + create/edit Dialog form + delete AlertDialog. Note: matches "update" sends status only (MatchUpdate); project "create" omits status (ProjectInput); these per-entity body shapes are built explicitly in each wrapper. The app has NO auth, so `/admin` is publicly reachable.

The talent pool replaced the former performance/trust-leaderboard board in the sidebar. Talent schema: `lib/db/src/schema/talent.ts` (`talent_posts`, incl. `source` + `sourceUrl` columns marking auto-collected posts); API routes: `artifacts/api-server/src/routes/talent.ts` (GET `/talent` with `postType` filter, POST `/talent`, PATCH/DELETE `/talent/{id}`); frontend page: `artifacts/synergy-hub/src/pages/talent/index.tsx`. The `/talent` page has 5 client-side filters over the tab-scoped posts (computed via `useMemo`): a free-text 검색 (matches title/authorName/description/position/location/skills), plus 직무(position)/지역(location)/고용형태(employmentType)/경력(experienceLevel) `Select` dropdowns whose options are derived dynamically from the loaded posts via `distinctValues()` (trims + sorts). Equality predicates `.trim()` the post field before comparing (options are trimmed, so raw whitespace would otherwise hide rows). Filters reset on tab change via `useEffect([tab])` (covers both UI and programmatic `setTab`). A result count (`N건 / 전체 M건`) and a no-results empty state with a 초기화 button are shown. The performance backend (schema/routes) remains but is no longer linked in the frontend nav.

The 자동 수집 (auto-collection) system is ADMIN-only (UI) and collects BOTH 구인 (hiring) AND 구직 (job-seeking) posts: the trigger (`CollectJobsControl`, a region-focus dialog) takes a `postType: "hiring" | "seeking"` prop and is rendered twice (구인 정보 자동 수집 / 구직 정보 자동 수집) in the `/admin` 인력 Pool tab, passed to `AdminSection` as `headerActions`. The public `/talent` page only DISPLAYS collected posts (자동수집 badge + 출처 보기 link), with no collect button. Like all admin functions in this no-auth app, the endpoint itself is not server-side restricted. Backend: `POST /talent/collect-jobs` (body: optional `region` focus + optional `postType` enum [hiring, seeking], default hiring) uses Gemini (gemini-2.5-flash) in two steps — (1) a grounded call with `tools: [{ googleSearch: {} }]` to pull real, current Vietnam manufacturing data from the live web (channel job postings for hiring, or job-seeker/talent profiles for seeking — both `searchPrompt` and `structurePrompt` branch on `postType`), then (2) a JSON-structuring call (`responseMimeType: application/json`) — then dedupes against existing posts OF THE SAME postType by lowercased `title__authorName` and inserts them with the requested `postType`, `source='auto'`, and a per-job `sourceUrl` (the model picks from the grounding chunk URLs; we validate the picked URL is in the grounding allow-list to block hallucinated links, else fall back to the first chunk). Google Search grounding DOES work through the Replit AI proxy, but ONLY when the Gemini client sets `httpOptions.apiVersion: ""` (the project client already does); the default `/v1beta/` path returns `INVALID_ENDPOINT`. The endpoint is expensive + public (no-auth app), so it has an in-memory guard: a single-flight `collectInProgress` flag shared across both types (concurrent calls → 429) and a per-postType 30s cooldown (`lastCollectAt` record keyed by postType, `COLLECT_COOLDOWN_MS`) so collecting 구인 doesn't block 구직. Auto-collected cards show a 자동수집 badge and a 출처 보기 link.

On the new-company page, users can upload an existing promotional material (image or PDF); Gemini (via Replit AI Integrations) reads the text/visuals and auto-fills the registration form. Endpoint: `POST /companies/analyze-material` in `artifacts/api-server/src/routes/companies.ts`; the Gemini client lives in `lib/integrations-gemini-ai`.

The new-company form also has an optional 회사 로고 upload: the image is read client-side as a base64 data URL and sent as `logoUrl` in the create body (no object storage — stored inline in the `companies.logo_url` text column). The company detail page (`companies/[id].tsx`) renders `company.logoUrl` or falls back to a type-based placeholder icon (Factory/Monitor). The server hardens this via `validateLogoUrl()` in `routes/companies.ts` (used by both POST and PATCH): it allow-lists only raster image data URLs (`data:image/(png|jpe?g|webp|gif);base64,...`, ≤2MB decoded) or plain `https://` URLs, rejecting everything else (e.g. `javascript:`, SVG) with a 400 — never trust the client-only size/type checks.

A 공급 오퍼 / 오퍼 매칭 (supply-offer marketplace) lets 기업 디렉토리 companies post supply offers (원재료/자재/부자재/기타, 품명, 단가, 단위, 통화, 최소주문수량) and lets 고객사 (from the 1,221-row KOTRA 고객사 디렉토리) request a match against an offer. Schema: `lib/db/src/schema/offers.ts` (`supply_offers`, `offer_matches`). API: `artifacts/api-server/src/routes/supplyOffers.ts` (GET list w/ `category`+`search`, POST, PATCH, DELETE; leftJoin companies for `companyName`) and `offerMatches.ts` (GET, POST, PATCH, DELETE; leftJoin offers+companies for `itemName`/`supplierCompanyName`). Public frontend page: `/offers` (오퍼 리스트, in sidebar nav) — offer list + search + category filter, a 공급 오퍼 등록 dialog (supplier picks a company from 기업 디렉토리), and a 매칭 요청 dialog (client searches the 1,221-row 고객사 디렉토리, then submits contact + message). If the search yields no match, the client can 직접 입력 (manually type) a company name not in the directory — such matches store `clientCompanyNo` as `null` (the column + OpenAPI `clientCompanyNo` are nullable/optional for this reason). Match status enum: `pending|reviewing|matched|rejected`. The matching process & results are surfaced ONLY in the ADMIN console (`/admin`) via two tabs: 공급 오퍼 (full CRUD) and 오퍼 매칭 (view + status/adminNote update + delete, `canCreate={false}` since matches originate from the public side). Like every other admin function in this no-auth app, offer-match endpoints are not server-side restricted — admin-only here means surfaced only in the URL-only `/admin` UI, never on public pages (the public `/offers` page never lists matches).

## User preferences

- UI labels and user-facing text should be in Korean.
- User originally specified MSSQL; we use Replit PostgreSQL instead (accepted).

## Gotchas

- Always wrap API responses in `toJson()` before validating with generated Zod response schemas, or Date fields throw `invalid_type` ZodErrors.
- Workflow names are prefixed: `artifacts/<slug>: <service>` (e.g. `artifacts/api-server: API Server`).
- esbuild externalizes `@google/*` (see `api-server/build.mjs`), so `@google/genai` must be a DIRECT api-server dependency or the bundle fails at runtime with `ERR_MODULE_NOT_FOUND`. Import integration clients lazily inside handlers so a missing integration can't crash server startup.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
