# Implementation status

_Last updated: 13 November 2026_

## Where it stands

Vercel serves the public site. Production uses the connected Free Neon Postgres resource. The authentication upgrade uses managed Google sign-in and email links and requires a verified Neon user and a live provider session for each database operation. The local Supabase backend remains the CI test fixture. See the deployment runbook for migration and verification commands.

Fictional profiles and rooms live in the practice area at `/try`; they never enter production inventory. Production inventory returned zero live rooms during verification. Native iOS and Android preview sources and CI are in `ios-native/` and `android-native/`. Production `/get` links to the published Android debug APK, unsigned iPhone IPA and iOS Simulator ZIP. Both native apps launched locally in simulators.

Production checks reached the Google account chooser from both hosting URLs and verified public and protected routes, sample matching, download availability, and the Neon migration objects. Live Google account consent, email delivery, authenticated production journeys, and physical-device native journeys remain unverified. Local lint, TypeScript, production build, 32 unit tests, 41 SQL integration tests and 27 Playwright tests passed. GitHub Actions records hosted results.

## P0

| Area | State | Evidence |
| --- | --- | --- |
| Public landing with honest inventory, content pages, city and locality pages, public listing preview | Built, live | `tests/e2e/public.spec.ts` |
| Google and magic-link sign-in, sessions, sign-out | Google initiation verified on both production hostnames; passwordless journey verified locally | `tests/e2e/journeys.spec.ts`, `tests/integration/neon-identity.test.ts` |
| Intent, basics, lifestyle questionnaire (skip, edit, progress), privacy choices, resume | Built; verified locally | journeys spec; `tests/integration/workflows.test.ts` |
| Listings: create, edit, photos (metadata stripped), submit, moderate, pause, reconfirm, fill, expiry | Built; verified locally | journeys spec; workflows tests |
| Discover people and rooms: filters, sort, fit reasons, differences, missing answers, empty states | Built; verified locally | journeys spec |
| Swipe matching: one card at a time for people and rooms; like, pass, undo, match screen; buttons, arrow keys and drag; list view kept as an option | Built; verified locally | `tests/e2e/swipe.spec.ts` |
| One-tap lifestyle chips (14 topics, optional “must match”), illustrated avatars, shortened landing page | Built; verified locally | journeys and public specs |
| Deterministic matching with hard constraints, weights, confidence and explanations | Built | `lib/matching.test.ts`; `docs/MATCHING-SPEC.md` |
| Mutual interest, chat, unread counts, scam warning, report, block | Built; verified locally | journeys spec; workflows and hardening tests |
| Saved items, matches list, visits (request, confirm, decline, reschedule, cancel, complete, no-show), address sharing | Built; verified locally | journeys spec; workflows tests |
| Moderation dashboard with audit log and logged message evidence | Built; verified locally | journeys spec; `tests/integration/access.test.ts` |
| Row-level security, server validation, rate limits | Built; verified locally | 41 integration tests |
| Fixes from the independent code review (declined requests clear, any message reportable, visit address window, paused-owner listings, passed rooms, honest analytics and waitlist wording) | Built; verified locally | `tests/e2e/regressions.spec.ts` |
| Privacy settings, data export download, support and appeal, account closure | Built; verified locally | journeys spec |
| First-party, opt-in product events and moderator funnel counts | Built | workflows tests |
| Installable PWA: manifest, icons, offline page, service worker | Built, live | public spec |
| CI: lint, typecheck, unit, build, database and browser suites | Built | `.github/workflows/ci.yml` |
| Production database, auth and storage | Neon Postgres and managed Auth | `docs/DEPLOYMENT.md` |

## Not built (stated honestly in the app)

| Item | Tier | Notes |
| --- | --- | --- |
| Group search, shared shortlist, household agreement checklist, expenses calculator | P1 | `/app/group` says "coming later" and offers the city waitlist |
| Reminder notifications | P1 | The preference is stored; nothing is sent, and the setting says so |
| Referral links, saved searches, duplicate-photo detection across listings | P1 | — |
| Phone OTP | — | Google and email links cover passwordless access |
| Payments, paid plans, concierge, ID or background checks, AI assistance | P2 | No fake checkout or badge exists; feature flags are present and off |
| Native iOS and Android store listing | — | Native previews use `/get`; store submission and signing are separate |
| Tailwind and shadcn/ui | — | Plain CSS tokens were used instead; see `docs/UX-DECISIONS.md` |
| Lighthouse and Core Web Vitals measurements | — | Not run; no score is claimed |

## Known gaps and risks

See `docs/THREAT-MODEL.md` for the full list. The ones that matter most before a public pilot:

1. Verify Google OAuth and email delivery in a controlled real browser session before inviting pilot users.
2. Neon’s shared email sender is quota-limited. Confirm deliverability for the pilot.
3. Account deletion is completed by an operator, not automatically.
4. No CAPTCHA on sign-in and no script-restricting Content-Security-Policy.
5. Legal pages are drafts; no legal or DPDP review has taken place.
6. Rate limits count successful calls only.
7. After a quiet one-tap action (confirm a visit, pause a listing) keyboard focus is not moved to the updated content; the result is announced to screen readers but this has not been tested with assistive technology.

## Release gate

Lint, typecheck, `npm test`, `npm run build`, `npm run test:integration` and `npm run test:e2e` pass in CI, the Vercel deployment is READY, and the production smoke test in `docs/DEPLOYMENT.md` has been run.
