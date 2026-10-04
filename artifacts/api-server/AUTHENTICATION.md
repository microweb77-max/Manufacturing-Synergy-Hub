# Authentication and platform access

Hybrid membership uses existing company profiles and verified company ownership.
Public directories, projects, matches, solutions, news,
and other public GET/HEAD endpoints remain readable without signing in.

## Current access policy

- All API writes require a verified Clerk browser session or session bearer token.
- Platform administrators retain shared-record management access. Company admins
  can edit their verified company's ordinary profile fields; verified admins and
  staff can create/edit/delete their company's projects, supply offers and talent
  posts, and submit project applications on behalf of that company.
- Ownership is checked against live company membership on the server for every
  request, never company names, email domains, browser flags or user-editable Clerk
  metadata. Unowned legacy activities remain platform-admin managed.
- Company members cannot delete company profiles or change trust/rating/completion
  metrics, company type, registered contact email or MST. Platform admins manage
  these fields. If a pending email claim's registered email changes, the link is
  invalidated at acceptance.
- Application, resume, talent-contact-request, and offer-match lists are private
  administrator reads. General company contacts in public profiles are unchanged;
  member-only contact visibility is a separate rollout stage.
- Anonymous protected requests receive 401; insufficient permissions receive 403.
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

## Company claiming and teams

Visit an existing company profile to request ownership. No company row is cloned.

- Email route: the server sends Gmail mail to the **registered** `contactEmail`,
  not a client-supplied recipient. The applicant must log into the same requesting
  Clerk account and explicitly accept the 30-minute, single-use link.
- Manual route: submit MST plus a PNG/JPEG/PDF business card or business document
  (maximum 5MB). Evidence bytes go to private App Storage, not PostgreSQL. Only
  the applicant and platform admins can download the attachment. Platform admins
  use the review queue to compare the submitted/registered MST and attachment,
  then approve/reject with a required reason. Requests expire after 14 days.
- Successful claim gives the applicant `company_admin` membership and a public
  verification badge. Other pending claims for the company are superseded.
- Company admins invite `company_admin` or `staff` by email (48-hour link). Only
  an account with that verified Clerk email may accept. The inviter must still
  be a current company admin. Removing an inviter cancels outstanding invites.
- Invitations and pending claims can be cancelled. Removal of the last company
  administrator is blocked; invite another administrator before transferring
  responsibility. Company roles never confer platform administrator permissions.
- Company-row locks serialize competing claims, manual approvals, invitation
  acceptance and member removal; database unique keys prevent duplicate members.
  Raw random tokens are emailed only, stored as SHA-256 hashes, and carried in
  URL fragments. GET requests do not consume links and logs exclude query strings.
- Claim/invite sending is rate-limited per company (one attempt per minute).
  Sending failures are recorded explicitly and grant no permissions. There is no
  automatic retry of Gmail sends, because a lost response may already have sent.

`/membership/*` endpoints require login even for GET/HEAD and return no-store
private state. Claim review is platform-only. Profile/contact privacy and consent
are a separate rollout and are not broadened by company membership.

Gmail is accessed using the connected `google-mail` account through
`@replit/connectors-sdk`; the SDK handles authorization and refresh on each send.
App Storage requires `PRIVATE_OBJECT_DIR` and the sidecar credentials supplied by
Replit. When publishing, confirm Gmail connection and private storage are usable
in that environment and apply the additive company-membership database schema.
No test emails are sent to real company addresses by the automated suite.

## Verification

```sh
pnpm --filter @workspace/api-server test
pnpm run typecheck
pnpm --filter @workspace/synergy-hub build
```

Policy tests enumerate write routes and verify anonymous/member/admin access,
private reads, provider failure and origin restrictions. Membership integration
tests use isolated company rows in the development database and injected
identity/email delivery (no real Gmail writes). They cover claim reuse, expiry,
duplicate/concurrent claims, manual approval permissions, private evidence,
invitation email verification, cancellation, last-admin protection, company
ownership and immediate membership revocation. Tests clean up their own records.
Real production login and role grants must be checked in the production tenant;
development verification does not grant or prove production access.