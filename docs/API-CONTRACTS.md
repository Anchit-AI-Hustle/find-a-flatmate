# API Contracts

_November 2026 · Sources: `supabase/migrations/20261112121833_workflows.sql` as amended by
`20261112160000_hardening.sql`, `lib/actions.ts`, `lib/validate.ts`, and the four route handlers under `app/`_

## 1. Conventions

- **The RPCs are the security boundary.** The Supabase URL and publishable key are public by design, so any
  signed-in person can call an RPC directly with their own token. Server actions add validation and friendlier
  errors; they are not relied on for authorisation.
- Tables are read-only for clients (see DATA-MODEL.md). All writes are RPCs.
- All public RPCs are `SECURITY DEFINER` with `search_path = ''`.
- Execute grants are explicit. Everything is revoked from `public`, `anon` and `authenticated`, then granted:

| Role | May execute |
|---|---|
| `anon` | `public_inventory`, `public_rooms` |
| `authenticated` | Everything except the three service-only functions |
| `service_role` | `attach_sanitized_photo`, `detach_sanitized_photo`, `expire_rooms` |

### The actor check

Write RPCs start with `private.actor()`. It returns `auth.uid()` and raises SQLSTATE `42501` unless the caller is
signed in, has a confirmed email, and does not have a `closed` or `suspended` profile. `data_request` uses its own
check so closed and suspended members can still reach it; that is also how a suspended member appeals
(`kind = 'support'`).

### Errors

| SQLSTATE | Raised by | What the server action shows |
|---|---|---|
| `P0001` | Every plain `raise exception` (business rules, rate limits) | The database message, unchanged |
| `42501` | `private.actor()`, chat access, moderator checks | "You don't have access to do that." |
| `23505` | Unique violations, for example a duplicate photo | "That item already exists." |
| other | Check and not-null violations, casts | "We couldn't save that. Check your entries and try again." |
| Zod failure | Form validation in the server action | The refine message, or "Check the highlighted form requirements and try again." |

### Rate limits

`private.throttle(user, kind, cap, minutes = 60)` counts calls per member in fixed windows aligned to the clock
(hourly windows, or UTC days for 1440-minute limits). Exceeding the cap raises
"Too many requests. Try again later." Two properties to know:

- The counter is incremented inside the same transaction, so a call that fails for any reason is **not counted**.
- Limits are per account. There is no per-IP limit in this codebase.

| Kind | Cap | Window | RPC |
|---|---|---|---|
| `basics` | 30 | 1 hour | `save_basics` |
| `lifestyle` | 30 | 1 hour | `save_lifestyle` |
| `privacy` | 30 | 1 hour | `save_privacy` |
| `listing_edit` | 35 | 1 hour | `save_listing` |
| `listing_create` | 5 | 1 day | `save_listing` (new listings) |
| `listing_status` | 25 | 1 hour | `listing_transition` |
| `photos` | 15 | 1 hour | `attach_sanitized_photo` |
| `interest` | 35 | 1 hour | `interest_transition` |
| `message` | 45 | 1 hour | `send_message` |
| `visit` | 20 | 1 hour | `visit_transition` |
| `visit_location` | 15 | 1 hour | `visit_location` |
| `save` | 80 | 1 hour | `save_item` |
| `block` | 30 | 1 hour | `block_account` |
| `report` | 12 | 1 day | `file_report` |
| `data_request` | 8 | 1 day | `data_request` |
| `waitlist` | 8 | 1 hour | `join_waitlist` |
| `feedback` | 8 | 1 hour | `match_feedback` |
| `event` | 40 | 1 hour | `track_product_event` |

Not throttled: all read RPCs, `mark_read`, `moderate`, `review_reported_message`, `detach_sanitized_photo`,
and the export route.

## 2. RPC reference

"Member" means an authenticated caller who passes the actor check.

### Profile and onboarding

| RPC | Caller | Effect | Errors (besides rate limit) |
|---|---|---|---|
| `save_basics(v jsonb)` | Member | Creates the profile as `draft` or updates name, city, localities, budget, dates, stay and intent. Records terms consent (`2026-11`), the email verification row, and onboarding step `lifestyle`. Keys: `name`, `city`, `areas[]`, `min`, `max`, `from`, `until`, `months`, `intent`, `adult`, `terms` | "Confirm age and accept the terms"; "Choose localities in the selected city"; "Choose a current move-in window"; "Keep links, contact details and markup out of public content" |
| `save_lifestyle(answers jsonb)` | Member with a profile | Replaces all answers. Object keyed by dimension, each `{habit?, want?, strength}` from the fixed catalogue | "Invalid lifestyle answers" |
| `save_privacy(v jsonb)` | Member with a profile | Sets `discoverable`, `status` (`active` or `paused`), reminders and analytics consent. From `draft` only `status = active` is accepted, and only after `save_lifestyle` has been called at least once (an empty answer set counts); it completes onboarding | "Complete the basics first"; "Invalid profile status"; "Finish onboarding first"; "Answer or skip the lifestyle questions first" |
| `own_answers()` | Authenticated | Returns the caller's answers as JSON | — |

### Listings

| RPC | Caller | Effect | Errors |
|---|---|---|---|
| `save_listing(l uuid, v jsonb) → uuid` | Member with an active profile | `l` null: creates a draft. `l` set: updates the caller's listing and returns it to `draft`. Replaces amenities and house rules. Title, description, transport and restrictions pass the public-text filter | "Activate your profile first"; "Confirm permission and enter valid house rules"; "Choose a current availability window"; "This listing cannot be edited"; "Close an existing listing first" (8 open); "A similar listing already exists. Edit it instead." |
| `listing_transition(l uuid, action text)` | Owner with an active profile | `submit`, `pause`, `renew`, `fill` as in DATA-MODEL.md | "Listing unavailable"; "That change is not available. Submission needs a photo and current dates." |
| `attach_sanitized_photo(u, l, p, d) → uuid` | `service_role` only | Links an uploaded object to a draft listing owned by `u`. Path must be `<u>/<l>/<uuid>.webp`, digest 64 hex characters, object must exist, at most 6 photos | "Invalid photo"; "Use at most six photos"; duplicate digest → `23505` |
| `detach_sanitized_photo(u, i) → text` | `service_role` only | Deletes the image row of a draft listing owned by `u`; returns the storage path | "Only draft photos can be removed" |
| `expire_rooms() → integer` | `service_role` only | Marks `active` listings past `expires_at` as `expired` and returns the count. Called daily by `/api/cron/expire` | — |

### Discovery (read only)

| RPC | Caller | Returns |
|---|---|---|
| `public_inventory()` | Anyone | `(city_id, live_rooms)` per city |
| `public_rooms(city, locality, room_id)` | Anyone | Up to 50 live rooms: id, title, city, locality, room type, the seven cost fields, availability dates, `reviewed_at`, `confirmed_at`. No owner, description, photos or rules. Blocked owners are filtered for signed-in callers |
| `discover_people(city, candidate uuid = null)` | Member with an active profile | Up to 80 rows, most recently updated first: id, name, city, localities, budget range, dates, stay, intent, `email_verified`, answers. List mode: discoverable people in **the caller's own city** (the `city` argument is ignored) whose window has not ended, excluding people the caller passed or withdrew from, and people who passed on the caller. Candidate mode: one person, if discoverable, already matched, or has sent the caller interest |
| `inbox()` | Authenticated | Up to 100 usable conversations: id, other member id and name, unread count, last activity |
| `read_visit_location(v uuid)` | Conversation member | The address, only for a `confirmed` visit and only from 24 hours before to 2 hours after its start; otherwise null |

### Connection and chat

| RPC | Caller | Effect | Errors |
|---|---|---|---|
| `interest_transition(target uuid, action text, listing uuid = null) → uuid` | Member, active, not blocked | `like`, `pass`, `withdraw`, `reset`. Returns the conversation id when the like makes the pair mutual (or already is), otherwise null. Rules for a like are in the list below | "Candidate unavailable"; "Listing unavailable"; "Use block to end an existing connection"; "This room does not fit your locality, budget, dates or length of stay"; "No overlapping location, budget, or move-in dates"; "A household rule conflicts with a dealbreaker"; "A lifestyle dealbreaker conflicts"; "Interest change unavailable" |
| `send_message(c uuid, body text, request_key uuid)` | Conversation member, both active, not blocked | Stores the message with control characters replaced by spaces. Repeating a `request_key` is a no-op. Sets `suspicious` on scam keywords (whole-word match for brand and identity terms). Refuses a third identical message within an hour | "Conversation unavailable" (`42501`); "Please avoid sending repeated messages" |
| `mark_read(c uuid, last_seen uuid)` | Conversation member | Moves the caller's read marker forward to that message | "Conversation unavailable" |

Rules for a `like`, in the order they are checked (`hardening.sql:39-58`):

1. A `listing`, if given, must be an `active`, unexpired listing owned by `target`.
2. The target must not have passed on the caller, and must be reachable: discoverable, or has already sent the
   caller interest, or owns the listing given.
3. Unless the target has already sent interest: with a `listing`, that listing must fit the caller (same city,
   locality in the caller's list, monthly cost ≤ maximum budget, dates intersect, stay ≥ minimum). Without one,
   the two profiles must overlap (city, a locality, budget ranges, dates).
4. Dealbreakers: with a `listing`, the caller's answers against the house rules, in both directions. Without
   one, the two people's answers, in both directions.

When the target has already sent interest, step 3 is skipped (THREAT-MODEL G25).

### Visits

| RPC | Caller | Effect | Errors |
|---|---|---|---|
| `visit_transition(c, v, action, at_time = null) → uuid` | Conversation member | `request` (with `v` null), `confirm`, `decline`, `reschedule`, `cancel`, `completed`, `no_show`. Rules in DATA-MODEL.md | "Choose a future time within 90 days"; "A visit is already open"; "Visit unavailable"; "That visit change is unavailable" |
| `visit_location(c, v, location text)` | Conversation member | Sets or (with null) clears the address of a future confirmed visit. Only the person who shared it can change it | "A future confirmed visit is required"; "Only the person who shared the location can change it" |

### Safety

| RPC | Caller | Effect | Errors |
|---|---|---|---|
| `save_item(kind, target, enabled)` | Member, active | Adds or removes a saved `profile` or `listing` the caller can currently see | "Activate your profile first"; "Profile unavailable"; "Listing unavailable"; "Unknown item" |
| `block_account(target uuid)` | Member with a profile | Records the block, sets both interests to `blocked`, deletes saved items between the two, cancels any open visit between them and deletes its shared address | "Account unavailable" |
| `file_report(subject, listing, message, category, details, also_block = false) → uuid` | Member with a profile | Exactly one of the three targets. `message`: any message in a conversation the caller belongs to, even after a block, pause or suspension. `subject`: a person the caller can currently see, or has ever matched with. `listing`: one the caller can currently read. Reporting yourself or your own message is refused. Optionally blocks the reported account | "Complete the basics first"; "Choose exactly one report subject"; "Report target unavailable" |

### Data and analytics

| RPC | Caller | Effect | Errors |
|---|---|---|---|
| `data_request(kind, details = null)` | Any signed-in, email-confirmed user, including closed or suspended | Queues an `export`, `delete` or `support` request. `delete` also closes the account immediately (PRIVACY-AND-SAFETY.md) | "Sign in first" (`42501`) |
| `join_waitlist()` | Member, active | Adds the caller and their city to the waitlist | — |
| `match_feedback(useful boolean)` | Member | Stores one vote | — |
| `track_product_event(event_name)` | Member | Accepts `discover_view`, `compatible_profile_opened`, `home_found_self_reported`. Stored only with analytics consent | "Invalid event" |

### Moderation

| RPC | Caller | Effect | Errors |
|---|---|---|---|
| `is_moderator() → boolean` | Authenticated | Whether the caller is in `private.moderators` | — |
| `moderate(kind, target, action, reason)` | Moderator | `listing`: `approve`, `reject`, `remove`, `expire`. `report`: `investigating`, `resolved`, `dismissed`, `escalated`. `profile`: `suspend`, `restore`. `request`: `fulfill` (export and support requests only; never `delete`). A listing `approve` sets expiry to the earlier of now + 21 days and the end of availability; `expire` also clears `reviewed_at`. Reason 5–500 characters. Writes `moderation_actions` and `admin_audit_logs` | "Moderator access required" (`42501`); "Enter a reason (5–500 characters)"; "Listing unavailable for independent review"; "Invalid listing transition"; "Invalid report transition"; "Moderator cannot change a moderator account"; "Invalid profile transition"; "Invalid request action"; "Only export or support requests can be marked handled here"; "Invalid moderation target" |
| `review_reported_message(report_id, justification) → text` | Moderator | Returns the body of the one reported message, for a report that is `investigating` or `escalated`. Justification 10–500 characters. Access is logged | "Moderator access and a case justification required" (`42501`); "No message evidence in this open investigation" |
| `moderation_profiles()` | Moderator | 60 most recently updated profiles: id, name, status, created date. Empty for anyone else | — |

## 3. Server actions (`lib/actions.ts`)

All four exports are Next.js Server Actions (POST only, same-origin checked by the framework).

| Export | Input | Behaviour |
|---|---|---|
| `selectIntent(raw)` | One of the three intents | Sets cookie `ff_intent` (httpOnly, lax, `secure` in production, 1 hour), then redirects to `/onboarding/basics` if signed in, else `/login` |
| `login(state, form)` | `email` | `signInWithOtp` with redirect to `<site>/auth/callback`. Same success message whether or not the address is known |
| `logout()` | — | Signs out this browser only (`scope: 'local'`), redirects to `/` |
| `action(op, state, form)` | See below | Requires a session with a confirmed email. Validates, calls one RPC with the caller's own token, revalidates `/app` and `/admin`, then redirects or returns `{success}` or `{error}` |

Unknown form fields are dropped by Zod. Money fields are rupee strings (`12345` or `12345.50`) converted to paise.
Checkboxes send `on`.

| `op` | Form fields | RPC | After success |
|---|---|---|---|
| `basics` | `name`, `city`, `areas` (multi, 1–4), `min`, `max`, `from`, `until`, `months`, `intent`, `adult`, `terms`; optional `editing=yes` | `save_basics` | `/onboarding/lifestyle`, or `/app/profile` when editing |
| `lifestyle` | For each dimension: `<dimension>_habit`, `<dimension>_want`, `<dimension>_strength` (strength required if either is given); optional `editing=yes` | `save_lifestyle` | `/onboarding/preferences`, or `/app/profile` |
| `privacy` | `discoverable`, `analytics`, `reminders`, `status` (`active`, `paused` or absent); optional `onboarding=yes` | `save_privacy` | `/onboarding/complete` during onboarding |
| `listing` | `id` (empty for new), `title`, `description`, `city_id`, `locality_id`, `room_type`, `building`, `furnishing`, `bath_sharing`, `rooms`, `bathrooms`, `occupants`, `capacity`, `poster_type`, `attested`, `transport`, `restrictions`, `rent`, `maintenance`, `utilities` (may be empty), `recurring`, `deposit`, `brokerage`, `fees`, `available_from`, `available_until`, `min_months`, `amenities` (multi), plus house-rule fields named like `lifestyle` | `save_listing` | New listing: `/app/listings/<id>/edit` |
| `listingState` | `id`, `action` (`submit`, `pause`, `renew`, `fill`) | `listing_transition` | — |
| `interest` | `target`, `action` (`like`, `pass`, `withdraw`, `reset`), optional `listing` | `interest_transition` | `/app/messages/<conversation>` when mutual |
| `save` | `kind` (`listing`, `profile`), `target`, `enabled` (`yes`, `no`) | `save_item` | — |
| `block` | `target`, `confirm` | `block_account` | `/app/matches` |
| `report` | exactly one of `subject`, `listing`, `message`; `category` (the form offers scam, harassment, underage, stale, privacy, other); `details` (5–1200); `also_block` | `file_report` | `/app/matches` if also blocking |
| `message` | `c`, `body` (1–1500), `request_key` | `send_message` | — |
| `visit` | `c`, optional `v`, `action`, `at_time` (`YYYY-MM-DDTHH:mm`, read as IST) | `visit_transition` | — |
| `location` | `c`, `v`, `location` (4–300, empty clears) | `visit_location` | — |
| `request` | `kind` (`delete`, `export`, `support`), `details`, `confirm` (required for delete) | `data_request`; for `delete`, then a best-effort removal of the member's stored photo files with the service role | — |
| `moderate` | `kind`, `target`, `action`, `reason` (5–500) | `moderate` | — |
| `evidence` | `report_id`, `justification` (10–500) | `review_reported_message` | Returns the message in `evidence` |
| `waitlist` | — | `join_waitlist` | — |
| `feedback` | `useful` (`yes`, `no`) | `match_feedback` | — |
| `found` | — | `track_product_event('home_found_self_reported')` | — |
| `upload` | `id` (listing), `photo` (file), `permission` | Storage upload, then `attach_sanitized_photo` with the service role | — |
| `removePhoto` | `id` (image) | `detach_sanitized_photo`, then storage delete | — |

`upload` accepts JPEG, PNG or WebP between 10 bytes and 2.5 MB, single frame, at most 20 megapixels. The image is
decoded with sharp, auto-rotated, fitted inside 1200 × 1200, re-encoded as WebP (quality 78, metadata dropped),
and must be ≤ 750,000 bytes. The stored path is `<user>/<listing>/<random uuid>.webp`. Server action bodies are
limited to 3 MB (`next.config.ts`).

The 180-day limit on move-in and availability windows is checked in Zod ("Keep your move-in window within 180
days", "Keep the availability window within 180 days") and again by table constraints. Validation that exists
**only** in SQL: windows that have not already ended, the public-text filter for links, emails, phone numbers
and markup, and every state rule.

## 4. Route handlers

| Route | Method | Auth | Behaviour |
|---|---|---|---|
| `/auth/callback` | GET | none | PKCE only. With `code`: exchanges it for a session, which works only in the browser that requested the link. Success → 302 to `<site>/app`. Anything else, including a `token_hash` link → 302 to `<site>/login?expired=1`. Both responses send `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. The destination is fixed; no parameter controls it |
| `/api/media/[id]` | GET | Session with confirmed email | `id` must be a UUID. Looks up `listing_images.path` with the caller's token, so RLS decides visibility, then streams the object using the service role. Headers: `Content-Type: image/webp`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Every failure is a bare 404 |
| `/app/settings/data/export` | GET | Session with confirmed email; works for suspended and closed accounts | Returns a JSON attachment (`find-a-flatmate-my-data.json`, `Cache-Control: private, no-store`). Without a session: 401. Contents below |
| `/api/cron/expire` | GET | `Authorization: Bearer <CRON_SECRET>` | Calls `expire_rooms()` with the service role and returns `{"expired": n}`. 401 if the secret is unset or wrong; 503 if the service key is not configured; 500 if the RPC fails. Scheduled in `vercel.json` at `30 20 * * *` UTC (about 02:00 IST) |

Export contents. Everything except `messages_sent` is read with the member's own token, so RLS applies:

| Key | Source |
|---|---|
| `account` | Auth user id, email, created date |
| `profile`, `answers`, `consents`, `notifications`, `verification` | The member's rows in `profiles`, `user_preference_answers`, `user_consents`, `notification_preferences`, `verification_checks` |
| `listings` | Own listings with amenities, house rules and photo ids |
| `interests` | Interests the member sent (`actor_id`) |
| `saved`, `blocks`, `reports_filed`, `requests`, `waitlist` | Own rows |
| `visits` | Visit requests the member created (`requester_id`); not those proposed by the other person |
| `messages_sent` | Messages the member sent, read with the service role by the session user id so they are included after a block. Falls back to the member's own token if no service key is set. A failed read yields an empty list, not an error |

Not in the export: messages received, matches, visit history events, analytics events, ranking feedback,
moderation records.

`proxy.ts` refreshes Supabase session cookies on `/app/*` (including the export route), `/admin/*`,
`/onboarding/*`, `/login` and `/api/media/*`. It does not run for `/api/cron/*`. It does not block requests; pages call `requireSession`, `requireProfile` or `requireModerator`.
