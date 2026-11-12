# Deployment

_Last updated: 12 November 2026_

| Item | Value |
| --- | --- |
| Repository | `Anchit-AI-Hustle/find-a-flatmate` (branch `main` deploys to production; pull requests get preview deployments) |
| Host | Vercel project `find-a-flatmate`, team `anchit-ai-hustle` |
| Production domain | https://find-a-flatmate.anchit-tandon.com (also `find-a-flatmate.vercel.app`) |
| Framework and Node | `vercel.json` pins `nextjs`; `package.json` engines `>=22 <25` resolves to Node 24 |
| CI | `.github/workflows/ci.yml`: lint, typecheck, unit tests, build on Node 22 and 24; database and browser suites against a local Supabase stack |
| Scheduled job | Vercel Cron, daily 20:30 UTC (02:00 IST): `GET /api/cron/expire` |
| Database and auth | Supabase. **Production project not yet created** (see "Blocked" below) |

## Environment variables (Vercel)

| Key | Scope | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Set to the production domain. Auth callbacks redirect to it. |
| `APP_ENV` | Production | Set to `production`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | **Not set.** Until it is, sign-in is switched off and public pages show "opening soon". |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview | **Not set.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (sensitive, server only) | **Not set.** Needed for photo uploads, photo display, closure clean-up and the cron job. Never prefix with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Production (sensitive) | **Not set.** Vercel sends it as a bearer token to the cron route; without it the route answers 401 and does nothing. |

## Blocked: production Supabase project

Creating the project failed on 12 November 2026 with: the account has reached the limit of two active free projects. No paid plan was purchased. To unblock, do one of:

1. Pause or delete an active free project you no longer need (Supabase dashboard → project → Settings → General), or
2. Upgrade the organisation (a billing decision).

## Provisioning steps once a project slot is free

1. Create project `find-a-flatmate` in region `ap-south-1` (Mumbai).
2. Apply the migrations in order: `supabase link --project-ref <ref>` then `supabase db push`. Do not load any seed data.
3. Auth → URL configuration: Site URL `https://find-a-flatmate.anchit-tandon.com`; add redirect URL `https://find-a-flatmate.anchit-tandon.com/auth/callback`. Add a preview pattern only if previews should allow sign-in.
4. Auth → Email: keep "Confirm email" on. The magic-link template must use the default `{{ .ConfirmationURL }}` (PKCE flow); the app does not accept token-hash links.
5. Auth → SMTP: configure a custom SMTP sender before inviting anyone. The built-in sender is limited to a couple of emails per hour, which is not enough for magic-link sign-in.
6. Consider enabling CAPTCHA for sign-in (Auth → Attack protection).
7. In Vercel, add the four missing variables above (generate `CRON_SECRET` with `openssl rand -hex 32`), then redeploy `main`.
8. Run the security advisors in the Supabase dashboard and resolve anything new.
9. Make the first moderator. Sign in once on the live site with that person's email, then run in the Supabase SQL editor:
   ```sql
   insert into private.moderators(user_id) select id from auth.users where email = '<moderator email>';
   ```
   Moderator rows are created by an operator only; nothing in the app or migrations can grant the role.
10. Smoke-test production: sign in, complete onboarding, create a draft listing with a photo, submit it, approve it as the moderator, confirm it appears on `/city/<city>`, then mark it filled. Remove the test account afterwards (Supabase → Authentication → Users).

## Completing an account deletion request

Closure hides the profile, removes listings and deletes stored photo files immediately. To finish erasure, an operator deletes the user in Supabase → Authentication → Users (rows cascade from `auth.users`), then records it outside the app. See `docs/PRIVACY-AND-SAFETY.md` for what is retained and why.

## Rollback

Vercel keeps previous deployments: Project → Deployments → pick the last good one → Promote to Production. Database migrations are forward-only; fix with a new migration.
