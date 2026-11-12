# Deployment

| Item | Value |
| --- | --- |
| Host | Vercel project `find-a-flatmate` (team `anchit-ai-hustle`) |
| Production domain | https://find-a-flatmate.anchit-tandon.com |
| Production branch | `main` (every push deploys; PRs get preview deployments) |
| Framework / Node | Pinned in `vercel.json` (`nextjs`) and `package.json` engines (`>=22 <25`, resolves to Node 24) |
| CI | `.github/workflows/ci.yml`: lint, typecheck, unit tests, build on Node 22 and 24 |

## Environment variables

| Key | Scope | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Set to the production domain. Required: auth callbacks redirect to it. |
| `APP_ENV` | Production | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | All | **Not set**: sign-in and data features are disabled until provisioned. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All | **Not set** |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (sensitive) | **Not set**: photo uploads are disabled. Server only, never `NEXT_PUBLIC_`. |

## Provisioning Supabase (when ready)

1. Create the production Supabase project and apply `supabase/migrations/*` in order.
2. Add Auth redirect URL `https://find-a-flatmate.anchit-tandon.com/auth/callback`.
3. Add the three Supabase variables in Vercel, then redeploy.
4. Do not seed users, rooms or admin credentials in production.
