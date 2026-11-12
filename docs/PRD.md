# Find a Flatmate — Product Requirements

_November 2026 · Pilot draft · Scope: Gurugram and Noida (four seeded localities)_

Everything in this document that is not directly visible in the code is a **hypothesis** until the work in
[VALIDATION-PLAN.md](VALIDATION-PLAN.md) is done. No user research, interview or revenue data exists yet.

## 1. Summary

Find a Flatmate is an India-first web app for adults (18+) who need to share a home: people looking for a room,
households filling a vacancy, and people who want to rent a place together. It takes a person from first search to
move-in as one guided workflow, with privacy and honest costs built in.

It is explicitly **not "Tinder for flatmates"**. There is no swipe deck, no photo-first ranking of people, and no lone
compatibility percentage. The product is a workflow tool for a housing decision.

## 2. Problem

Problem framing below is our starting assumption, to be tested in interviews.

| # | Problem | How it shows up | Product response (in code today) |
|---|---|---|---|
| 1 | Fake or stale listings | Rooms already taken, bait listings, posters without permission | Attestation, at least one photo, moderator review before a listing goes live, any edit returns it to review, 21-day reconfirmation window (`listing_transition`, `moderate`) |
| 2 | Lifestyle clashes | Sleep, food, guests, smoking, cleanliness discovered after moving in | 14 lifestyle dimensions with habit, expectation and strength; dealbreakers block a connection (`lib/matching.ts`, `interest_transition`) |
| 3 | Hidden costs | Rent quoted without maintenance, utilities, deposit, brokerage | Itemised costs in integer paise; monthly total kept apart from move-in cash (`totals()` in `lib/catalog.ts`) |
| 4 | Privacy | Phone numbers and addresses exposed to strangers | No public contact details; chat only after both sides opt in; visit address visible only around a confirmed visit (`read_visit_location`) |
| 5 | Ghosting and scheduling friction | Long threads to fix one visit | Structured visit requests with confirm / reschedule / decline / outcome (`visit_transition`) |
| 6 | Replacing a roommate | Outgoing flatmate or household has to re-explain the home each time | Listing carries house rules and costs once; pause, renew, mark filled |
| 7 | Unclear house rules | Rules surface late | House rules use the same 14 dimensions as personal answers, so they are compared directly |

## 3. Positioning: one end-to-end workflow

| Step | What the member does | Where it lives |
|---|---|---|
| Discover | Browse people and rooms in chosen localities | `/app/discover`, public `/city/...` pages |
| Understand the fit | Read reasons, differences, missing answers and confidence | `matchPeople`, `matchRoom` |
| Connect safely | Send interest; chat opens only on mutual opt-in | `interest_transition`, `send_message` |
| Verify claims | Rely only on labels the system can back: email verified, moderator reviewed, availability reconfirmed | `verification_checks`, `listings.reviewed_at`, `listings.confirmed_at` |
| Schedule a visit | Propose a time, confirm, share the address late | `visit_transition`, `visit_location` |
| Clarify costs and expectations | Receipt-style cost breakdown; house rules | `Receipt` component, `household_preferences` |
| Decide | Compare saved people and rooms | `save_item` |
| Move in | Self-report the outcome; pause or close the profile | `listing_transition('fill')`, `track_product_event`, `save_privacy` |

The app never holds rent or deposits and gives no safety guarantee. Agreements and payments happen outside the product.

## 4. Users

| User | Need | Priority |
|---|---|---|
| Room seeker (`looking_for_room`) | A room they can afford with people they can live with | P0 |
| Household filling a vacancy (`have_room`) | A compatible replacement without exposing contact details | P0 |
| People forming a household (`find_together`) | Others to rent with | P1. Today: one-to-one matching and a city waitlist only |
| Moderator | Keep listings real and handle reports with minimal access to private data | P0 (internal) |

Details and journeys: [PERSONAS-JOURNEYS.md](PERSONAS-JOURNEYS.md).

## 5. Scope

"Back end" means the SQL RPC and validation exist in the repo. UI status is tracked in `IMPLEMENTATION-STATUS.md`.

### P0 — needed for a pilot

| Capability | Back end |
|---|---|
| Email magic-link sign-in, 18+ self-declaration, terms consent | `login`, `save_basics` |
| Onboarding: intent, basics, lifestyle, privacy choices | `save_basics`, `save_lifestyle`, `save_privacy` |
| Discover people and rooms with explained compatibility | `discover_people`, `listings` RLS, `lib/matching.ts` |
| Listings with full costs, house rules, up to six sanitised photos | `save_listing`, `attach_sanitized_photo` |
| Listing review, freshness window, renew, pause, mark filled | `listing_transition`, `moderate` |
| Mutual-opt-in interest and private chat with a scam-keyword warning | `interest_transition`, `send_message` |
| Visit scheduling with time-limited address sharing | `visit_transition`, `visit_location`, `read_visit_location` |
| Save, block, report | `save_item`, `block_account`, `file_report` |
| Moderation queue with logged, justified access to reported messages | `moderate`, `review_reported_message` |
| Privacy controls, self-serve data export, and data requests (delete, support) | `save_privacy`, `GET /app/settings/data/export`, `data_request` |
| Public city, locality and listing pages with limited fields | `public_rooms`, `public_inventory` |
| Installable PWA | `app/manifest.ts`, `public/sw.js` |

### P1 — after the pilot gates pass

| Capability | State today |
|---|---|
| Household groups (shared shortlist, group compatibility) | Not implemented. `feature_flags.household_groups` is off; `/app/group` says so; `join_waitlist` records city interest |
| Visit and renewal reminders | Preference is stored (`notification_preferences.reminders`); sending is not implemented |
| Storage clean-up | Photo files are deleted on account closure only; not when a listing is filled or removed. (Listing expiry is now scheduled daily through `/api/cron/expire`) |
| Erasure tooling for delete requests | Not implemented. Closure hides data and deletes photo files; rows and the Auth user are erased by an operator by hand |
| More localities, phone verification, unblock, realtime chat | Not implemented |

### P2 — only if validated

AI assistance (`feature_flags.ai_assistance`, off), billing (`feature_flags.billing`, off), native apps, more cities.

## 6. Success measures

| Measure | Definition | Recorded today? |
|---|---|---|
| **North star** | Qualified mutual conversations per week: mutual matches where both people have sent at least one message | Derivable from `matches` and `messages`; `mutual_match` and `first_message` events exist for consenting users |
| **Real outcome** | Self-reported placement | `home_found_self_reported` (listing marked filled, or the "found" action) |
| Guardrails | Report rate, block rate, flagged-message rate, stale-listing reports, time to moderation | Tables exist; no dashboard is specified here |

Full funnel and gates: [VALIDATION-PLAN.md](VALIDATION-PLAN.md).

## 7. Non-goals

- Swipe-style or appearance-based matching; profile photos of people (none are stored).
- Brokerage, escrow, rent collection, deposits, or any payment handling.
- Identity, tenancy or background verification. Only three trust labels exist (see PRIVACY-AND-SAFETY.md).
- Rental agreements or legal advice.
- Automated decisions about people. Scores are advisory and explained; dealbreakers are set by members.
- Cities beyond the pilot until the gates in the validation plan pass.

## 8. Hypotheses

| # | Hypothesis | How we would know |
|---|---|---|
| H1 | Seekers value lifestyle and cost clarity enough to complete a 14-question onboarding | Onboarding completion and drop-off per step |
| H2 | Mutual opt-in before chat is acceptable to households and does not starve seekers of replies | Interest-to-mutual rate, time to first message |
| H3 | A reasons-first compatibility view is trusted more than a number alone | Interviews, `ranking_feedback` |
| H4 | Moderated, expiring listings stay fresh enough to matter | Stale reports per active listing; renew rate |
| H5 | Structured visit scheduling reduces drop-off between chat and visit | Mutual-to-visit-requested and visit-confirmed rates |
| H6 | Dense supply in two to four localities beats thin supply across a city | Liquidity per locality |
| H7 | Households, not seekers, are the scarce side | Ratio of active listings to active seekers per locality |

## 9. Market references

Listed only as references. **None of these were independently tested, and no claim of superiority or difference is made
about any of them.**

- flatmate.in
- flatmates.360ghar.com
- getbunkd.in
- nestmate.in

## 10. Open risks

- Production database is not provisioned yet (see COST-AND-LIMITS.md).
- A hardening migration closed most gaps from the first review; the rest are listed in THREAT-MODEL.md,
  "Open gaps".
- DPDP Act 2023 obligations have not had legal review (see PRIVACY-AND-SAFETY.md).
