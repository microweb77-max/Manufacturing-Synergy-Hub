# Authentication and platform access

This is the first phase of the hybrid membership rollout, not company claiming or
company-level ownership. Public directories, projects, matches, solutions, news,
and other public GET/HEAD endpoints remain readable without signing in.

## Current access policy

- All API writes (POST/PATCH/PUT/DELETE) require a verified Clerk browser session
  or Clerk session bearer token AND platform administrator permission.
- Ordinary accounts cannot modify shared company data or create activity on behalf
  of an arbitrary company. Keep this restriction until company claims and
  server-enforced company ownership are implemented.
- Application, resume, talent-contact-request, and offer-match lists are private
  administrator reads. General company contacts in public profiles are unchanged;
  member-only contact visibility is a separate rollout stage.
- Anonymous writes receive 401; signed-in non-admins receive 403.
- Permission lookup failures return 503 without running the business handler.
- The old frontend password and browser storage flag confer no permissions.
- Web uses same-origin Clerk cookies; bearer tokens are for mobile sessions.
- Foreign-origin writes are rejected. No unauthenticated role-grant HTTP endpoint
  or automatic promotion of the first person to register exists.

## Assign the first platform administrator

1. Sign up normally in the web app, then visit `/admin`. Non-admin accounts see
   their account ID and a permission explanation.
2. The workspace operator verifies that this is the intended administrator, then
   runs the following in the environment containing that account's Clerk tenant:

   ```sh
   pnpm --filter @workspace/api-server admin:role user_REPLACE_WITH_ACCOUNT_ID grant
   ```

3. Reload the account page. The server reads Clerk private metadata on each
   protected request. No session-claim customization or restart is needed.

Revoke access using the same command with `revoke`. This merges just the
`platformRole` field in private metadata and leaves other metadata intact. Never
grant a role based on user-editable metadata, a request field, a company name,
or an unverified account ID. The ID is an identifier, not an authentication secret.

Clerk development and production have distinct tenants and account IDs. Grant
production permissions to the intended production account using the production
tenant's environment; a development role grant does not grant production access.
Managed production Clerk keys/proxy configuration are supplied by publishing.
This task does not publish the application.

## Verification

```sh
pnpm --filter @workspace/api-server test
pnpm run typecheck
pnpm --filter @workspace/synergy-hub build
```

Policy tests enumerate registered write routes and verify anonymous/member/admin
access, private reads, provider failure, and origin restrictions. The identity
resolver is injected in policy tests; they do not prove a real signed-in browser
session. The running preview was checked for anonymous public reads, blocked
writes, blocked private reads, forged credentials, and sign-in rendering.
End-to-end signed-in administrator UI and production login still need verification.