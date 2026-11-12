# Implementation status

| Area | Status |
| --- | --- |
| Domain logic: matching, validation, cost totals (`lib/`) | Done, unit tested (`lib/*.test.ts`) |
| Server actions + actor-scoped RPCs (`lib/actions.ts`, `supabase/migrations`) | Present; needs a provisioned Supabase project |
| Auth callback, media route | Present |
| Public landing page, PWA manifest, app icons | Done: responsive at 390 / 820 / 1440 px, installable to home screen |
| App pages (`/login`, `/onboarding/*`, `/app/*`, `/admin`) | **Not implemented**: actions redirect to these routes, which currently 404 |
| Native iOS / Android apps | **Not started** |
| Browser (Playwright) e2e suite | **Not started**: `npm run test:e2e` has no specs yet |

Release gate: lint, typecheck, `npm test` and `npm run build` must pass in CI, and the Vercel deployment must be READY.
