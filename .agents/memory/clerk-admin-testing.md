---
name: Clerk admin testing
description: Limits of programmatic Clerk test sign-in for this project's administrator screens.
---

The supported programmatic testing sign-in creates a real ordinary development user, not a platform administrator. Overriding login claims alone does not establish the server-verified administrator role used here.

**Why:** An administrator UI test was blocked after successful programmatic sign-in because the created identity remained a normal member. Do not spend another full browser run on the same assumption or weaken authentication to make testing pass.

**How to apply:** Establish that an explicitly authorized development administrator test identity is available before testing administrator-only journeys. Otherwise verify the isolated logic and report the signed-in UI verification limit. Never self-promote a user just to run a test. Remove only the exact temporary identities created for testing, using identity guards; leave existing accounts and permissions untouched.
