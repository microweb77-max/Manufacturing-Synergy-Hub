---
name: Customer directory sources
description: The rule for merging the legacy FDI customer directory with KOCHAM manufacturer records.
---

When the same customer appears in both the legacy FDI directory and the KOCHAM manufacturer import, retain the legacy FDI record and omit the duplicate KOCHAM row.

**Why:** The FDI source has richer Korean names, parent-company, investment, industry-detail, and location metadata. KOCHAM-only manufacturers are still included to expand coverage without losing the better record.

**How to apply:** Normalize company names before comparing sources; add only KOCHAM entries that do not match a legacy Korean or English company name. Keep the directory's source labels so users can distinguish KOCHAM-only entries.