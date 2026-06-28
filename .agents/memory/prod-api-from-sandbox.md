---
name: Reaching the published API from the code sandbox
description: Why external fetches to the .replit.app API return HTML, not JSON, and what to do instead.
---

# Calling the deployed app's API from code_execution / curl

Fetching `https://<app>.replit.app/api/...` from the code sandbox returns a Replit
HTML page (Next.js shell, `replit-ui-theme-root`) with status 200, not the app's JSON
— even though deployment logs show the API serving `/api` requests fine for the
user's authenticated browser. DELETE/PATCH from the sandbox hit that HTML page and
do nothing (often 404), so prod data mutations silently fail.

**Why:** the published deployment serves an interstitial/auth page to unauthenticated
external clients; the sandbox is unauthenticated. (A cold autoscale instance can also
serve a boot interstitial briefly, but warming it does NOT make the API reachable to
the sandbox — the page persists.)

**How to apply:** do not try to mutate or clear production data by calling the live
API from the sandbox; it will appear to "work" while changing nothing. For prod data
changes, either (a) use `executeSql` with `environment: "production"` (READ-ONLY — good
for verifying counts), or (b) build/ship an in-app admin UI and have the user perform
the action in their logged-in browser. The prod replica that `executeSql production`
reads can also lag the live DB, so trust it for rough counts only.
