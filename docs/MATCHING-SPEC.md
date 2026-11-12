# Matching Specification

_November 2026 · Describes `lib/matching.ts`, `scoringVersion = '1.0.0'`_

Compatibility is computed in TypeScript on the server at render time. Nothing is stored: there is no score column
in the database. The database separately enforces a smaller set of hard rules when interest is sent
(`interest_transition`); section 9 lists where the two differ.

Two functions exist: `matchPeople(a, b)` for person to person, and `matchRoom(person, room)` for person to listing.
Both return the same result shape. All money is integer paise. Dates are `YYYY-MM-DD` strings compared as text.

## 1. Result shape

| Field | Meaning |
|---|---|
| `score` | Integer 0–100, or `null` when withheld |
| `confidence` | `low`, `medium` or `high` |
| `top_reasons` | Up to 5 sentences. Lifestyle reasons first (A–Z), then logistics reasons (A–Z) |
| `potential_friction` | All non-fatal differences, A–Z |
| `hard_fail_reasons` | All fatal conflicts, A–Z, de-duplicated |
| `missing_answers` | Dimension titles with incomplete information, A–Z |
| `scoring_version` | The constant `scoringVersion` |

## 2. When no score is shown

`score` is `null` if **either** is true:

1. There is at least one hard-fail reason.
2. Lifestyle coverage is below 0.25 (see section 6).

Otherwise `score = min(100, round(base + lifestyle + extra))`.

## 3. Hard-fail rules

| Rule | People | Room | Reason text |
|---|---|---|---|
| Different city | yes | yes | `Different cities` |
| No shared locality (for a room: its locality is not in the seeker's list) | yes | yes | `No overlapping preferred locality` |
| Date windows do not intersect (`a.from <= b.until` and `b.from <= a.until`) | yes | yes | `Move-in windows do not overlap` |
| Same account on both sides | yes | — | `Same account` |
| Budget ranges do not intersect (`max(mins) <= min(maxes)`) | yes | — | `Monthly budget ranges do not overlap` |
| Seeker owns the listing | — | yes | `Own listing` |
| Listing monthly cost is above the seeker's maximum budget | — | yes | `Listed recurring cost exceeds budget` |
| Seeker's planned stay is shorter than the listing minimum | — | yes | `Minimum stay exceeds your plans` |
| An expectation marked dealbreaker is not met | both directions | seeker's expectations only | `Dealbreaker: <dimension title>` |

Listing monthly cost = rent + maintenance + utilities + other recurring charges. Unknown utilities count as zero.

## 4. Weights (total 100)

| Component | Points | People: earned when | Room: earned when |
|---|---|---|---|
| Locality | 15 | At least one shared locality | Listing locality is in the seeker's list |
| Dates | 10 | Move-in windows intersect | Seeker's window intersects the availability window |
| Budget | 20 | Budget ranges intersect | Monthly cost ≤ maximum budget. **10** instead of 20 if utilities are unknown |
| Stay | 5 | Planned stays differ by 3 months or less | Planned stay ≥ listing minimum |
| Lifestyle, 11 dimensions | 40 | 40/11 ≈ 3.636 each | same |
| Logistics, 3 dimensions | 10 | 10/3 ≈ 3.333 each | same |

Lifestyle dimensions: sleep, noise, cleanliness, cooking, kitchen, guests, smoking, alcohol, pets, wfh, privacy.
Logistics dimensions: chores, expenses, utilities.

A people stay difference above 3 months earns 0 and adds the friction line `You prefer different lengths of stay.`
It is never a hard fail between people.

## 5. How a lifestyle point is earned

Each person (or household) may give, per dimension: a `habit` (what they do), a `want` (what they expect of the
other side) and one `strength` for that expectation: `flexible`, `preference` or `dealbreaker`.

A **comparison** is one side's `want` checked against the other side's `habit`.

| Situation | Outcome |
|---|---|
| The `want` or the other side's `habit` is missing | Comparison is skipped: no points, counts as missing |
| `want` equals the other `habit` | Fit |
| Different, strength `flexible` | Fit |
| Different, strength `preference` | No fit; friction line `Different expectations for <title>.` |
| Different, strength `dealbreaker` | No fit; friction line; hard fail `Dealbreaker: <title>` |

Points per dimension = weight × (fits ÷ comparisons).

- **People:** 2 comparisons per dimension (A's want vs B's habit, and B's want vs A's habit). One fit earns half.
- **Room:** 1 comparison per dimension (seeker's want vs household habit).

A dimension adds a reason `Compatible expectations for <title>.` only when every comparison was made, every
comparison fit, and the first argument's `want` literally equals the other side's `habit`. A fit that exists only
because someone is flexible earns points but no reason line.

## 6. Coverage, confidence and missing answers

Coverage = average over the 14 dimensions of (comparisons made ÷ comparisons possible).

| Threshold | People (28 comparisons) | Room (14 comparisons) | Effect |
|---|---|---|---|
| Coverage < 0.25 | fewer than 7 made | fewer than 4 made | Score withheld |
| Coverage ≥ 0.40 | 12 or more | 6 or more | Confidence at least `medium` |
| Coverage ≥ 0.75 and no extra missing item | 21 or more | 11 or more | Confidence `high` |
| otherwise | | | Confidence `low` |

- The only "extra missing item" is `Utility estimate`, added for a room whose utilities are unknown. Such a room
  can never be `high` confidence.
- A skipped comparison earns **zero**, not a neutral share. Missing answers therefore lower the score as well as
  the confidence. With no lifestyle answers the most a pair could earn is 50, and the score is withheld anyway.
- Any dimension with coverage below 1 is listed in `missing_answers` by title.
- Confidence is still reported when the score is withheld.

## 7. Symmetry (people)

`matchPeople(a, b)` and `matchPeople(b, a)` always give the same `score`, `confidence`, `hard_fail_reasons`,
`potential_friction` and `missing_answers`. `top_reasons` can differ in one case: where a dimension fits both ways
but only one side's `want` literally equals the other's `habit` (the other fit comes from being flexible), the
reason line appears only from the first argument's point of view.

## 8. Person–room differences

| Topic | People | Room |
|---|---|---|
| Lifestyle direction | Both directions | Seeker's expectations against household habits only. Household expectations of the seeker are **not** scored |
| Budget | Range overlap | Monthly cost against the seeker's maximum only; the minimum is ignored |
| Unknown utilities | not applicable | 10 points instead of 20, friction line, `Utility estimate` missing, confidence capped at `medium` |
| Stay | Friction only | Hard fail when the seeker's stay is shorter than the minimum |
| Extra reason | `Your monthly budget ranges overlap.` | `Estimated monthly cost is within your maximum budget.` |

## 9. Where the database differs

These are enforced by `interest_transition` when someone presses "interested", regardless of the score shown.
Confirmed by running the migrations locally on 12 November 2026.

| # | TypeScript | SQL | Effect for a member |
|---|---|---|---|
| 1 | `matchRoom` ignores household expectations | With a `listing`, dealbreakers are checked in **both** directions | A room can show a score, even 100, and still be refused with "A household rule conflicts with a dealbreaker" |
| 2 | `matchRoom` hard-fails on cost, locality, dates and stay for that listing | A like passes if **either** the two profiles overlap **or** the listing criteria are met | An over-budget room can be liked when the two profiles overlap |
| 3 | Hard fails always apply | Overlap is not re-checked when the other person has already sent interest | A like-back can succeed where the screen says "Not a fit" |
| 4 | — | With any `listing` id supplied, the person-to-person dealbreaker check is skipped and the id is not tied to the target | See THREAT-MODEL gap G2 |

## 10. Worked examples

Weights used: lifestyle dimension 40/11 = 3.636; logistics dimension 10/3 = 3.333. Each example was also run
through the code; results matched.

### Example 1 — two people, complete answers → 90, high

A: Gurugram; Sector 56 and DLF Phase 3; 1 Dec 2026 – 15 Jan 2027; 6 months; ₹12,000–₹20,000. Answers every
dimension with the first option as both habit and want, strength `preference`.

B: Gurugram; Sector 56; 1 Jan – 28 Feb 2027; 12 months; ₹15,000–₹25,000. Same answers as A except sleep
(habit and want `Late nights`, `flexible`) and chores (habit and want `Clean as you go`, `preference`).

| Component | Working | Points |
|---|---|---|
| Locality | Sector 56 shared | 15 |
| Dates | 1 Jan – 15 Jan is common | 10 |
| Budget | max(12,000; 15,000) = 15,000 ≤ min(20,000; 25,000) = 20,000 | 20 |
| Stay | 12 − 6 = 6 months, more than 3 | 0 |
| 10 lifestyle dimensions, both ways fit | 10 × 3.636 | 36.364 |
| Sleep | A wants Early nights, B is Late nights: no fit. B is flexible: fit. 1 of 2 | 1.818 |
| 2 logistics dimensions, both ways fit | 2 × 3.333 | 6.667 |
| Chores | Neither expectation met. 0 of 2 | 0 |
| **Total** | 89.848 → rounds to | **90** |

Coverage 28/28 = 1.0 → `high`. Friction: chores, sleep rhythm, different lengths of stay. No hard fails.

### Example 2 — two people, missing answers → 71, medium

A as in Example 1. B: same logistics, but 8 months, and answers only: sleep, cleanliness, smoking, guests,
expenses (first option, habit and want), noise (`Lively home`, habit and want, `preference`), and **habit only**
for pets (`No pets`) and chores (`Weekly rota`). Six dimensions are unanswered.

| Component | Working | Points |
|---|---|---|
| Locality + dates + budget | as Example 1 | 45 |
| Stay | 8 − 6 = 2 months | 5 |
| Sleep, cleanliness, smoking, guests | 4 × 3.636 | 14.545 |
| Expenses | 1 × 3.333 | 3.333 |
| Noise | Both expectations unmet | 0 |
| Pets (habit only) | A's want met; B has no want. 1 fit of 2 possible | 1.818 |
| Chores (habit only) | 1 fit of 2 possible | 1.667 |
| Six unanswered dimensions | skipped | 0 |
| **Total** | 71.364 → rounds to | **71** |

Coverage = (6 × 1 + 2 × 0.5) ÷ 14 = 0.5 → `medium`. Missing: AC and utilities, Alcohol, Chores, Cooking, Pets,
Privacy, Shared kitchen, Work from home. Friction: noise.

### Example 3 — person and room, utilities unknown → 86, medium

Seeker: Noida; Sector 62 and Sector 137; 1–31 Dec 2026; 11 months; maximum ₹18,000. First option everywhere,
`preference`, except guests: wants `Overnight guests`.

Room: Noida, Sector 62; available 15 Dec 2026 – 15 Feb 2027; minimum 6 months; rent ₹14,000, maintenance ₹1,500,
utilities unknown, other recurring ₹500; deposit ₹28,000; fees ₹1,000. House rules: first option everywhere.

| Component | Working | Points |
|---|---|---|
| Locality | Sector 62 is in the seeker's list | 15 |
| Dates | 15–31 Dec is common | 10 |
| Budget | 14,000 + 1,500 + 0 + 500 = ₹16,000 ≤ ₹18,000, utilities unknown | 10 |
| Stay | 11 ≥ 6 | 5 |
| 10 lifestyle dimensions fit | 10 × 3.636 | 36.364 |
| Guests | Wants Overnight guests, house has Occasional daytime guests, `preference` | 0 |
| 3 logistics dimensions fit | 3 × 3.333 | 10 |
| **Total** | 86.364 → rounds to | **86** |

Coverage 14/14 but `Utility estimate` is missing → `medium`. Move-in cash shown on the receipt:
16,000 + 28,000 + 0 + 1,000 = ₹45,000 before utilities.

Variant: if the seeker marks guests as `dealbreaker`, the result is `score: null` with `Dealbreaker: Guests`.

## 11. Changing the rules safely

1. Keep the six components summing to 100. The `min(100, …)` cap hides overshoot but not undershoot.
2. The per-dimension weights are the literals `40/11` and `10/3`. Adding or removing a dimension requires changing
   those literals and the `logistics` set, or the total will no longer be 100.
3. A dimension or option change touches three places: `dimensions` and `titles` in `lib/catalog.ts`, and the
   catalogue inside `private.answers_valid` (new migration). They are identical today and must stay so.
4. Bump `scoringVersion`: patch for wording, minor for weights or thresholds, major for hard-fail rules.
5. Update `lib/matching.test.ts` (it pins 100 for a full match and 90 for unknown utilities) and the three
   examples above.
6. If a hard-fail rule changes, change `interest_transition` in a new migration in the same release, and update
   section 9.
7. `ranking_feedback` rows do not record the scoring version. Add that column before using feedback to compare
   versions.
