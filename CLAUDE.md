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
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod after editing `lib/api-spec/openapi.yaml`

## Rules

- UI text in **Korean**.
- API contract source of truth: `lib/api-spec/openapi.yaml` → codegen. DB schema: `lib/db/src/schema/*`.
- New API route? Decide its access in `artifacts/api-server/src/lib/auth.ts` (`PUBLIC_WRITES` / `ADMIN_READS`); writes default to admin-only.
- Wrap API responses in `toJson()` before Zod `.parse()`.
- DB schema changes are applied to production by Replit's post-merge `db push` — never drop/rename columns without a migration plan.
- Deployment stays on Replit: work on a branch → PR → merge → Replit Git Pull → Publish. Do not edit `.replit` / `.replit-artifact` unless needed.
- Keep `replit.md` updated when architecture changes (Replit Agent also reads it).
