# Manufacturing Synergy Hub — Claude Code guide

B2B manufacturing collaboration portal for Vietnam (Korean UI). **Read `replit.md` first** — it is the detailed, up-to-date description of features, architecture, security model and gotchas.

## Run locally (Windows / macOS / Linux)

```bash
pnpm install
cp .env.example .env          # Windows: copy .env.example .env  — then edit DATABASE_URL / Clerk dev keys
pnpm run db:push:local        # apply DB schema to the local Postgres
pnpm run dev:local            # API :8080 + web :5173 (Vite, /api proxied) → http://localhost:5173
```

Admin console: http://localhost:5173/admin — sign in with Clerk; grant the platform-admin role with `pnpm --filter @workspace/api-server admin:role <user_id> grant` (see `artifacts/api-server/AUTHENTICATION.md`).

## Commands

- `pnpm run typecheck` — full typecheck (run before committing)
- `pnpm run build` — typecheck + production build (needs `PORT` and `BASE_PATH` env, e.g. `PORT=3000 BASE_PATH=/`)
- `pnpm test` — API tests (`artifacts/api-server/tests`, need `DATABASE_URL` to a **test** database) + Excel import tests
- CI (`.github/workflows/ci.yml`) runs install → DB push → typecheck → build → test on every PR into `main`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod after editing `lib/api-spec/openapi.yaml`

## Rules

- UI text in **Korean**.
- API contract source of truth: `lib/api-spec/openapi.yaml` → codegen. DB schema: `lib/db/src/schema/*`.
- Auth is **Clerk** (see `artifacts/api-server/AUTHENTICATION.md`). New API route? Decide its access in `artifacts/api-server/src/middlewares/apiAuthorization.ts` / `lib/companyPermissions.ts`; writes are fail-closed (require a verified session and permission).
- Wrap API responses in `toJson()` before Zod `.parse()`.
- DB schema changes are applied to production by Replit's post-merge `db push` — never drop/rename columns without a migration plan.
- Deployment stays on Replit and **always from `main`**: work on a branch → PR → merge → Replit Git Pull → Publish. Replit Agent follows the same rule (see `replit.md` → Development workflow). Do not edit `.replit` / `.replit-artifact` unless needed.
- Keep `replit.md` updated when architecture changes (Replit Agent also reads it).

## Cowork → Claude Code workflow

Design is done in Claude Cowork; implementation is done by Claude Code (GitHub Actions via `@claude` / `claude` label, or locally in the desktop Code tab). See `docs/specs/README.md`.

When asked to implement a spec or issue:

1. **Read the spec** (`docs/specs/NNN-*.md` linked from the issue, or the issue body). If something is ambiguous or conflicts with the codebase, make the most reasonable choice and list it under "결정·가정" in the PR — do not stop to ask unless the change would be destructive (dropping data, removing features).
2. **Branch**: `claude/NNN-short-name` (or the branch the action creates). Never commit to `main` directly.
3. **Implement** following the rules above (OpenAPI → codegen, schema in `lib/db`, access policy in `middlewares/apiAuthorization.ts`, Korean UI, mobile-friendly). Add or extend tests in `artifacts/api-server/tests/` for new API behaviour.
4. **Verify** before opening the PR: `pnpm run typecheck`, `pnpm run build` and `pnpm test` must pass. For API changes, exercise the endpoints (anonymous requests to protected routes must get 401; Clerk keys are not available in CI, so authenticated paths are covered by unit tests/mocks).
5. **Update docs**: set the spec status to `완료` (or `개발 중` if partial), update `replit.md` for architecture changes.
6. **Open the PR yourself** (`gh pr create --base main`) with a Korean description: 요약 / 변경 내용 / 결정·가정 / 검증 결과 / 배포 시 주의(DB 변경, 새 Secret 등) / `Closes #이슈번호`. Then check CI (`gh pr checks`) and fix failures.
7. Keep PRs focused on one spec. Unrelated improvements → mention in the PR as follow-up suggestions instead of doing them.

## Environment notes

- **GitHub Actions (`@claude`)**: Postgres 16 service with `DATABASE_URL`, `CI=true`, `PORT`, `BASE_PATH` are set; Clerk keys are not. The Claude GitHub App **cannot push files under `.github/workflows/`** — if a workflow change is needed, put the full file in the PR description and Cowork will add it.
- **Claude Code on the web / desktop**: `.claude/settings.json` pre-approves common commands; in cloud sessions a SessionStart hook (`scripts/claude-session-start.sh`) installs dependencies. Clerk development keys go in `.env` locally (never production keys).
