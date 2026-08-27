---
name: prod-dev-merge-id-remap
description: How to safely merge production DB rows into dev when dev's serial IDs no longer line up with production's for the same logical table (e.g. after a bulk reimport).
---

When copying production rows into a dev table that has since been bulk-reimported (old rows deleted, new ones inserted with fresh serial IDs), never assume prod and dev IDs for the same table refer to the same entity — dependent tables (FK-like integer columns with no actual constraint, e.g. `matches.company_id`, `supply_offers.company_id`) will silently point at rows that no longer exist.

**Why:** In this project, `companies` was cleared and reimported (KOCHAM directory data) after `matches`/`supply_offers` had already been created referencing the old company IDs. The dev rows kept the old numeric IDs, which by coincidence fell inside the new companies ID range and pointed at unrelated companies — a `LEFT JOIN` showing NULL/blank names was the tell.

**How to apply:**
1. Before merging, `LEFT JOIN` every table with an integer reference column against its target table in dev; blank/NULL results indicate stale/orphaned references that predate the merge and must be repaired regardless of the merge.
2. Insert the production rows into dev letting `serial` assign new IDs (don't try to preserve original IDs), capturing an old-ID → new-ID map from the `INSERT ... RETURNING id` order (matches VALUES order for a single statement).
3. Use that map to `UPDATE` every dependent column (both pre-existing orphaned dev rows and newly inserted rows referencing the same entity) rather than copying raw FK values across environments.
4. For tables with identical content in dev and prod (verified via `md5(string_agg(row::text ...))` checksum over relevant columns), skip them entirely rather than re-inserting.
