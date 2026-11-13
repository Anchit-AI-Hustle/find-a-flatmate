# Deployment

- Canonical repository and Vercel Git connection use `Anchit-AI-Hustle/find-a-flatmate`, branch `main`.
- Vercel project is `find-a-flatmate` under `anchit-ai-hustle`, with Next.js and Node 24. Functions run in Singapore alongside Neon. Scoped reads and RPCs send the transaction in one HTTPS request and check the current provider session in Postgres.
- Production is https://find-a-flatmate.anchit-tandon.com and https://find-a-flatmate.vercel.app.
- The connected Neon Free project is `curly-surf-73514052` in Singapore. Neon manages Google and email-link authentication. Listing images are sanitized WebP bytes in a private Postgres schema. Revisit object storage before approaching the Free database quota.

## Neon

The integration injects `DATABASE_URL` and `NEON_AUTH_BASE_URL` in Production. Set `NEON_AUTH_COOKIE_SECRET` in the Vercel secret store and configure the exact trusted app origins in Neon Auth. `NEXT_PUBLIC_SITE_URL` is the canonical domain. `AUTH_TRUSTED_ORIGINS` adds specific alternate hostnames. Avoid pointing previews at production.

For an empty Neon branch, run `node --env-file=.env.local neon/apply-fresh.mjs` with a direct, owner URL and Auth enabled. For the existing schema, run `node --env-file=.env.local neon/apply-managed.mjs`. The bootstrap maps the Supabase roles and schemas to the Neon compatibility layer. The additive migration revokes old grants and requires a live verified Neon session in every actor-scoped transaction. Use trusted TLS and keep the database owner credential server only.

For an existing Neon branch that predates `20261113070000_export_sent_messages.sql`, apply the actor-scoped export RPC before deploying the route. From the repository root, run `sed 's/auth\.uid()/ff_auth.uid()/g' supabase/migrations/20261113070000_export_sent_messages.sql | node --env-file=.env.local neon/apply-managed.mjs -1 -f -`. The function returns only the caller’s own messages, including in a blocked conversation. Chat permissions stay in their original RLS policy.

The previous custom web session no longer works after the migration. Users should sign in again with the same Google email or email link. For a moderation role, verify the person’s real sign-in and then insert the confirmed application user ID into `private.moderators` through an operator connection. Never seed moderator or member accounts in production.

CI integration and browser tests use local Supabase. For managed-provider smoke tests, use an isolated Neon branch and test account. Test new-account onboarding, returning sign-in, sign-out, protected routes, mobile exchange, and denied access after revocation. Production smoke tests can check those same routes without adding fictitious listings or profiles. See [native builds](NATIVE-BUILD.md) for the preview assets.

Set `CRON_SECRET` to run the daily Vercel expiry task. Account erasure needs operator verification and cleanup of the Neon Auth user and associated compatibility identity. Follow the privacy runbook for retention exceptions.
