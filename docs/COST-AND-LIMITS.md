# Cost and Limits

_November 2026 · External figures were read from the official pages on **12 November 2026**. Plans change;
re-check the linked page before relying on any number._

## 1. Position today

- **No paid service has been purchased.** The stack is Vercel Hobby, Supabase Free and GitHub Actions.
- **The production database cannot be created yet.** Supabase's Free plan limits the number of active free
  projects per account, and this account has reached that limit. Until that is resolved, sign-in, data and
  photo features stay disabled in production (the Supabase environment variables are unset).
- Current spend: ₹0.

Ways to unblock, for the owner to decide (none has been done):

| Option | Cost | Note |
|---|---|---|
| Pause or delete an unused free project | None | Supabase states that paused projects do not count towards the free limit |
| Move the organisation to a paid plan | Pro is shown as "from $25/month" | A purchase; needs approval |

## 2. Services and their limits

### Supabase — Free plan

Sources: <https://supabase.com/pricing>, <https://supabase.com/docs/guides/platform/billing-on-supabase>,
<https://supabase.com/docs/guides/auth/rate-limits> (all checked 12 November 2026).

| Item | Limit as shown | Why it matters here |
|---|---|---|
| Price | $0/month | |
| Active projects | "Limit of 2 active projects." The billing page says two free projects, counted across all organisations where you are Owner or Administrator; paused projects do not count | **Currently blocks production** |
| Database | 500 MB, shared CPU, 500 MB RAM | Messages, events and rate-limit counters are never purged |
| Monthly active users | 50,000 | Far above pilot scale |
| File storage | 1 GB | Listing photos; files are never deleted today (THREAT-MODEL G6) |
| Maximum upload size | 50 MB | The app stores at most 750,000 bytes per photo |
| Egress | 5 GB, plus 5 GB cached egress | Every photo view is an uncached download through the media route |
| Inactivity | "Free projects are paused after 1 week of inactivity." | A quiet pilot week can take the database offline |
| Backups | Automatic backups not included | No recovery point on Free |
| Log retention | 1 day (API and database) | Short window for investigating incidents |
| API requests | Unlimited | |
| Realtime | 200 concurrent connections, 2 million messages a month | Not used; chat polls instead |
| Auth emails, built-in provider | 2 emails per hour for the whole project | **Too low for magic-link sign-in in a pilot.** Needs custom SMTP or the Send Email hook |
| OTP or magic-link requests | 60-second window per user by default | |
| Verification requests | 30 per 5 minutes per IP by default | |
| Token requests (includes refresh) | 150 per 5 minutes per IP by default | |

A custom SMTP provider would be a new service. None has been chosen or purchased; check current limits at the
chosen provider's pricing page.

### Vercel — Hobby plan

Sources: <https://vercel.com/pricing>, <https://vercel.com/docs/limits>,
<https://vercel.com/docs/functions/limitations>, <https://vercel.com/docs/cron-jobs/usage-and-pricing>
(all checked 12 November 2026).

| Item | Limit as shown | Why it matters here |
|---|---|---|
| Price | $0/month | |
| Permitted use | "Our Hobby plan is for personal, non-commercial use." | Any paid feature or commercial launch needs a paid plan first (Pro is shown at $20/month) |
| Fast Data Transfer | 100 GB/month | |
| CDN requests | 1M/month | Chat polling adds requests continuously |
| Function invocations | 1M/month | Every page, server action, media request and chat poll |
| Fluid active CPU | 4 hours/month | Image re-encoding with sharp uses CPU |
| Fluid provisioned memory | 360 GB-hours/month | |
| Function duration | 300 seconds, default and maximum | |
| Function memory | 2 GB / 1 vCPU | |
| Request and response body | 4.5 MB | App limits: 3 MB server-action body, 2.5 MB photo input |
| Image optimisation | 5K transformations/month | Not used; artwork is pre-optimised WebP and photos bypass the optimiser |
| Deployments | 100 per day | |
| Build | 45 minutes per deployment, 1 concurrent | |
| Cron jobs | 100 per project; on Hobby at most once per day, with per-hour precision | Enough for a daily `expire_rooms` job if one is added |
| Runtime logs | 1 hour | Very short window for debugging |
| Seats | 1 developer | |

### GitHub Actions

Source: <https://docs.github.com/en/billing/concepts/product-billing/github-actions> (checked 12 November 2026).

| Item | As shown | Why it matters here |
|---|---|---|
| Public repositories | Standard GitHub-hosted runners are free | |
| Private repositories, GitHub Free | $12 USD of included compute per month; 500 MB artifact storage; 10 GB cache per repository | The page expresses the allowance in dollars, not minutes |
| Linux 2-core runner | $0.006 per minute | By our arithmetic the Free allowance is about 2,000 such minutes; the page does not state a minute figure |

The workflow (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and build on Node 22 and Node 24, so
two Linux jobs per push to `main` and per pull request. It uploads no artifacts. For the repository's visibility
and current usage, check the repository's billing settings.

## 3. Where the free limits are likely to bite first

These are arithmetic on the figures above, not measurements.

| Pressure point | Reasoning |
|---|---|
| Sign-in email | 2 emails per hour project-wide means two people can sign in per hour on the built-in sender |
| Chat polling | One open chat refreshes every 7 seconds: about 514 requests an hour. One million invocations is about 1,900 open-chat hours a month, before any other traffic |
| Photo egress | Photos are served uncached by design. At the 750,000-byte cap, 5 GB is about 6,600 photo views a month; smaller files go further |
| Photo storage | Six photos at the cap is 4.5 MB per listing, so 1 GB holds roughly 220 fully loaded listings, and files are never deleted |
| Inactivity pause | One week without activity pauses a free Supabase project |
| No backups, short logs | A mistake in production has no restore point, and evidence disappears within an hour (Vercel) or a day (Supabase) |
| Commercial use | Hobby terms rule out monetisation experiments without a plan change |

## 4. Limits enforced by the app

### Rate limits (`private.throttle`, per member)

| Action | Limit |
|---|---|
| Save basics, lifestyle or privacy | 30 per hour each |
| Edit a listing | 35 per hour |
| Create a listing | 5 per day |
| Change listing status | 25 per hour |
| Attach a photo | 15 per hour |
| Send, pass, withdraw or reset interest | 35 per hour |
| Send a message | 45 per hour |
| Visit actions | 20 per hour |
| Set a visit address | 15 per hour |
| Save or unsave | 80 per hour |
| Block | 30 per hour |
| Report | 12 per day |
| Data request | 8 per day |
| Join waitlist, give feedback | 8 per hour each |
| Analytics event | 40 per hour |

Windows are fixed clock windows. Only successful calls are counted (THREAT-MODEL G5).

### Structural limits

| Area | Limit | Enforced in |
|---|---|---|
| Localities per profile | 1 to 4, all in the chosen city | `profiles` check, `save_basics` |
| Budget and every cost field | Up to ₹5,00,000 (50,000,000 paise); rent at least ₹1 | Table checks, `paise` in `lib/validate.ts` |
| Move-in window; availability window | At most 180 days; must not have ended already | Table checks; `save_basics`, `save_listing` |
| Planned stay; minimum stay | 1 to 36 months | Table checks |
| Display name | 2 to 60 characters | `profiles` check |
| Listing title; description | 8 to 90; 10 to 1,200 characters | `listings` checks |
| Transport and restrictions notes | Up to 300 characters each | `listings` checks |
| Rooms, bathrooms, capacity | Up to 20; capacity above current occupants | `listings` checks |
| Open listings per member | 8 (not counting filled or removed) | `save_listing` |
| Similar listings | Same owner, locality and normalised title refused | `save_listing` |
| Photos per listing | 6; at least 1 to submit | `attach_sanitized_photo`, `listing_transition` |
| Photo input | JPEG, PNG or WebP; 10 bytes to 2.5 MB; 20 megapixels; single frame | `lib/actions.ts`, op `upload` |
| Photo stored | WebP, within 1200 × 1200, at most 750,000 bytes | `lib/actions.ts`; bucket `room-photos` |
| Server action body | 3 MB | `next.config.ts` |
| **Listing expiry window** | **21 days** from submission (on approval) or from renewal, never beyond the end of the availability window | `moderate`, `listing_transition` |
| Message | 1 to 1,500 characters; a third identical message within an hour is refused | `messages` check, `send_message` |
| Open visits | One per conversation | Unique index `one_open_visit` |
| Visit time | Between 10 minutes and 90 days ahead | `visit_transition` |
| Visit address | 4 to 300 characters; readable from 24 hours before to 2 hours after the start | `private.visit_locations`, `read_visit_location` |
| Report details | 5 to 1,200 characters | `reports` check |
| Pending data requests | One export and one delete at a time | Unique index `outstanding_request` |
| Moderator reason; evidence justification | 5 to 500; 10 to 500 characters | `moderate`, `review_reported_message` |
| Result sizes | 50 public rooms; 80 people; 100 conversations; 60 moderation profiles | `public_rooms`, `discover_people`, `inbox`, `moderation_profiles` |
| Catalogue | 2 cities, 4 localities, 14 lifestyle dimensions, 7 amenities | Seed data, `lib/catalog.ts` |

## 5. Cost triggers to watch

| Trigger | Consequence |
|---|---|
| Need for a third Supabase project, backups, or no inactivity pause | Supabase paid plan |
| Any commercial use, more than one developer seat, longer logs | Vercel paid plan |
| Reliable sign-in email | A transactional email provider |
| Realtime chat, push notifications, SMS or phone verification | New services; none evaluated |

No prices beyond those quoted from the official pages above are assumed anywhere in this repository.
