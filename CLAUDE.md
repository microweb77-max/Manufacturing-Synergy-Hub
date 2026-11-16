# Manufacturing Synergy Hub — Claude Code guide

B2B manufacturing collaboration portal for Vietnam (Korean UI). **Read `replit.md` first** — it is the detailed, up-to-date description of features, architecture, security model and gotchas.

## Run locally (Windows / macOS / Linux)

```bash
pnpm install
cp .env.example .env          # Windows: copy .env.example .env  — then edit DATABASE_URL / ADMIN_PASSWORD
pnpm run db:push:local        # apply DB schema to the local Postgres
pnpm run dev:local            # API :8080 + web :5173 (Vite, /api proxied) → http://localhost:5173
```

Admin console: http://localhost:5173/admin (password = `ADMIN_PASSWORD` in `.env`).

## Commands

- `pnpm run typecheck` — full typecheck (run before committing)
- `pnpm run build` — typecheck + production build
- `pnpm test` — 전체 테스트(Vitest). 단위 테스트는 항상, API 통합 테스트는 `DATABASE_URL`이 테스트 DB(이름에 `test` 포함 또는 `CI=true`)일 때만 실행(아니면 skip)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod after editing `lib/api-spec/openapi.yaml`

## Rules

- UI text in **Korean**.
- API contract source of truth: `lib/api-spec/openapi.yaml` → codegen. DB schema: `lib/db/src/schema/*`.
- New API route? Decide its access in `artifacts/api-server/src/lib/auth.ts` (`PUBLIC_WRITES` / `ADMIN_READS`); writes default to admin-only.
- Wrap API responses in `toJson()` before Zod `.parse()`.
- DB schema changes are applied to production by Replit's post-merge `db push` — never drop/rename columns without a migration plan.
- Deployment stays on Replit: work on a branch → PR → merge → Replit Git Pull → Publish. Do not edit `.replit` / `.replit-artifact` unless needed.
- Keep `replit.md` updated when architecture changes (Replit Agent also reads it).

## Cowork → Claude Code workflow

Design is done in Claude Cowork; implementation is done by Claude Code (GitHub Actions via `@claude` / `claude` label, or locally in the desktop Code tab). See `docs/specs/README.md`.

When asked to implement a spec or issue:

1. **Read the spec** (`docs/specs/NNN-*.md` linked from the issue, or the issue body). If something is ambiguous or conflicts with the codebase, make the most reasonable choice and list it under "결정·가정" in the PR — do not stop to ask unless the change would be destructive (dropping data, removing features).
2. **Branch**: `claude/NNN-short-name` (or the branch the action creates). Never commit to `main` directly.
3. **Implement** following the rules above (OpenAPI → codegen, schema in `lib/db`, access policy in `lib/auth.ts`, Korean UI, mobile-friendly).
4. **Verify** before opening the PR: `pnpm run typecheck`, `pnpm run build` and `pnpm test` must pass. For API changes, start the API (`DATABASE_URL` is set in CI) and exercise the endpoints with curl, including admin vs anonymous access.
5. **Update docs**: set the spec status to `완료` (or `개발 중` if partial), update `replit.md` for architecture changes.
6. **PR description (Korean)**: 요약 / 변경 내용 / 결정·가정 / 검증 결과 / 배포 시 주의(DB 변경, 새 Secret 등) / `Closes #이슈번호`.
7. 새 기능/수정에는 해당 테스트(`artifacts/api-server/src/__tests__`)를 함께 추가한다.
8. Keep PRs focused on one spec. Unrelated improvements → mention in the PR as follow-up suggestions instead of doing them.
