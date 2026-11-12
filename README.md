# Find a Flatmate

**Find someone you can actually live with.** India-first flatmate and room matching, starting in Gurugram and Noida.

Live site: https://find-a-flatmate.anchit-tandon.com · Status and known gaps: [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md)

The product covers the whole journey rather than a swipe: **discover → understand the fit → connect safely → schedule a visit → clarify costs → decide**.

- Deterministic, explainable compatibility (no AI): reasons, differences, missing answers and a confidence level.
- Itemised costs in rupees: monthly total and move-in cash shown separately; unknown utilities shown as unknown.
- Chat only after mutual interest; phone, email and address stay private; block and report everywhere.
- Moderated listings that expire unless reconfirmed; audited moderator actions.

## Stack

Next.js 16 (App Router, React 19, TypeScript strict) · Supabase (Postgres, Auth, Storage, row-level security) · Vercel · plain CSS design tokens · Vitest · Playwright.

Every write goes through a validated server action (`lib/actions.ts`) and an actor-scoped Postgres function (`supabase/migrations`). Browsers have no direct write access to any table.

## Run it locally

Needs Node 22 or 24, npm and Docker (for the local Supabase stack).

```bash
npm ci
```

```bash
npx supabase start -x studio,imgproxy,logflare,vector,edge-runtime,supavisor,realtime,postgres-meta
```

`supabase start` applies every migration and prints local keys. Copy `.env.example` to `.env.local` and fill it from that output (`API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY`).

```bash
npm run dev
```

Sign-in emails for local development arrive in the local mail catcher at http://127.0.0.1:54324.

To make a local account a moderator (never seed moderators in production data files):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "insert into private.moderators(user_id) select id from auth.users where email='you@example.com'"
```

## Checks

| Command | What it covers |
| --- | --- |
| `npm run lint` | ESLint (Next.js core web vitals + TypeScript) |
| `npm run typecheck` | Route type generation and `tsc --noEmit` |
| `npm test` | Unit tests: matching, validation, pricing |
| `npm run test:integration` | Row-level security and workflow tests against the local Supabase stack |
| `npm run build` then `npm run test:e2e` | Playwright: public pages at five widths with accessibility checks, and seeker, poster, moderator and abuse journeys |

The integration and browser tests create and delete users, so they refuse to run against anything but a local stack. CI runs all of the above on every pull request.

## Where things are

| Path | Contents |
| --- | --- |
| `app/(site)` | Public pages |
| `app/(auth)` | Sign-in and onboarding |
| `app/app` | Signed-in app |
| `app/admin` | Moderation dashboard |
| `components` | Shared UI |
| `lib` | Matching, validation, catalogue, data access, server actions |
| `supabase/migrations` | Schema, row-level security, RPCs |
| `tests` | Integration and browser tests |
| `docs` | Product, data model, API, privacy, threat model, deployment |

## Documentation

[PRD](docs/PRD.md) · [Personas and journeys](docs/PERSONAS-JOURNEYS.md) · [Matching spec](docs/MATCHING-SPEC.md) · [Data model](docs/DATA-MODEL.md) · [API contracts](docs/API-CONTRACTS.md) · [Privacy and safety](docs/PRIVACY-AND-SAFETY.md) · [Threat model](docs/THREAT-MODEL.md) · [UX decisions](docs/UX-DECISIONS.md) · [Validation plan](docs/VALIDATION-PLAN.md) · [Cost and limits](docs/COST-AND-LIMITS.md) · [Deployment](docs/DEPLOYMENT.md)

## FAQ

**Is the legal text final?** No. Privacy, terms and guidelines are plain-language drafts pending legal review. Nothing here claims DPDP compliance.

**Are the people in the pictures real?** No. All artwork is illustration and is never presented as a real member or home.

**Does it take payments?** No. There is no checkout, escrow or deposit handling, and none is planned without a separate decision.
