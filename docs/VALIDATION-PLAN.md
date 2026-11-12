# Validation Plan

_November 2026 · Nothing in this plan has been run yet. There are no interview results, usage numbers or revenue._

The plan tests the hypotheses in PRD.md in four stages. Each stage has a gate. All thresholds are **proposed
starting targets set without baseline data**; revise them after stage 1 and record the change here.

| Stage | Question | Duration (planned) |
|---|---|---|
| 0. Readiness | Is the product safe to put in front of people? | until done |
| 1. Interviews | Are the seven problems real for these people, in these localities? | 2 weeks |
| 2. Concierge test | Does matching by our rubric lead to conversations and visits when done by hand? | 3 weeks |
| 3. Locality pilot | Does the product reach liquidity in 2–4 dense localities? | 6 weeks |

## Stage 0 — Readiness gate (go / no-go before any member is invited)

- [ ] Production database provisioned and both migrations applied (blocked today; see COST-AND-LIMITS.md).
- [ ] THREAT-MODEL gaps G1, G2, G3, G6, G7 and G8 fixed, or accepted in writing by the owner.
- [ ] Legal review of the DPDP checklist in PRIVACY-AND-SAFETY.md, and of the terms and privacy pages.
- [ ] At least one named moderator, with a target of reviewing listings within 24 hours.
- [ ] Sign-in email deliverability tested on a custom SMTP sender (the built-in sender is too limited for a pilot).
- [ ] Lint, typecheck, unit tests and build green; core journeys covered by browser tests.

## Stage 1 — Interviews

**Goal.** Learn how people last found a room or flatmate, what went wrong, and what they did about it. Not to
pitch the product.

| Segment | Target number | Recruit from |
|---|---|---|
| Room seekers who searched in the last 6 months | 10 | Flat and flatmate groups for the four localities, personal networks |
| Households who filled a room in the last 6 months | 8 | Same groups, society contacts |
| People who formed a new household together | 5 | Same |
| People who gave up or used a broker or PG instead | 4 | Referrals from the above |

**Method.**

- 30–40 minutes each, one interviewer and one note-taker, recorded only with consent.
- Ask about the **last real search**, step by step. Avoid hypotheticals and avoid describing features first.
- Topics: where they looked; how they judged a listing was real; what costs surprised them; what they shared
  about themselves and when; how visits were arranged; what almost went wrong; what they would not share with a
  stranger; how the decision was made; what happened after move-in.
- Only at the end: show the cost receipt and the compatibility view and ask what they would expect each to mean.

**What counts as signal.** A problem counts for a participant only if they describe it happening in their own
last search, unprompted or after one neutral prompt. Record counts per problem per segment, with verbatim notes
kept privately. Do not publish quotes without permission.

**Gate 1 (proposed).** Proceed if, in each of the seeker and household segments, at least 6 of the interviewees
describe three or more of the seven PRD problems from their own last search. If one problem is described by
fewer than 3 people in total, drop or demote the feature that serves it.

## Stage 2 — Concierge test

**Goal.** Test the matching rubric and the mutual-opt-in flow before depending on software and supply.

1. Pick **one** locality where stage 1 recruiting was easiest.
2. Recruit about 25 seekers and 10 households. Collect the same basics and 14 lifestyle answers as the app.
3. An operator applies MATCHING-SPEC.md by hand, writes the reasons and differences for each suggested pair, and
   asks each side separately whether they want an introduction.
4. Introduce only on a double yes. Offer to coordinate one visit time.
5. Follow up at 1, 2 and 3 weeks: did they talk, visit, agree?
6. Log every step in a private sheet, with participants' consent, and delete it after analysis.

**Measures.** Share of suggestions accepted by each side; double-yes rate; share of introductions with a reply
from both; visits arranged; visits attended; placements; which reasons people cite when declining.

**Gate 2 (proposed).** Proceed if at least 30% of suggested pairs reach a double yes, at least 50% of
introductions lead to messages from both people, and at least 3 visits take place. If people decline mostly for
reasons the rubric does not capture, fix the rubric first.

## Stage 3 — Locality pilot

**Where.** Two to four dense localities from the seeded set: DLF Phase 3 and Sector 56 (Gurugram), Sector 62 and
Sector 137 (Noida). Start with two; add the others only if the first two hold supply.

**Acquisition channels (all hypotheses; track source per sign-up by asking at onboarding or by link).**

| Channel | Side | Note |
|---|---|---|
| Existing flat and flatmate groups for the locality | Both | Post only with the admin's permission |
| Resident associations and society notice boards | Households | Supply first |
| Households who filled a room through the concierge test | Households | Ask for referrals |
| New-joiner and relocation channels of nearby employers and colleges | Seekers | Through a contact, with permission |
| People leaving PGs and hostels | Seekers | Through personal networks |
| Public locality pages (`/city/[city]/[locality]`) | Seekers | Organic search; slow |
| Paid advertising | — | Not planned; no budget and no paid services purchased |

Seed supply before demand: do not invite seekers to a locality until it has live, reviewed listings.

### Funnel

Target funnel, in order, and what the code records **today**. Recorded events go to `product_events` through
`private.event_for`, which writes **only for members who opted in to analytics** (off by default).

| Step | Recorded today? | How |
|---|---|---|
| `landing_view` | **No** | No anonymous analytics exist |
| `intent_selected` | **No** | `selectIntent` sets a cookie only |
| `auth_completed` | **No** | No event; Supabase Auth holds sign-in records |
| `onboarding_started` | **No** | No event; a `profiles` row exists once basics are saved |
| `onboarding_completed` | Yes | `save_privacy`, when a draft profile becomes active |
| `discover_view` | Yes, when the page calls it | `track_product_event`; called from the Discover page at the time of writing |
| `compatible_profile_opened` | Yes, when the page calls it | `track_product_event`; called from the person page at the time of writing |
| `interest_sent` | Yes | `interest_transition`, when a row first becomes `sent` |
| `mutual_match` | Yes | `interest_transition`, for the member whose like completes the match |
| `first_message` | Yes | `send_message`, a member's first message in a conversation |
| `visit_requested` | Yes | `visit_transition` |
| `visit_confirmed` | Yes | `visit_transition`, for the member who confirms |
| `visit_completed` | Yes | `visit_transition`, for the member who records it |
| `home_found_self_reported` | Yes | `listing_transition('fill')` and the "found" action |

Consequences for measurement:

- The top four steps cannot be measured from the product today. Either add them or measure from hosting logs.
- Event counts under-report and are biased towards people who opt in. Report the opt-in rate beside every funnel.
- Events are deleted when a member closes their account.
- Complete counts exist in operational tables (`profiles`, `interests`, `matches`, `messages`,
  `visit_requests`) regardless of consent. Whether aggregate counts from those may be used for product
  measurement is a question for the privacy review.

### Definitions

| Metric | Definition |
|---|---|
| **North star: qualified mutual conversations per week** | Matches created in the week where both members have sent at least one message within 7 days |
| **Outcome: self-reported placement** | Members or listings with `home_found_self_reported`, or listings marked `filled` |
| Onboarding completion | Profiles reaching `active` ÷ profiles created |
| Interest acceptance | Interests reaching `mutual` ÷ interests sent, within 7 days |
| Conversation rate | Qualified mutual conversations ÷ mutual matches |
| Visit rate | Conversations with a visit requested ÷ qualified mutual conversations |
| Visit completion | Visits `completed` ÷ visits `confirmed` |
| Locality liquidity | Live reviewed listings and active discoverable seekers per locality, weekly |

### Guardrail metrics

| Guardrail | Source | Proposed limit |
|---|---|---|
| Reports per 100 active members per week | `reports` | Investigate above 5 |
| Scam or harassment reports upheld | `reports` resolved, by category | Any upheld case is reviewed individually |
| Blocks per 100 active members per week | `blocks` | Investigate above 5 |
| Flagged messages share | `messages.suspicious` | Trend only; known false positives |
| Listings reported stale | `reports` category `stale` ÷ live listings | Below 5% |
| Median time from submit to review | `listings.confirmed_at` to `reviewed_at` | Under 24 hours |
| Unanswered interest | Interests still `sent` after 7 days | Below 60% |
| Visit no-shows | `no_show` ÷ confirmed visits | Below 20% |
| Account closures | `data_subject_requests` kind `delete` | Trend; read every stated reason |

### Gate 3 (proposed), evaluated at week 6 for the first two localities

Go to more localities only if **all** hold:

1. At least 20 live, reviewed listings at once in each of two localities.
2. Onboarding completion of at least 60%.
3. Interest acceptance of at least 25%.
4. At least 15 qualified mutual conversations per week by week 6.
5. Visit rate of at least 30%.
6. At least 5 self-reported placements in total.
7. No guardrail over its limit for two consecutive weeks, and no unresolved safety incident.

If 1 fails, the problem is supply: stop inviting seekers and work on households. If 2–3 fail, revisit onboarding
length and the matching rules. If 4–6 fail with healthy supply, the workflow after the match is the problem.

## Future monetisation experiments — untested hypotheses

The product is free. `feature_flags.billing` is off, no payment code exists, and no price has been set, tested
or validated. Nothing below is a plan of record, and no amount is given because none is established. The
current hosting plan is for non-commercial use, so any paid experiment requires changing plans first
(COST-AND-LIMITS.md).

| Idea | Hypothesis | Cheapest honest test | Main risk |
|---|---|---|---|
| Listing visibility upgrade for households | Households with urgency would pay for faster exposure | Willingness-to-pay interviews; then a clearly labelled waitlist | Pay-to-rank undermines trust in results |
| Optional listing check by a human visit | Seekers trust, and households value, an on-site check | Offer it manually to a few households; measure uptake at several price points in interviews | Operations cost; implies a guarantee we cannot give |
| Seeker convenience features | Seekers would pay for alerts or earlier access | Interviews; a waitlist with no charge | Charging the more price-sensitive side |
| Employer or college relocation partnerships | Organisations would pay to help new joiners settle | Three to five discovery conversations | Long sales cycle |
| Referral partners (movers, agreements, furniture) | Members want these at move-in | Ask in follow-up after a self-reported placement | Distraction; privacy of referrals |

Rules for any monetisation test: never charge to unlock a chat or a room, never handle rent or deposits, label
every test as a test, and run it only after Gate 3.
