---
name: Company correction review policy
description: User-approved handling of review flags and shared tax numbers in company correction files.
---

For the KOVIMA company correction import, the user selected applying only rows without a review-needed flag. Leave flagged rows and companies outside the file unchanged. Preserve company IDs, contact details, and dependent records.

**Why:** The supplied file includes unresolved location checks and shared business tax numbers. A shared tax number may represent separate factories or branches, not duplicate records that can safely be deleted.

**How to apply:** Treat review flags as an exclusion gate for this correction dataset. Validate IDs against company names and existing classifications before applying updates. Do not merge companies solely by tax number; seek a separate decision for unresolved records. Keep development updates distinct from any future production-data application.