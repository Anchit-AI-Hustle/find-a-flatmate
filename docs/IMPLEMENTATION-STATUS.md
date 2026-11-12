# Implementation status

_Last updated: 12 November 2026_

## Where it stands

The P0 product is built and passes its tests against a real local Supabase stack. **It is not usable by the public yet**, because the production Supabase project could not be created (account at the free-project limit). The live site therefore serves the public pages with sign-in switched off and says so.

## P0

| Area | State | Evidence |
| --- | --- | --- |
| Public landing with honest inventory, content pages, city and locality pages, public listing preview | Built, live | `tests/e2e/public.spec.ts` |
| Magic-link sign-in, sessions, sign-out | Built; verified locally only | `tests/e2e/journeys.spec.ts` |
| Intent, basics, lifestyle questionnaire (skip, edit, progress), privacy choices, resume | Built; verified locally | journeys spec; `tests/integration/workflows.test.ts` |
| Listings: create, edit, photos (metadata stripped), submit, moderate, pause, reconfirm, fill, expiry | Built; verified locally | journeys spec; workflows tests |
| Discover people and rooms: filters, sort, fit reasons, differences, missing answers, empty states | Built; verified locally | journeys spec |
| Swipe matching: one card at a time for people and rooms; like, pass, undo, match screen; buttons, arrow keys and drag; list view kept as an option | Built; verified locally | `tests/e2e/swipe.spec.ts` |
| One-tap lifestyle chips (14 topics, optional “must match”), illustrated avatars, shortened landing page | Built; verified locally | journeys and public specs |
| Deterministic matching with hard constraints, weights, confidence and explanations | Built | `lib/matching.test.ts`; `docs/MATCHING-SPEC.md` |
| Mutual interest, chat, unread counts, scam warning, report, block | Built; verified locally | journeys spec; workflows and hardening tests |
| Saved items, matches list, visits (request, confirm, decline, reschedule, cancel, complete, no-show), address sharing | Built; verified locally | journeys spec; workflows tests |
| Moderation dashboard with audit log and logged message evidence | Built; verified locally | journeys spec; `tests/integration/access.test.ts` |
| Row-level security, server validation, rate limits | Built; verified locally | 39 integration tests |
| Fixes from the independent code review (declined requests clear, any message reportable, visit address window, paused-owner listings, passed rooms, honest analytics and waitlist wording) | Built; verified locally | `tests/e2e/regressions.spec.ts` |
| Privacy settings, data export download, support and appeal, account closure | Built; verified locally | journeys spec |
| First-party, opt-in product events and moderator funnel counts | Built | workflows tests |
| Installable PWA: manifest, icons, offline page, service worker | Built, live | public spec |
| CI: lint, typecheck, unit, build, database and browser suites | Built | `.github/workflows/ci.yml` |
| Production database, auth and storage | **Blocked** | `docs/DEPLOYMENT.md` |

## Not built (stated honestly in the app)

| Item | Tier | Notes |
| --- | --- | --- |
| Group search, shared shortlist, household agreement checklist, expenses calculator | P1 | `/app/group` says "coming later" and offers the city waitlist |
| Reminder notifications | P1 | The preference is stored; nothing is sent, and the setting says so |
| Referral links, saved searches, duplicate-photo detection across listings | P1 | — |
| Google sign-in, phone OTP | — | Email magic link only |
| Payments, paid plans, concierge, ID or background checks, AI assistance | P2 | No fake checkout or badge exists; feature flags are present and off |
| Native iOS and Android store apps | — | The site installs to the home screen as a PWA; no store submission exists |
| Tailwind and shadcn/ui | — | Plain CSS tokens were used instead; see `docs/UX-DECISIONS.md` |
| Lighthouse and Core Web Vitals measurements | — | Not run; no score is claimed |

## Known gaps and risks

See `docs/THREAT-MODEL.md` for the full list. The ones that matter most before a public pilot:

1. No production database (blocker).
2. Supabase's built-in email sender is too limited for magic-link sign-in; a custom SMTP sender is needed.
3. Account deletion is completed by an operator, not automatically.
4. No CAPTCHA on sign-in and no script-restricting Content-Security-Policy.
5. Legal pages are drafts; no legal or DPDP review has taken place.
6. Rate limits count successful calls only.
7. After a quiet one-tap action (confirm a visit, pause a listing) keyboard focus is not moved to the updated content; the result is announced to screen readers but this has not been tested with assistive technology.

## Release gate

Lint, typecheck, `npm test`, `npm run build`, `npm run test:integration` and `npm run test:e2e` pass in CI, the Vercel deployment is READY, and the production smoke test in `docs/DEPLOYMENT.md` has been run.
