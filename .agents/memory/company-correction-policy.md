---
name: Company correction review policy
description: User-approved handling of review flags and shared tax numbers in company correction files.
---

For the KOVIMA membership replacement, the user explicitly chose the supplied file as the complete participating-company list, including review-flagged rows, and removal of companies outside the file. Retain existing IDs and contact details for included companies. This supersedes the earlier unflagged-only correction scope.

**Why:** The user approved complete replacement after being told it removes companies outside the file, and separately approved deletion of their linked offers and matches and detachment from solutions. Review flags in the source are not proof that the data is verified; their inclusion was an explicit user decision.

**How to apply:** Preserve this membership scope in subsequent work; do not restore excluded companies from older imports without asking. Validate IDs against names, preserve fields absent from the file, and do not merge branches solely by tax number. Back up before destructive replacement, and stop for new dependency types or a deletion scope greater than approved. Development replacement does not imply approval or completion of production-data replacement.