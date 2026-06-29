---
name: Company logo storage
description: How company logos are stored and validated, and why no object storage is used.
---

Company logos uploaded on the new-company form are read client-side as base64 data
URLs and stored INLINE in the `companies.logo_url` text column. No object storage.

**Why:** The repl has no object storage configured, and the existing material-upload
flow already established a base64-data-URL pattern. Inline storage keeps dev/prod
identical with zero infra. Acceptable for low volume; logos are capped at 2MB.

**How to apply:**
- If logo volume grows large, revisit — inline data URLs bloat DB rows and inflate
  list-endpoint payloads (every company row carries its full image). That is the
  trigger to migrate to object storage, not before.
- Server MUST validate `logoUrl` (POST + PATCH) via `validateLogoUrl()` in
  `routes/companies.ts`: allow-list only `data:image/(png|jpe?g|webp|gif);base64,...`
  (≤2MB decoded) or plain `https://` URLs; reject `javascript:`, SVG, etc. with 400.
  The client-side size/type checks are UX only — never trust them.
