# Personas and Journeys

_November 2026_

The personas are **proto-personas**: working assumptions, not research findings. They carry no quotes or statistics.
Journeys are mapped to routes, to the `action(op, …)` server action in `lib/actions.ts`, and to the SQL RPCs that
enforce each state change. State machines are specified in [DATA-MODEL.md](DATA-MODEL.md).

The UI is being built in parallel. Route names follow the agreed route list; behaviour described here is what the
server actions and RPCs enforce, whatever the page looks like.

## Personas

| Persona | Intent value | Situation (assumed) | Main worry (assumed) |
|---|---|---|---|
| Room seeker | `looking_for_room` | Moving for work or study, fixed budget, short timeline | Fake listings, hidden costs, incompatible flatmates |
| Household filling a vacancy | `have_room` | Occupant or owner with a room to fill | Strangers getting contact details, time-wasters, a bad fit |
| People forming a household | `find_together` | No flat yet; wants co-tenants first | Finding people with the same budget, area and dates |
| Moderator | row in `private.moderators` | Internal reviewer | Approving real listings, handling reports without over-reading private chat |

## Shared entry: landing to active profile

| # | Step | Route | Server action / RPC | State change |
|---|---|---|---|---|
| 1 | Read what the product does | `/`, `/how-it-works`, `/safety`, `/pricing`, `/about`, `/help`, `/privacy`, `/terms`, `/community-guidelines` | none | none |
| 2 | Browse live rooms without an account | `/city/[city]`, `/city/[city]/[locality]`, `/listing/[id]` | `public_rooms`, `public_inventory` (anon) | none. Only title, locality, room type, costs, dates and review/confirmation dates are returned. No photos, description or owner |
| 3 | Choose an intent | `/` or `/onboarding/intent` | `selectIntent` | Sets the `ff_intent` cookie for one hour, then goes to `/login` or `/onboarding/basics` |
| 4 | Sign in | `/login` | `login` → Supabase `signInWithOtp` | Magic link emailed |
| 5 | Open the link **in the same browser** | `/auth/callback` | `exchangeCodeForSession` (PKCE only) | Session cookies set; redirect to `/app`, or `/login?expired=1` on failure, including when the link is opened in another browser |
| 6 | Basics | `/onboarding/basics` | op `basics` → `save_basics` | Profile created as `draft`; terms consent recorded; `email` verification row; progress `lifestyle` |
| 7 | Lifestyle (answer or skip) | `/onboarding/lifestyle` | op `lifestyle` → `save_lifestyle` | Answers replaced; progress `preferences`. Saving with no answers counts as skipping |
| 8 | Privacy choices | `/onboarding/preferences` | op `privacy` with `status=active` → `save_privacy` | Refused until step 7 has been saved. Profile `draft → active`; progress `complete`; analytics consent stored; `onboarding_completed` event if consented |
| 9 | Done | `/onboarding/complete` | none | none |

Notes:

- `requireProfile()` in `lib/db.ts` sends people without a profile to `/onboarding/intent`, draft profiles back to
  the step in `onboarding_progress`, and suspended or closed accounts to `/app/settings/data`.
- SQL enforces the order: step 8 fails with "Answer or skip the lifestyle questions first" until step 7 has
  been saved. A member who skips every question is active with no answers; scores are then withheld (see
  MATCHING-SPEC.md).

## Journey A — Room seeker

| # | Workflow stage | Route | Server action / RPC | State change |
|---|---|---|---|---|
| 1 | Discover | `/app`, `/app/discover` | `discover_people` (always the member's own city); `listings` read under RLS; `track_product_event('discover_view')` | none |
| 2 | Understand the fit | `/app/people/[id]`, `/app/rooms/[id]` | `discover_people(null, id)`; `matchPeople` / `matchRoom`; `compatible_profile_opened` event on the person page | none |
| 3 | Shortlist | `/app/saved` | op `save` → `save_item` | `saved_items` row added or removed |
| 4 | Connect safely | `/app/people/[id]` or `/app/rooms/[id]` | op `interest` (`like`, with `listing` from a room page) → `interest_transition` | Interest `sent`. From a room page the room itself must be live, owned by that person and fit the seeker's locality, budget, dates and stay; from a person page the two profiles must overlap. Refused if a dealbreaker conflicts on either side |
| 5 | Wait or act on incoming interest | `/app/matches` | op `interest` (`like` / `pass` / `withdraw` / `reset`) | `sent → mutual` when both like; match and conversation created; redirect to the chat |
| 6 | Talk | `/app/messages`, `/app/messages/[id]` | op `message` → `send_message`; `mark_read`; `inbox` | Message stored; flagged `suspicious` if it matches scam keywords |
| 7 | Schedule a visit | chat thread, `/app/visits` | op `visit` (`request`) → `visit_transition` | Visit `requested` |
| 8 | Confirm and get the address | `/app/visits` | op `visit` (`confirm`, by the person who did not propose); op `location` → `visit_location`; `read_visit_location` | Visit `confirmed`. Address readable from 24 hours before to 2 hours after the start |
| 9 | Clarify costs and expectations | `/app/rooms/[id]` | none (`Receipt`, house rules) | none |
| 10 | Record the visit | `/app/visits` | op `visit` (`completed` or `no_show`) | Terminal visit state |
| 11 | Decide and move in | `/app`, `/app/profile` | op `found` → `track_product_event('home_found_self_reported')`; op `privacy` (`status=paused`) | Outcome event if consented; profile `paused` |

At any point: op `block` → `block_account`; op `report` → `file_report`; `/app/settings/privacy` for
discoverability and analytics; `/app/settings/data` to download a JSON export
(`GET /app/settings/data/export`), contact support, appeal a suspension, or close the account (op `request`).

## Journey B — Household filling a vacancy

| # | Stage | Route | Server action / RPC | State change |
|---|---|---|---|---|
| 1 | Onboard with intent `have_room` | shared entry | as above | Profile `active` (required before listing) |
| 2 | Draft the listing | `/app/listings/new` | op `listing` → `save_listing(null, …)` | Listing `draft`; redirect to `/app/listings/[id]/edit` |
| 3 | Add photos | `/app/listings/[id]/edit` | op `upload` → sharp re-encode → `attach_sanitized_photo`; op `removePhoto` | Up to six photos, draft only |
| 4 | Submit | `/app/listings` | op `listingState` (`submit`) → `listing_transition` | `draft → pending_review`; needs a photo and a current availability window |
| 5 | Review | — | moderator `moderate('listing', id, 'approve' or 'reject')` | `pending_review → active` (expires 21 days after approval, or at the end of availability if sooner) or back to `draft` |
| 6 | Receive interest | `/app/matches` | op `interest` | As Journey A steps 5–6 |
| 7 | Host visits | `/app/visits` | ops `visit`, `location` | As Journey A steps 7–10 |
| 8 | Keep it fresh | `/app/listings` | op `listingState` (`renew`, `pause`) | `renew` restarts the 21-day window and logs a reconfirmation; `pause` hides it. A listing that lapses is marked `expired` by the daily job and can be renewed. One a moderator expired cannot: it must be edited and reviewed again |
| 9 | Edit | `/app/listings/[id]/edit` | op `listing` → `save_listing(id, …)` | Any edit returns the listing to `draft` and clears review, confirmation and expiry |
| 10 | Close | `/app/listings` | op `listingState` (`fill`) | `filled`; `home_found_self_reported` event if consented |

## Journey C — People forming a household (P1)

What works today is one-to-one matching between people, whatever their intent.

| # | Step | Route | Server action / RPC | State change |
|---|---|---|---|---|
| 1 | Onboard with intent `find_together` | shared entry | as above | Profile `active` |
| 2 | Find others | `/app/discover` | `discover_people`; `matchPeople` | none. SQL does not filter by intent |
| 3 | Connect and talk | `/app/matches`, `/app/messages` | ops `interest`, `message` | As Journey A |
| 4 | Ask for more | `/app/group` (coming later) | op `waitlist` → `join_waitlist` | One row per member and city in `availability_waitlist` |

Not implemented: groups, shared shortlists, group compatibility, group chat. `feature_flags.household_groups` is off.

## Journey D — Moderator

| # | Task | Route | RPC | Rule enforced in SQL |
|---|---|---|---|---|
| 1 | Open the console | `/admin` | `is_moderator` via `requireModerator()` | Membership of `private.moderators`, granted only by direct database access |
| 2 | Review a listing | `/admin` | `moderate('listing', id, 'approve' / 'reject' / 'remove' / 'expire', reason)` | Cannot act on own listing; reason of 5–500 characters; every action logged twice |
| 3 | Triage a report | `/admin` | `moderate('report', id, 'investigating' / 'resolved' / 'dismissed' / 'escalated', reason)` | Only the transitions in DATA-MODEL.md |
| 4 | Read reported message evidence | `/admin` | op `evidence` → `review_reported_message(report_id, justification)` | Report must be `investigating` or `escalated`; justification 10–500 characters; returns that one message; access logged |
| 5 | Suspend or restore an account | `/admin` | `moderate('profile', id, 'suspend' / 'restore', reason)` | Not self, not another moderator |
| 6 | Record a data request as handled | `/admin` | `moderate('request', id, 'fulfill', reason)` | Export and support requests (including appeals) only. Deletion requests are completed by an operator outside the app |

Moderators cannot read chats, other members' profiles or lifestyle answers through the API. They see all listings
(any state), all reports, data requests, product events and a list of 60 recently updated profiles
(`moderation_profiles`: id, name, status, created date).

## Journey edge cases worth designing for

| Situation | What the back end does |
|---|---|
| One side pauses, is suspended or closes the account | The conversation, its messages, visits and the match become unreadable for **both** people (`private.can_chat`) |
| A member blocks another | Interests become `blocked`, saved items between them are deleted, chat disappears for both, any open visit is cancelled and its address deleted. There is no unblock |
| Reporting after contact is cut | A message in a conversation the member belongs to, or a person they matched with, can still be reported after a block, pause or suspension. A listing cannot, once it is no longer readable |
| Visit already open in a thread | A second request is refused; one open visit per conversation |
| Suspended member wants to appeal | `/app/settings/data` shows "Appeal or contact support", which sends `data_request('support', details)`. The report form does not offer an appeal |
| Accepting incoming interest | A like-back is not re-checked for location, budget or dates, so a match can form with someone shown as "Not a fit" |
| Listing availability window ends | The listing stops being readable once `expires_at` passes; the daily job then sets it to `expired`; the owner can renew only while `available_until` is today or later |

## Routes outside the member journeys

| Route | Purpose | Access |
|---|---|---|
| `/app/rooms/[id]` | Signed-in room detail: full listing, photos, receipt, fit, interest and report | Active profile |
| `/app/settings/data/export` | JSON download of the member's own data | Any signed-in account, including suspended and closed |
| `/offline` | Service-worker fallback page | Public |
| `/api/media/[id]` | Photo proxy | Signed-in; RLS decides |
| `/api/cron/expire` | Daily housekeeping that marks lapsed listings `expired` | `Authorization: Bearer <CRON_SECRET>`; called by Vercel Cron |
