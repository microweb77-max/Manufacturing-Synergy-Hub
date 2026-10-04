---
name: Hybrid membership direction
description: User-approved phased membership model and company-claim constraints
---

The user wants “둘러보기는 공개, 참여 활동은 회원사 계정” (public browsing,
participation through member-company accounts). Existing profiles should be
claimed, not recreated. The company is the durable owner of activity, with
multiple individual contacts and separate company-admin/platform-admin roles.

**Why:** The user supplied the membership transition plan and chose to start with
Clerk login and API protection, rather than implement the entire membership model
in one phase. Authenticated alone must not mean unrestricted editing of every company.

**How to apply:** Later participation features must establish verified company
membership and enforce ownership on the server before lifting interim restrictions.
For claims, the plan prefers a one-time link to the existing profile's contact
email, with document-based manual review as an exception; do not rely solely on
matching email domains because many existing contacts use personal email providers.
Keep unclaimed profiles publicly browseable. Company-admin and contact roles
must never confer platform-admin permission. Contact visibility, proposal-response
flows and legal consent are separate capabilities, not implied by login or company
verification.