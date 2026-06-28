---
name: Zod date serialization in API routes
description: Why Drizzle Date objects fail generated Zod response validation and how to fix it
---

Generated (Orval) Zod **response** schemas expect ISO date-time **strings**, but Drizzle
returns timestamp columns as JS `Date` objects. Passing rows straight into
`SomeResponse.parse(rows)` throws `ZodError: invalid_type, expected string, received date`.

**Fix:** wrap the value in a JSON round-trip before parsing — `Schema.parse(toJson(rows))`
where `toJson(v) = JSON.parse(JSON.stringify(v))`. JSON serialization converts every Date
(including nested ones in enriched/joined objects) to an ISO string, matching `res.json`.

**Why:** this keeps a single uniform conversion instead of hand-mapping each date field per
route, and it handles nested joined objects (e.g. a match enriched with company + project).

**How to apply:** any new route that validates a DB row against a generated Zod response
schema must use `toJson()` first. Helper lives at `artifacts/api-server/src/lib/serialize.ts`.
