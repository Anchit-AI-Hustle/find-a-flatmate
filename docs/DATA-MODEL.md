# Data Model

_November 2026 · Source: `supabase/migrations/20261112121832_foundation.sql` (schema, RLS, bucket),
`20261112121833_workflows.sql` (RPCs) and `20261112160000_hardening.sql` (replacements for eight RPCs; no table
changes)_

## 1. Ground rules

- Every `public` table has row level security enabled. All privileges are revoked from `public`, `anon` and
  `authenticated`; `authenticated` gets `SELECT` only. `anon` can read `cities` and `localities` only.
- **No client can insert, update or delete.** Every write goes through a `SECURITY DEFINER` RPC that takes the
  actor from `auth.uid()` (see API-CONTRACTS.md).
- Schema `private` holds tables and helpers that are never exposed through the API.
- Money is stored as **integer paise** (₹1 = 100 paise). No floating point is used anywhere.
- "Today" in business rules means the date in `Asia/Kolkata`. Timestamps are `timestamptz`.
- There are no triggers; `updated_at` is set by the RPCs.

## 2. Enums

| Enum | Values |
|---|---|
| `intent` | `looking_for_room`, `have_room`, `find_together` |
| `profile_state` | `draft`, `active`, `paused`, `closed`, `suspended` |
| `listing_state` | `draft`, `pending_review`, `active`, `paused`, `expired`, `filled`, `removed` |
| `interest_state` | `sent`, `mutual`, `passed`, `withdrawn`, `blocked` |
| `visit_state` | `requested`, `confirmed`, `declined`, `rescheduled`, `cancelled`, `completed`, `no_show` |
| `report_state` | `open`, `investigating`, `resolved`, `dismissed`, `escalated` |

Text columns with `CHECK` lists: answer `strength` (`flexible`, `preference`, `dealbreaker`); `room_type`
(`private_room`, `shared_room`, `entire_flat`, `other`); `building`; `furnishing`; `bath_sharing`; `poster_type`
(`Occupant`, `Owner`); amenity (7 values); report `category` (`scam`, `harassment`, `underage`, `stale`,
`privacy`, `appeal`, `other`; `appeal` is no longer offered or usable for a self-report); data request `kind` (`export`, `delete`, `support`) and `status` (`pending`,
`fulfilled`); consent `purpose` (`terms`, `analytics`); onboarding `step` (`lifestyle`, `preferences`, `complete`).

## 3. Tables

### Catalogue

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `cities` | Pilot cities | `id` PK, `name`. Seeded: `gurugram`, `noida` |
| `localities` | Localities per city | PK `(city_id, id)`. Seeded: `dlf-phase-3`, `sector-56`, `sector-62`, `sector-137` |
| `feature_flags` | Off-by-default flags | `id` PK, `enabled`. Seeded off: `household_groups`, `ai_assistance`, `billing`. No read policy, so clients cannot read it |

### People

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `profiles` | One row per member | `id` PK → `auth.users` (cascade). `display_name` 2–60 chars. `age_confirmed` must be true. `city_id` FK. `localities text[]` 1–4 items. `budget_min ≥ 0`, `budget_max` between `budget_min` and 50,000,000. `move_until` between `move_from` and `move_from + 180` days. `stay_months` 1–36. `intent`. `status` default `draft`. `discoverable` default true |
| `user_preference_answers` | Lifestyle answers | PK `(user_id, dimension)`. `habit`, `expectation`, `strength` |
| `onboarding_progress` | Furthest onboarding step | PK `user_id`. `step` |
| `user_consents` | Consent ledger | PK `(user_id, purpose)`. `granted`, `revision` (`2026-11`), `updated_at` |
| `notification_preferences` | Reminder opt-in | PK `user_id`. `reminders` default false |
| `verification_checks` | Trust evidence | `kind` can only be `email`. Unique `(user_id, kind)`. `verified_at` |
| `private.moderators` | Moderator list | PK `user_id` → `auth.users`. No RPC writes to it |

### Listings

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `listings` | A room or flat on offer | `owner_id` → `profiles`. `title` 8–90, `description` 10–1200. `(city_id, locality_id)` FK → `localities`. `rooms`, `bathrooms` 1–20; `occupants` 0–20; `capacity` between `occupants + 1` and 20. `attested` must be true. `transport`, `restrictions` ≤ 300. Costs below. `available_until` between `available_from` and `+180` days. `min_months` 1–36. `status` default `draft`. `confirmed_at`, `expires_at`, `reviewed_at` |
| `listing_amenities` | Amenities | PK `(listing_id, amenity)`, value list checked |
| `household_preferences` | House rules, same shape as personal answers | PK `(listing_id, dimension)` |
| `listing_images` | Photo records | `path` unique, `digest` (SHA-256 hex). Unique `(listing_id, digest)` |
| `listing_reconfirmations` | Log of each renewal | `listing_id`, `created_at` |

Listing money columns, all integer paise:

| Column | Range | Notes |
|---|---|---|
| `rent` | 100 – 50,000,000 | |
| `maintenance`, `recurring`, `deposit`, `brokerage`, `fees` | 0 – 50,000,000 | |
| `utilities` | null or 0 – 50,000,000 | null means "not known yet" |
| `monthly` | generated, stored | `rent + maintenance + coalesce(utilities, 0) + recurring` |

The 50,000,000 cap is ₹5,00,000. Input is parsed by `paise` in `lib/validate.ts` (rupee string with up to two
decimals → integer). `totals()` in `lib/catalog.ts` computes `monthly` and `initial = monthly + deposit +
brokerage + fees`.

### Connection, chat and visits

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `interests` | Directed interest | PK `(actor_id, target_id)`, `actor_id <> target_id`, `status` |
| `matches` | One row per mutual pair | Unique `(member_a, member_b)`, `member_a < member_b` |
| `conversations` | One per match | `match_id` unique |
| `conversation_members` | Members | PK `(conversation_id, user_id)` |
| `messages` | Chat messages | `body` 1–1500. `request_key` uuid, unique `(sender_id, request_key)` for idempotent sends. `suspicious` flag |
| `message_read_states` | Read marker | PK `(conversation_id, user_id)`, `read_at` |
| `saved_items` | Shortlist | Exactly one of `profile_id`, `listing_id`. Unique `(user_id, profile_id, listing_id)` with nulls not distinct |
| `visit_requests` | A proposed visit | `conversation_id`, `requester_id`, `proposer_id`, `starts_at`, `status` |
| `visit_events` | Append-only visit history | `visit_id`, `actor_id` (set null on delete), `status` |
| `private.visit_locations` | Visit address | PK `visit_id`, `shared_by`, `details` 4–300 |

### Safety, moderation and operations

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `blocks` | Who blocked whom | PK `(actor_id, target_id)` |
| `reports` | Member reports | `reporter_id`, `subject_id`, `listing_id`, `message_id` (all set null on delete), `category`, `details` 5–1200, `status` |
| `moderation_actions` | What a moderator did and why | `moderator_id`, `target_type`, `target_id`, `action`, `reason` |
| `admin_audit_logs` | Compact audit trail | `actor_id`, `action` (for example `listing.approve`), `target_id` |
| `data_subject_requests` | Export, delete and support requests | `kind`, `details` ≤ 1200, `status`. One pending `export` and one pending `delete` per user |
| `product_events` | Opt-in analytics events | `user_id`, `event`, `city_id`, `intent`, `created_at` |
| `availability_waitlist` | City waitlist | PK `(user_id, city_id)` |
| `ranking_feedback` | "Was this useful" votes | `user_id`, `useful`. No read policy |
| `private.rate_buckets` | Rate-limit counters | PK `(actor, kind, window_start)`, `used`. Never purged |

Storage: private bucket `room-photos`, 750,000-byte limit, `image/webp` only, no object policies.

## 4. Indexes

| Index | Definition | Serves |
|---|---|---|
| `listings_search` | `(city_id, locality_id, monthly, available_from)` where `status = 'active'` | Room discovery |
| `listings_expiry` | `(expires_at)` where `status = 'active'` | `expire_rooms()` |
| `profiles_search` | `(city_id, budget_max, move_until)` where active and discoverable | People discovery |
| `interests_target` | `(target_id, updated_at desc)` | Incoming interest |
| `conversations_user` | `conversation_members(user_id)` | Inbox |
| `messages_thread` | `(conversation_id, created_at desc)` | Thread paging |
| `visits_thread` | `(conversation_id, starts_at)` | Visits per thread |
| `one_open_visit` | unique `(conversation_id)` where status in requested, confirmed, rescheduled | One open visit per conversation |
| `blocks_target` | `(target_id, actor_id)` | Block checks |
| `reports_queue` | `(status, created_at)` | Moderation queue |
| `events_window` | `(created_at, event)` | Funnel queries |
| `outstanding_request` | unique `(user_id, kind)` where pending and kind is not `support` | One open export or delete request |

## 5. Who can read what (RLS)

| Data | Readable by |
|---|---|
| Own profile, answers, progress, consents, notification settings, verification, blocks, waitlist row | The owner only |
| Other people's profiles and answers | Never directly. Only through `discover_people`, `inbox`, `moderation_profiles` |
| Listings and their amenities, rules, images, reconfirmations | Owner; moderators; any **active** member when the listing is `active`, unexpired, its owner is active and neither has blocked the other |
| Interests | Either party, unless blocked. The target sees only `sent` and `mutual` |
| Matches, conversations, members, messages, visits, visit events | The two members, only while both profiles are `active` and neither has blocked the other |
| Reports | The reporter and moderators |
| Data requests | The requester and moderators |
| Moderation actions, audit log, product events | Moderators |
| `feature_flags`, `ranking_feedback`, everything in `private` | No API reader |

## 6. State machines, exactly as the RPCs enforce them

### Profile

| From | To | Trigger |
|---|---|---|
| (none) | `draft` | `save_basics`, first call |
| `draft` | `active` | `save_privacy` with `status = active`. No other value is accepted from draft. Requires onboarding progress `preferences`, which is set by `save_lifestyle` (an empty answer set counts as skipping) |
| `active` | `paused` | `save_privacy` with `status = paused` |
| `paused` | `active` | `save_privacy` with `status = active` |
| `draft`, `active`, `paused` | `suspended` | `moderate('profile', …, 'suspend')` |
| `suspended` | `paused` if onboarding is complete, otherwise `draft` | `moderate('profile', …, 'restore')` |
| any | `closed` | `data_request('delete')` by the owner. Terminal |

`closed` and `suspended` accounts are refused by every write RPC except `data_request`. Only `active` profiles
can discover, be discovered, read other people's listings, send interest, chat, save or create listings.

### Listing

| From | To | Who and how | Conditions and side effects |
|---|---|---|---|
| (none) | `draft` | Owner, `save_listing(null, …)` | Active profile; at most 8 open listings; 5 creations a day; no similar title in the same locality |
| `draft`, `pending_review`, `active`, `paused`, `expired` | `draft` | Owner, `save_listing(id, …)` | Any edit clears `reviewed_at`, `confirmed_at`, `expires_at` |
| `draft` | `pending_review` | Owner, `submit` | At least one photo; `available_until` ≥ today; sets `confirmed_at` |
| `pending_review` | `active` | Moderator, `approve` | Not own listing; owner active; `available_until` ≥ today; sets `reviewed_at`; `expires_at` = earlier of approval time + 21 days and the end of `available_until` |
| `pending_review` | `draft` | Moderator, `reject` | |
| `active` | `paused` | Owner, `pause` | |
| `active`, `paused`, `expired` | `active` | Owner, `renew` | `reviewed_at` is set (so not after a moderator expiry); `available_until` ≥ today; sets `confirmed_at`; `expires_at` = earlier of now + 21 days and end of availability; logs a reconfirmation |
| `active` | `expired` | Moderator, `expire` | Clears `reviewed_at`. The owner cannot renew; they must edit (back to `draft`) and pass review again |
| `active` | `expired` | `expire_rooms()`, once `expires_at` has passed | Run daily by `/api/cron/expire`. Keeps `reviewed_at`, so the owner can renew |
| `pending_review`, `active`, `paused`, `expired` | `removed` | Moderator, `remove` | Terminal |
| `draft`, `pending_review`, `active`, `paused`, `expired` | `filled` | Owner, `fill` | Terminal; records `home_found_self_reported` if consented |
| any except `filled`, `removed` | `removed` | Owner closes the account | |

Photos can be attached or removed only in `draft`. A listing whose `expires_at` has passed is hidden from other
members even while its status still reads `active`.

### Interest (one row per direction)

| From | To | Action | Conditions |
|---|---|---|---|
| none, `passed`, `withdrawn` | `sent` | `like` | Both active, not blocked; the other side has not passed; the target is discoverable, has already sent interest, or owns the live listing named; fit and dealbreaker checks (API-CONTRACTS.md) |
| `sent` | `sent` | `like` | No change |
| none, `sent`, `passed`, `withdrawn` | `passed` | `pass` | |
| `sent` | `withdrawn` | `withdraw` | |
| `passed`, `withdrawn` | row deleted | `reset` | |
| `sent` + `sent` | `mutual` on both rows | `like` when the other row is `sent` | Creates the match, conversation and two member rows |
| `mutual` | `mutual` | `like` only | Returns the conversation id; any other action is refused |
| any | `blocked` on both rows | `block_account` | Terminal. There is no unblock |

### Visit

| From | To | Who | Conditions |
|---|---|---|---|
| (none) | `requested` | Either member | No other open visit; start between 10 minutes and 90 days from now |
| `requested`, `rescheduled` | `confirmed` | The member who did **not** propose the current time | Start is still in the future |
| `requested`, `rescheduled` | `declined` | The member who did not propose | Terminal |
| `requested`, `rescheduled`, `confirmed` | `rescheduled` | Either | New time in the same window; the actor becomes the proposer |
| `requested`, `rescheduled`, `confirmed` | `cancelled` | Either, with `cancel`; or automatically when one blocks the other | Terminal |
| `confirmed` | `completed` or `no_show` | Either | Only once the start time has passed. Terminal |

Every transition appends a `visit_events` row. The shared address is deleted whenever the new state is not
`confirmed`. `block_account` cancels every open visit between the two people, deletes its address and appends a
`cancelled` event.

### Report

| From | To |
|---|---|
| (none) | `open` (`file_report`). The target may be a message in any conversation the reporter belongs to, a person the reporter can see or has matched with, or a listing the reporter can currently read |
| `open` | `investigating` |
| `investigating` | `resolved`, `dismissed`, `escalated` |
| `escalated` | `resolved`, `dismissed` |

### Smaller machines

- Onboarding: `lifestyle → preferences → complete`. `save_basics` sets `lifestyle`; `save_lifestyle` moves it to
  `preferences`; activation in `save_privacy` requires `preferences` and sets `complete`.
- Data request: `pending → fulfilled` for `export` and `support` via `moderate('request', …, 'fulfill')`.
  `delete` requests cannot be marked fulfilled in the app; an operator completes them outside it.
