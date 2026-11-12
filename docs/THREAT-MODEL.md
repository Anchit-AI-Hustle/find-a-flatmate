# Threat Model

_November 2026 · Updated after `supabase/migrations/20261112160000_hardening.sql`_

**Method.** Code review of the three migrations and the server code, plus a local run: all three migrations were
applied to a throwaway PostgreSQL 16 database with stub `auth` and `storage` schemas, and the scenarios marked
"re-verified" below were executed against it on 12 November 2026. This is not a penetration test. There is no
production database yet, so nothing here was tested against hosted Supabase.

The repository also has integration tests (`tests/integration/*.test.ts`, run against a local Supabase stack)
and browser tests (`tests/e2e/*.spec.ts`). Where one covers a point it is named. This document does not record
whether those suites currently pass.

File and line references are to the working tree on 12 November 2026. `hardening.sql` means the third
migration; `workflows.sql` and `foundation.sql` the first two.

## 1. Assets

| Asset | Why it matters |
|---|---|
| Member identity (email in Supabase Auth) | Account takeover, harassment off-platform |
| Profile, budget, dates and lifestyle answers | Personal and partly sensitive (smoking, alcohol, food, guests) |
| Chat messages | Private conversation; may contain contact details and addresses |
| Visit address and time | Physical-safety relevance |
| Listing photos | Interior of a home; may identify a location |
| Reports and moderation logs | Reveal who reported whom |
| Moderator privilege | Read all listings and reports, suspend accounts, read reported messages |
| `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | The first bypasses RLS; the second triggers the housekeeping job |
| Listing integrity | The product's promise is that live listings are real and current |

## 2. Actors

| Actor | Capability |
|---|---|
| Anonymous visitor | Calls `public_rooms`, `public_inventory`; requests sign-in links for any email |
| Signed-in member | Calls every `authenticated` RPC directly with their own token, with any arguments |
| Scammer or spammer | A member, possibly with many accounts (email is the only sign-up cost) |
| Abusive match | A member who already has a conversation with the target |
| Malicious poster | Uploads crafted files, posts fake or stale listings |
| Curious or compromised moderator | Uses moderator RPCs |
| Network or email attacker | Reads or forwards a sign-in link; lures a victim to a crafted link |

## 3. Threats, mitigations and residual risk

### T1 — IDOR / broken object-level authorisation

- **Mitigation.** No table grants beyond `SELECT`, with RLS on every table (`foundation.sql:120-129`, policies
  `:131-159`). Every write RPC derives the actor from `auth.uid()` in `private.actor()` (`workflows.sql:2-10`)
  and re-checks ownership or membership: `save_listing` and `listing_transition` filter on `owner_id = u`;
  chat and visit RPCs go through `private.lock_chat` and `private.can_chat`; `interest_transition` now requires
  a `listing` argument to be a live listing owned by the target (`hardening.sql:41-42`). The two RPCs that take
  a user id as an argument are executable by `service_role` only and are called with the session user's id.
  The export route reads by the session user's id only. Covered by `tests/integration/access.test.ts`
  ("members and other people's data", "service role boundary").
- **Residual.** Low. See open gap G25 for the one remaining logic shortcut in `interest_transition`.

### T2 — Mass assignment

- **Mitigation.** Zod object schemas drop unknown keys (`lib/validate.ts`, `forms`; `parse()` in
  `lib/actions.ts`). RPCs read named keys from the JSON payload and never spread it; `status`, `owner_id`,
  `reviewed_at`, `expires_at`, `discoverable` and `age_confirmed` cannot be set through `save_basics` or
  `save_listing`. Answer payloads are validated against a fixed catalogue (`private.answers_valid`).
- **Residual.** Low. The catalogue is duplicated in SQL and TypeScript and must be kept in step.

### T3 — Privilege escalation to moderator

- **Mitigation.** The moderator list is `private.moderators`, outside the exposed schemas, with no RPC that
  writes to it (`foundation.sql:31`). `moderate` and `review_reported_message` check `private.is_moderator()`
  first. A moderator cannot act on their own listing, their own profile or another moderator's profile
  (`hardening.sql:154`, `:166`). The `op` argument of `action()` is client-controlled, but the `moderate` and
  `evidence` ops only forward to those RPCs. `/admin` returns 404 for non-moderators. Covered by
  `access.test.ts` ("moderation privileges") and the e2e test "an ordinary member cannot open the moderation
  dashboard".
- **Residual.** Granting moderator rights is a manual database insert with no audit trail (G19). A moderator can
  approve an associate's listing.

### T4 — Chat enumeration and unauthorised reading

- **Mitigation.** Conversation ids are random UUIDs. `messages`, `conversations`, `conversation_members`,
  `visit_requests` are readable only when `private.can_chat` holds (`foundation.sql:108-112`, `:146-151`):
  caller is one of the two matched members, both profiles active, no block. `inbox()` lists only the caller's
  conversations. Moderators are not exempt; they get one reported message at a time through
  `review_reported_message`, with a logged justification. Covered by `access.test.ts` ("cannot read or join a
  conversation they are not part of", "let a moderator read only the reported message…").
- **Residual.** Message bodies are stored in plain text. Anyone with database or service-role access can read
  them. The export route uses the service role to read the caller's own sent messages (G27).

### T5 — Storage bucket leakage

- **Mitigation.** Bucket `room-photos` is private with no object policies (`foundation.sql:161-162`). Browsers
  never get a storage URL. `GET /api/media/[id]` requires a session, reads the image row with the caller's
  token so RLS (`listing_media_read`) decides, then streams with `Cache-Control: private, no-store`.
  Signed-out visitors and non-active profiles get no photos. Covered by `access.test.ts` ("cannot read stored
  photos directly, even as the owner").
- **Residual.** Files are deleted on account closure only when it goes through the server action, and never
  when a listing is filled or removed (G6). The service-role key is a single point of failure.

### T6 — Malicious image upload

- **Mitigation.** Op `upload` in `lib/actions.ts` (`:93-116`): size 10 bytes–2.5 MB; declared type allow-list;
  ownership and draft state checked; sharp decodes with `limitInputPixels: 20_000_000` and `failOn: 'warning'`;
  real format must be JPEG, PNG or WebP with a single frame; the image is rotated, resized and **re-encoded** to
  WebP, which drops metadata and any trailing payload; output ≤ 750,000 bytes; server-generated path. The bucket
  itself accepts only `image/webp` up to 750,000 bytes. `attach_sanitized_photo` re-checks path shape, digest,
  object existence and the six-photo cap. Responses carry `nosniff`. Every photo passes moderator review
  because photos can only change while the listing is a draft.
- **Residual.** Decoder vulnerabilities in sharp/libvips. No automated content scanning. Work is done before
  the rate limit is consulted (G16).

### T7 — Spam and flooding

- **Mitigation.** `private.throttle` on every write RPC (table in API-CONTRACTS.md). Structural caps: 8 open
  listings, 5 new listings a day, 6 photos, one open visit per conversation, one row per interest pair,
  idempotent message keys, a third identical message within an hour refused, similar-title duplicate check.
- **Residual.** Failed calls are free and counters are per account only (G5). No bot protection at sign-in
  (G11). Read RPCs and the export route are unthrottled (G22).

### T8 — Scam solicitation

- **Mitigation.** No contact details in public text (`private.public_text`, `workflows.sql:27-33`). Chat only
  after mutual opt-in. `suspicious` flag on payment and identity keywords, now matched as whole words
  (`hardening.sql:103`). Report category `scam`, optional block. A message stays reportable by the other
  member after a block, pause or suspension (`hardening.sql:136`). Product copy states that the service never
  holds money.
- **Residual.** The flag is advisory, easy to evade and invisible to moderators (G14).

### T9 — Stale or fake listings

- **Mitigation.** Attestation; at least one photo; moderator approval before visibility; any edit returns the
  listing to draft; 21-day `expires_at` counted from approval or renewal and capped at the end of availability;
  read paths test `expires_at > now()` rather than trusting the status; a daily job marks lapsed listings
  `expired` (`GET /api/cron/expire`, `vercel.json`); a moderator expiry clears `reviewed_at`, so the owner must
  go back through review; `stale` report category; moderator `remove`.
- **Residual.** No proof of tenancy or ownership. Photo reuse across listings is not detected (G17). The job
  needs `CRON_SECRET` and the service key to be set (G23). A listing cannot be reported once its owner has
  paused or blocked the reporter (G26).

### T10 — Account takeover via magic link

- **Mitigation.** No passwords. Sign-in links are single-use and time-limited by Supabase Auth. The callback
  accepts only the PKCE `code` (`app/auth/callback/route.ts:11-15`), which is useless without the verifier
  cookie in the browser that asked for the link. The redirect target is fixed server-side. The callback sends
  `no-store` and `no-referrer`. `session()` uses `getUser()` and requires a confirmed email
  (`lib/db.ts:22-27`); `private.actor()` requires the same in SQL. The sign-in form gives the same answer for
  known and unknown addresses.
- **Residual.** Control of the mailbox is control of the account; there is no second factor. G9, G11. Sign-out
  is local to one browser. A link opened in a different browser fails. Production Auth settings, including
  that the email template uses the PKCE flow, are not in the repo (G23).

### T11 — CSRF on server actions

- **Mitigation.** All mutations are Next.js Server Actions: POST only, with the framework comparing `Origin` to
  the host; no `allowedOrigins` override is configured. Supabase cookies are `SameSite=Lax`. CSP
  `form-action 'self'` and `frame-ancestors 'none'` plus `X-Frame-Options: DENY` (`next.config.ts:5-11`). GET
  handlers: media proxy and data export (read-only, session required), the cron route (bearer secret), and the
  auth callback (bound to the requesting browser by PKCE).
- **Residual.** Low.

### T12 — Open redirect in the auth callback

- **Mitigation.** `app/auth/callback/route.ts` reads only `code` and redirects only to `/app` or
  `/login?expired=1` on `siteUrl`. `emailRedirectTo` is built from `siteUrl`. Redirects inside `action()` are
  fixed strings or a path plus a Zod-validated UUID.
- **Residual.** If `NEXT_PUBLIC_SITE_URL` is unset, redirects go to `http://localhost:3000` (`lib/env.ts:4`).
  An availability problem, not an open redirect.

### T13 — XSS

- **Mitigation.** React escapes all output; there is no raw-HTML rendering in `app/` or `components/` at the
  time of writing. `plain()` in `lib/validate.ts` rejects `<` and `>` in names, listing text, report details and
  reasons; `private.public_text` rejects markup and links again in SQL. Media responses are always
  `image/webp` with `nosniff`; the export is served as a JSON attachment. `object-src 'none'` and
  `base-uri 'self'` are set.
- **Residual.** Chat bodies are not markup-filtered and rely on React escaping alone. The CSP has no
  `script-src`, and session cookies are readable by script (G9).

## 4. Fixed in the hardening migration

Gap numbers are those of the first review. "Re-verified" means the original failing scenario was re-run on the
throwaway database with all three migrations applied and now behaves as described. The test named is in
`tests/integration/hardening.test.ts` unless another file is given. Four fixes live in application code rather
than the migration; the "Where" column says so.

| # | Was | Now | Where | Test |
|---|---|---|---|---|
| G1 | Hidden profiles could be sent interest by id | Refused with "Candidate unavailable" unless the hidden person reached out first or owns the live listing named. Re-verified | `hardening.sql:43-44` | "does not let anyone send interest to a hidden profile by id" |
| G2 | Any `listing` argument skipped the dealbreaker check | `listing` must be a live listing owned by the target ("Listing unavailable") and must fit the sender on city, locality, monthly cost, dates and stay ("This room does not fit…"). Re-verified | `hardening.sql:41-42`, `:45-49` | "cannot use a made-up or unrelated listing id…"; "refuses interest in a room that is over budget…" |
| G3 | `moderate('request', …, 'fulfill')` always failed | Works for `export` and `support`; `delete` is still refused by design. Re-verified | `hardening.sql:174-175` | "lets a moderator mark a support request handled, but not a deletion" |
| G4 | `expire_rooms()` was unscheduled and not runnable by the service role | Now `SECURITY DEFINER`, still executable by `service_role` only; a daily cron (`30 20 * * *` UTC) calls `GET /api/cron/expire` with a bearer secret. The function part is re-verified | `hardening.sql:181`; `app/api/cron/expire/route.ts`; `vercel.json` | None in `hardening.test.ts`. `workflows.test.ts` "stops showing a listing once it expires" calls the function as the database owner, not as the service role; the cron route has no test |
| G7 | Reports failed once the other person was no longer visible | A member can report any message in a conversation they belong to, and any person they have matched with, after a block, pause or suspension. Re-verified. Listings are not covered (G26) | `hardening.sql:136`, `:138-139` | "still accepts a report about a message or person after a block" |
| G8 | Suspended members could not appeal through the report form | Appeals go through the support request on `/app/settings/data`; the report form no longer offers "appeal". `file_report` now refuses every self-report | `components/people.tsx` (`ReportForm`); `app/app/settings/data/page.tsx`; `hardening.sql:141` | `workflows.test.ts` "suspends a member, locks them out, and lets them appeal" |
| G10 | Callback accepted `token_hash` on GET | PKCE `code` only | `app/auth/callback/route.ts:11-15` (application code) | e2e journeys sign in through the magic link |
| G12 | A draft profile could be activated without the lifestyle step | Activation requires onboarding progress `preferences`, which `save_lifestyle` sets even for an empty answer set. Re-verified | `hardening.sql:84` | "cannot activate a profile before the lifestyle step is saved or skipped" |
| G13 | Owner could renew a listing a moderator expired | Moderator expiry clears `reviewed_at`; renew is refused until the listing is edited and reviewed again. Re-verified | `hardening.sql:159` | "makes a moderator expiry stick until the listing is reviewed again" |
| G14 (part) | Substring matching flagged ordinary words | Brand and identity keywords match as whole words; "occupied" is no longer flagged. Re-verified. Moderator visibility remains open | `hardening.sql:103` | "does not flag ordinary words that merely contain a keyword" |
| G15 (part) | Block left an open visit and its address in place | Block cancels open visits between the two, deletes the address and logs a `cancelled` event. Re-verified. No unblock remains open | `hardening.sql:118-123` | "cancels an open visit and deletes the shared address" |
| G20 | `ff_intent` cookie had no `secure` attribute | `secure` when `NODE_ENV` is `production` | `lib/actions.ts:23` (application code) | — |
| G21 | Late approval produced an already-expired listing | Expiry is the earlier of approval time + 21 days and the end of availability. Re-verified | `hardening.sql:156` | "gives a full freshness window from the moment of approval" |
| G22 (part) | `discover_people` listed any city | List mode uses the caller's own city and ignores the argument. Re-verified. Still unthrottled | `hardening.sql:18` | "only ever lists people in the caller's own city" |

Also fixed in TypeScript: `matchRoom` now hard-fails on a household dealbreaker, and the 180-day window is
validated in `lib/validate.ts` (see MATCHING-SPEC.md section 9).

## 5. Open gaps

| # | Gap | Where | Impact | Suggested fix |
|---|---|---|---|---|
| G5 | **Rate limits count only successful calls, and counters are never purged.** The increment is rolled back when the RPC raises. Re-verified | `workflows.sql:12-18` | Unlimited failing calls (probing, load). `private.rate_buckets` grows without bound | Count attempts outside the failing transaction or at the edge; add a purge |
| G6 | **Account closure still does not erase rows or the Auth user.** Closure now also deletes the member's stored photo files, but only when it goes through the server action, only if the service key is set, and without checking the result. Profile, answers, messages, interests, photo rows and the Auth user remain; deletion requests are completed by an operator and cannot be marked done in the app. Photo files of filled or removed listings are never deleted | `workflows.sql:393-399`; `removePhotos` in `lib/actions.ts:45-54`, called at `:87` | Erasure depends on a manual process that is not written down | Build an erasure job; delete files in the database-side closure path and on fill or remove |
| G9 | **Session tokens are readable by script and the CSP does not restrict scripts.** `@supabase/ssr` sets auth cookies with `httpOnly: false` by default and no cookie options are overridden; the CSP has no `script-src` or `default-src` | `lib/db.ts:13-16`, `proxy.ts:7-15`, `next.config.ts:10` | Any XSS becomes session theft | Add a nonce-based `script-src`; consider HttpOnly cookie options |
| G11 | **No bot protection on sign-in, and sign-up is open.** `signInWithOtp` creates users by default; no CAPTCHA | `lib/actions.ts:26-33` | Mail-bombing third parties within Supabase's limits; cheap multi-accounting | Enable Supabase CAPTCHA; add an edge rate limit |
| G14 | **Moderators never see the scam flag.** The flag is shown to the two members only. The phrases "advance … pay", "token … fee" and "bank details" are still matched without word boundaries | `hardening.sql:103`; `foundation.sql:148` | No moderation signal from flagged messages | Surface flagged counts per account to moderators |
| G15 | **There is no unblock.** | `hardening.sql:108-124` | A mistaken block is permanent | Add an unblock that does not restore the old chat |
| G16 | **Image decoding and the storage upload happen before the photo rate limit is checked.** | `lib/actions.ts:97-112` | CPU and storage churn from a single account | Check a limit before decoding |
| G17 | **Duplicate photo detection is per listing only.** | `foundation.sql:57` | The same photos can be reused across listings and accounts unnoticed | Index `digest` globally and warn moderators |
| G18 | **Some usage data is not consent-gated or is identifiable.** `match_feedback` stores votes with the user id regardless of analytics consent; `product_events` rows carry user ids and are readable by moderators | `workflows.sql:407-412`; `foundation.sql:158` | Mismatch with "opt-in analytics" wording | Gate feedback on consent or document it; aggregate before display |
| G19 | **Moderator grants are unaudited and moderator RPCs are unthrottled.** | `foundation.sql:31`; `hardening.sql:147-179` | A compromised moderator account can act at volume; no record of who granted access | Log grants; add throttles and alerts |
| G22 | **Read paths are unthrottled.** `discover_people`, `public_rooms`, `inbox` and the export route have no limit | `hardening.sql:14-24`; `app/app/settings/data/export/route.ts` | An active account can poll the 80 most recently updated discoverable profiles in its city, with full answers | Add a read limit |
| G23 | **Production settings are not in the repo.** `supabase/config.toml` is local only. `CRON_SECRET` is required by the cron route but is not listed in `.env.example` | `supabase/config.toml`; `app/api/cron/expire/route.ts:9-11` | Redirect allow-list, PKCE email template, OTP expiry, CAPTCHA, anonymous sign-ins and default privileges are set by hand. With `CRON_SECRET` unset the job returns 401 every day and nothing expires | Document and check them at release |
| G24 | **Age is a self-declared checkbox.** | `foundation.sql:19`; `workflows.sql:62` | Minors can sign up | Product and legal decision |
| G25 | **A like-back skips the overlap and listing-fit checks.** When the other person has already sent interest, location, budget, dates and (with a `listing`) cost and stay are not re-checked. Re-verified: an over-budget room was accepted on a like-back | `hardening.sql:45` | A match can form where the screen says "Not a fit" | Decide whether a like-back should re-check; if not, say so in the UI |
| G26 | **A listing cannot be reported once the reporter can no longer read it.** The listing path still requires current visibility, so it fails after the owner pauses or after a block. A person who was never a match and is no longer visible cannot be reported either. Re-verified | `hardening.sql:133`, `:138-139` | Narrower version of the old G7 | Accept reports on listings the reporter saved or sent interest through |
| G27 | **The export can silently omit sent messages, and leaves some data out.** Sent messages are read with the service role and any error is swallowed, returning an empty list. The migrations grant `service_role` no table privileges, so this depends on the project's default privileges (on plain PostgreSQL the read is denied). Not included at all: messages received, visits proposed by the other person, analytics events, ranking feedback | `app/app/settings/data/export/route.ts:12-19` | A member may receive an incomplete export with no warning | Grant the read explicitly or use a definer RPC; report errors; list what the export excludes |
| G28 | **The `appeal` report category is vestigial.** It is still accepted by `forms.report` and the table check, but no self-report is possible and the form does not offer it | `lib/validate.ts:48`; `foundation.sql:73` | Low; a direct caller can file an "appeal" about someone else | Remove the value |

## 6. Assumptions this model depends on

- Schema `private` is never added to the API's exposed schemas. Five helper functions there are executable by
  `authenticated` because RLS policies need them (`foundation.sql:118`).
- Anonymous sign-ins stay disabled in Supabase Auth, and the sign-in email uses the PKCE flow.
- `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` exist only as server-side environment variables.
- New pages keep calling `requireSession`, `requireProfile` or `requireModerator`; `proxy.ts` refreshes sessions
  but does not block anything.
- No page renders member text as raw HTML.
