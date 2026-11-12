# Threat Model

_November 2026_

**Method.** Code review of the two migrations and the server code, plus a local run: both migrations were applied
to a throwaway PostgreSQL 16 database with stub `auth` and `storage` schemas, and the scenarios marked
"verified" below were executed against it on 12 November 2026. This is not a penetration test. There is no
production database yet, so nothing here was tested against Supabase itself.

File and line references are to the working tree on 12 November 2026. SQL line numbers are stable; TypeScript
files were being edited in parallel, so function names are given as well.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS; full database and storage access |
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
  chat and visit RPCs go through `private.lock_chat` and `private.can_chat`; `visit_transition` requires the
  visit to belong to the conversation; `mark_read` requires the message to belong to it. The two RPCs that take a
  user id as an argument are executable by `service_role` only (`workflows.sql:485-486`) and are called with the
  session user's id (`lib/actions.ts`, ops `upload`, `removePhoto`). Verified: direct `UPDATE`/`INSERT` as
  `authenticated` is denied; other profiles are not selectable.
- **Residual.** G1 and G2 below are object-level logic flaws inside `interest_transition`.

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
  (`workflows.sql:429`, `:441`). The `op` argument of `action()` is client-controlled, but the `moderate` and
  `evidence` ops only forward to those RPCs. `/admin` returns 404 for non-moderators. Verified: a normal member
  gets "Moderator access required".
- **Residual.** Granting moderator rights is a manual database insert with no audit trail (G19). A moderator can
  approve an associate's listing.

### T4 — Chat enumeration and unauthorised reading

- **Mitigation.** Conversation ids are random UUIDs. `messages`, `conversations`, `conversation_members`,
  `visit_requests` are readable only when `private.can_chat` holds (`foundation.sql:108-112`, `:146-151`):
  caller is one of the two matched members, both profiles active, no block. `inbox()` lists only the caller's
  conversations. Moderators are not exempt (verified: a moderator selects zero messages); they get one reported
  message at a time through `review_reported_message`, with a logged justification.
- **Residual.** Message bodies are stored in plain text in the database. Anyone with database or service-role
  access can read them.

### T5 — Storage bucket leakage

- **Mitigation.** Bucket `room-photos` is private with no object policies (`foundation.sql:161-162`). Browsers
  never get a storage URL. `GET /api/media/[id]` (`app/api/media/[id]/route.ts:4-12`) requires a session, reads
  the image row with the caller's token so RLS (`listing_media_read`) decides, then streams with
  `Cache-Control: private, no-store`. Signed-out visitors and non-active profiles get no photos.
- **Residual.** Files are never deleted when a listing is filled or removed or an account is closed (G6). The
  service-role key is a single point of failure.

### T6 — Malicious image upload

- **Mitigation.** Op `upload` in `lib/actions.ts` (`:82-105`): size 10 bytes–2.5 MB; declared type allow-list;
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
  (G11). Read RPCs are unthrottled (G22).

### T8 — Scam solicitation

- **Mitigation.** No contact details in public text (`private.public_text`, `workflows.sql:27-33`). Chat only
  after mutual opt-in. `suspicious` flag on payment and identity keywords (`workflows.sql:268`). Report category
  `scam`, optional block. Product copy states that the service never holds money.
- **Residual.** The flag is advisory, easy to evade, has false positives and is invisible to moderators (G14).
  Reports become impossible once the scammer pauses or closes the account (G7).

### T9 — Stale or fake listings

- **Mitigation.** Attestation; at least one photo; moderator approval before visibility; any edit returns the
  listing to draft; 21-day `expires_at` capped at the end of availability; read paths test `expires_at > now()`
  rather than trusting the status; renewal is logged; `stale` report category; moderator `remove`.
- **Residual.** No proof of tenancy or ownership. G4 (no expiry job), G13 (owner can undo a moderator expiry),
  G17 (photo reuse across listings), G21.

### T10 — Account takeover via magic link

- **Mitigation.** No passwords. Sign-in links are single-use and time-limited by Supabase Auth. The redirect
  target is fixed server-side (`lib/actions.ts:30`). The callback sends `no-store` and `no-referrer`
  (`app/auth/callback/route.ts:13-16`). `session()` uses `getUser()` and requires a confirmed email
  (`lib/db.ts:22-27`); `private.actor()` requires the same in SQL. The sign-in form gives the same answer for
  known and unknown addresses.
- **Residual.** Control of the mailbox is control of the account; there is no second factor. G9, G10, G11.
  Sign-out is local to one browser. Production Auth settings are not in the repo (G23).

### T11 — CSRF on server actions

- **Mitigation.** All mutations are Next.js Server Actions: POST only, with the framework comparing `Origin` to
  the host; no `allowedOrigins` override is configured. Supabase cookies are `SameSite=Lax`. CSP
  `form-action 'self'` and `frame-ancestors 'none'` plus `X-Frame-Options: DENY` (`next.config.ts:5-11`). The
  only GET handlers are the media proxy (read-only) and the auth callback.
- **Residual.** The auth callback changes session state on GET (G10).

### T12 — Open redirect in the auth callback

- **Mitigation.** `app/auth/callback/route.ts` ignores every parameter except `code` and `token_hash` and
  redirects only to `/app` or `/login?expired=1` on `siteUrl`. `emailRedirectTo` is built from `siteUrl`.
  Redirects inside `action()` are fixed strings or a path plus a Zod-validated UUID.
- **Residual.** If `NEXT_PUBLIC_SITE_URL` is unset, redirects go to `http://localhost:3000` (`lib/env.ts:4`).
  An availability problem, not an open redirect.

### T13 — XSS

- **Mitigation.** React escapes all output; there is no raw-HTML rendering in `app/` or `components/` at the
  time of writing. `plain()` in `lib/validate.ts` rejects `<` and `>` in names, listing text, report details and
  reasons; `private.public_text` rejects markup and links again in SQL. Media responses are always
  `image/webp` with `nosniff`. `object-src 'none'` and `base-uri 'self'` are set.
- **Residual.** Chat bodies are not markup-filtered and rely on React escaping alone. The CSP has no
  `script-src`, and session cookies are readable by script (G9).

## 4. Gaps found

Ordered roughly by importance. "Verified" means reproduced locally as described under Method.

| # | Gap | Where | Impact | Suggested fix |
|---|---|---|---|---|
| G1 | **Hidden profiles can still be sent interest.** The guard `opposite='passed' or not (opposite='sent' or …)` evaluates to NULL, not true, when the target has no interest row towards the caller, so the "Candidate unavailable" check is skipped for non-discoverable targets. Verified | `supabase/migrations/20261112121833_workflows.sql:219-221` | Anyone who holds a profile id (for example from before the person switched discoverability off) can send interest, which the hidden person then sees. Distinct error messages also reveal whether the hidden profile overlaps on area, budget and dates | Wrap both comparisons in `coalesce(…, false)` or use `is not distinct from` |
| G2 | **Dealbreaker check can be bypassed with any `listing` argument.** The `listing` id is not required to belong to `target`. Passing any UUID, even a non-existent one, skips the person-to-person dealbreaker check and finds no household rules to compare. Verified | `workflows.sql:229-231` | A member whose habits conflict with someone's dealbreaker can still send them interest | Require `listing` to be an active listing owned by `target`, else treat it as null |
| G3 | **`moderate('request', …, 'fulfill')` always fails** with "column reference "kind" is ambiguous" (parameter and column share a name). Verified | `workflows.sql:449` | Export and support requests can never be marked fulfilled; the privacy queue cannot be worked in-app | Qualify the column (`r.kind`) or rename the parameter |
| G4 | **Listing expiry job does not run and may not be runnable.** `expire_rooms()` has invoker rights and is granted only to `service_role`, which is given no table privileges by the migration; nothing schedules it. Verified failing with "permission denied" on plain PostgreSQL; on Supabase it depends on project default privileges | `workflows.sql:468-474`, `:485-486`; `foundation.sql:126-127`; `vercel.json` (no crons) | Status stays `active` after expiry. Members are still protected because reads test `expires_at`, but owner and moderator views and counts by status are wrong | Make it `SECURITY DEFINER`, and schedule it |
| G5 | **Rate limits count only successful calls, and counters are never purged.** The counter increment is rolled back when the RPC raises. Verified | `workflows.sql:12-18` | Unlimited failing calls (probing, load). `private.rate_buckets` grows without bound | Count attempts outside the failing transaction or at the edge; add a purge |
| G6 | **Account closure does not erase data, and photo files are never deleted.** Closure hides the profile and removes listings from view, but profile, answers, messages, interests, photo rows, storage objects and the Auth user remain. Delete requests cannot be marked fulfilled. Verified | `workflows.sql:393-399`, `:449`; only `removePhoto` in `lib/actions.ts:106-113` deletes objects | Privacy promises about deletion cannot be kept by the app as built | Build an erasure job; delete storage objects on fill, remove and closure |
| G7 | **A person or message cannot be reported once they are no longer visible.** `file_report` requires the target to be currently readable, so it fails after the other person pauses, closes, is suspended, or after a block. Verified | `workflows.sql:373-381` with `foundation.sql:108-112` | An abuser can send a message and pause their profile; the recipient loses both the chat and the ability to report it | Allow reports on any conversation the reporter was ever a member of |
| G8 | **Suspended members cannot appeal through the report form.** `file_report` calls `private.actor()`, which rejects suspended accounts, although the `appeal` category exists and the comment on `data_request` says they can appeal. Only `data_request('support')` works. Verified | `workflows.sql:368`, `:379`, comment at `:389` | Appeals sent through the wrong form fail with a generic access error | Route appeals to the support request, or exempt `appeal` from the status check |
| G9 | **Session tokens are readable by script and the CSP does not restrict scripts.** `@supabase/ssr` sets auth cookies with `httpOnly: false` by default and no cookie options are overridden; the CSP has no `script-src` or `default-src` | `lib/db.ts:13-16`, `proxy.ts:7-15`, `next.config.ts:10` | Any XSS becomes session theft | Add a nonce-based `script-src`; consider HttpOnly cookie options |
| G10 | **The auth callback accepts `token_hash` on a GET with no binding to the requesting browser.** | `app/auth/callback/route.ts:10-12` | Login CSRF (a victim is signed in to the attacker's account), and mail scanners that pre-open links can consume the token | Accept only the PKCE `code` flow, or require a confirmation click |
| G11 | **No bot protection on sign-in, and sign-up is open.** `signInWithOtp` creates users by default; no CAPTCHA | `lib/actions.ts:26-33` | Mail-bombing third parties within Supabase's limits; cheap multi-accounting | Enable Supabase CAPTCHA; add an edge rate limit |
| G12 | **Onboarding can be completed without lifestyle answers.** `save_privacy` activates any draft profile. Verified | `workflows.sql:92-99` | Active profiles with no answers; dealbreaker checks pass trivially for them | Require progress `preferences` before activation |
| G13 | **An owner can renew a listing that a moderator expired.** `renew` accepts `expired` whenever `reviewed_at` is set. Verified | `workflows.sql:151` against `:434` | Moderator "expire" is not sticky; only "remove" is | Clear `reviewed_at` on moderator expiry |
| G14 | **Scam flag is substring-based and moderators never see it.** "occupied" is flagged because it contains `upi`. Verified | `workflows.sql:268` | Warning fatigue; no moderation signal | Word-boundary matching; surface flagged counts to moderators |
| G15 | **Blocking does not cancel an open visit or delete the shared address, and there is no unblock.** Verified | `workflows.sql:357-366` | A confirmed visit and its address stay stored after a block (unreadable, but retained) | Cancel open visits and delete the address inside `block_account` |
| G16 | **Image decoding and the storage upload happen before the photo rate limit is checked.** | `lib/actions.ts:86-101` | CPU and storage churn from a single account | Check a limit before decoding |
| G17 | **Duplicate photo detection is per listing only.** | `foundation.sql:57` | The same photos can be reused across listings and accounts unnoticed | Index `digest` globally and warn moderators |
| G18 | **Some usage data is not consent-gated or is identifiable.** `match_feedback` stores votes with the user id regardless of analytics consent; `product_events` rows carry user ids and are readable by moderators | `workflows.sql:407-412`; `foundation.sql:158` | Mismatch with "opt-in analytics" wording | Gate feedback on consent or document it; aggregate before display |
| G19 | **Moderator grants are unaudited and moderator RPCs are unthrottled.** | `foundation.sql:31`; `workflows.sql:422-464` | A compromised moderator account can act at volume; no record of who granted access | Log grants; add throttles and alerts |
| G20 | **`ff_intent` cookie has no `secure` attribute.** | `lib/actions.ts:23` | Low; value is not sensitive | Add `secure` in production |
| G21 | **A listing approved more than 21 days after submission is already expired.** Expiry is computed from `confirmed_at`, set at submission | `workflows.sql:431` | Slow review yields an invisible "active" listing | Compute from approval time |
| G22 | **`discover_people` takes any city and is unthrottled.** | `workflows.sql:190-200` | Any active account can poll the 80 most recently updated discoverable profiles of each city, with full answers | Restrict to the caller's city; add a read limit |
| G23 | **Production Auth and project settings are not in the repo.** `supabase/config.toml` configures local development only | `supabase/config.toml` | Redirect allow-list, OTP expiry, CAPTCHA, anonymous sign-ins and default privileges must be set by hand and can drift | Document and check them at release |
| G24 | **Age is a self-declared checkbox.** | `foundation.sql:19`; `workflows.sql:62` | Minors can sign up | Product and legal decision |

## 5. Assumptions this model depends on

- Schema `private` is never added to the API's exposed schemas. Five helper functions there are executable by
  `authenticated` because RLS policies need them (`foundation.sql:118`).
- Anonymous sign-ins stay disabled in Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY` exists only as a server-side environment variable.
- New pages keep calling `requireSession`, `requireProfile` or `requireModerator`; `proxy.ts` refreshes sessions
  but does not block anything.
- No page renders member text as raw HTML.
