# UX Decisions

_November 2026 · A decision log. Reasons are design rationale, not research findings; see VALIDATION-PLAN.md for
how each will be tested._

Each entry records the decision, why, where it lives in code, and what it costs us.

## Summary

| # | Decision | Main reason |
|---|---|---|
| 1 | Mobile-first: bottom tab bar on phones, sidebar on desktop | Assumed phone-heavy use; one-handed reach |
| 2 | Plain CSS design tokens, no Tailwind or shadcn | Small bundle, no extra dependencies |
| 3 | Self-hosted variable fonts: Fraunces and DM Sans | No third-party font requests |
| 4 | Light theme only, for now | One palette to get right and test for contrast |
| 5 | AI-generated gouache-style illustrations, decorative only | Warmth without implying real members or homes |
| 6 | Compatibility as reasons, differences, missing info and confidence | A lone percentage overstates what we know |
| 7 | Receipt-style cost breakdown | Monthly cost and move-in cash are different decisions |
| 8 | Polling for chat refresh, no realtime sockets | Simpler security model and no extra service |
| 9 | Installable PWA with offline fallback, no push notifications | App-like access without permission prompts |
| 10 | WCAG 2.2 AA as the target | Housing search should not exclude people |

## 1. Mobile-first navigation

- **Decision.** Phones get a fixed bottom tab bar with five destinations: Home, Discover, Matches, Chats, You.
  From 960 px wide, the tab bar and top bar are hidden and a left sidebar shows the same destinations plus
  Visits, Saved, My listings, Settings and, for moderators, Moderation.
- **Why.** The pilot audience is assumed to be mostly on phones. Primary actions sit in thumb reach; unread and
  incoming-interest counts stay visible on every screen.
- **Where.** `.tabbar`, `.side`, `.app` in `app/globals.css`; `TabBar` and `SideNav` in `components/nav.tsx`;
  counts loaded in `app/app/layout.tsx`. The bar respects `env(safe-area-inset-bottom)`.
- **Cost.** Five slots only. Visits, Saved, listings and Settings are one level down on phones.

## 2. Plain CSS design tokens

- **Decision.** One stylesheet, `app/globals.css`, with custom properties and a small set of component classes.
  No Tailwind, no shadcn, no CSS-in-JS.
- **Why.** Small bundle and no extra dependencies to audit or upgrade. The runtime dependency list is short:
  Next.js, React, Supabase clients, Zod, sharp, lucide-react icons and two font packages.
- **Tokens.**

| Token | Value | Use |
|---|---|---|
| `--ink` | `#162323` | Text, dark buttons, focus outline |
| `--ivory` | `#FBF9F5` | Page background |
| `--teal` | `#167C70` | Primary actions, active states |
| `--mint` | `#E6F4ED` | Soft fills, chips, hover |
| `--coral` | `#F08A72` | Accent and decoration only |

  Supporting tokens: `--ink-soft`, `--paper`, `--line`, `--line-strong`, `--teal-deep`, `--coral-deep`,
  `--coral-soft`, `--amber-soft`, `--amber-deep`, radii, one shadow, `--nav-h`.
- **Cost.** No utility classes; new patterns need new CSS. Consistency depends on review, not tooling.

## 3. Self-hosted fonts

- **Decision.** Fraunces (variable) for display headings and DM Sans (variable) for body text, installed from
  `@fontsource-variable/*` and imported in `app/layout.tsx`.
- **Why.** Font files are served from our own origin, so no visitor data goes to a font host, and there is one
  fewer external dependency at render time.
- **Where.** `--display` and `--body` in `app/globals.css`, each with system fallbacks.
- **Cost.** Font bytes count against our own bandwidth.

## 4. Light theme only

- **Decision.** `color-scheme: light`. No dark mode yet.
- **Why.** One palette to design, check for contrast and test. Dark mode is deferred, not rejected.
- **Cost.** Bright at night; no respect yet for a system dark preference.

## 5. Illustrations

- **Decision.** The images in `public/art` (`hero`, `visit`, `together`, `kitchen`, `costs`) are AI-generated,
  gouache-style artwork. They are decorative. They are never presented as real members or real homes, and no
  stock-photo identities are used anywhere.
- **Why.** A flatmate product that shows attractive "members" who do not exist would be the kind of fake signal
  the product is meant to remove. Illustration sets a warm tone without making a claim.
- **Where.** `Art` in `components/site.tsx` defaults to empty alt text. People are represented by initials
  (`.avatar`), not photos; the product stores no photos of people.
- **Cost.** No faces means less immediate "social proof". We accept that.

## 6. Compatibility display

- **Decision.** Show why two people or a person and a room fit: agreements, differences, what has not been
  answered, and a confidence level. A number appears beside these, never alone. When there is a hard conflict or
  too little information, no number is shown: the card reads "Not a fit" or "More info needed".
- **Why.** The score reflects stated preferences only. Showing reasons lets people judge for themselves and makes
  missing answers visible rather than silently lowering a percentage.
- **Where.** `Score` and `Fit` in `components/fit.tsx`; rules in MATCHING-SPEC.md. The full view states the
  scoring version and that a score is not a safety check.
- **Cost.** More to read than a badge. Reasons are sorted alphabetically, not by importance.

## 7. Receipt-style costs

- **Decision.** Every listing shows an itemised receipt in two blocks: "Every month" (rent, maintenance,
  utilities estimate, other fixed charges, total) and "One-time, at move-in" (deposit, brokerage, fees, cash
  needed to move in). Unknown utilities are shown as "Not known yet" and the total is labelled "before
  utilities".
- **Why.** Monthly affordability and the cash needed on day one are separate questions, and hidden costs are a
  core problem we set out to address.
- **Where.** `Receipt` and `Price` in `components/costs.tsx`; `totals()` in `lib/catalog.ts`; amounts in paise.
- **Cost.** Posters must enter up to seven amounts.

## 8. Chat refresh by polling

- **Decision.** The chat view re-fetches every 7 seconds while the tab is visible and the device is online. No
  WebSocket or Supabase Realtime subscription.
- **Why.** Reads stay on the same server-rendered, RLS-checked path as everything else, with no realtime
  publication to secure and no additional connection limits to manage.
- **Where.** `ChatLive` in `components/chat-live.tsx` (`router.refresh()` on an interval).
- **Cost.** Up to 7 seconds of delay, and one request per open chat every 7 seconds. No typing or presence
  indicators.

## 9. PWA without push

- **Decision.** The site is installable (standalone display, portrait, maskable icon). A service worker caches
  only public static assets and an offline page; navigation falls back to `/offline` when the network fails. An
  in-page banner says when the device is offline. There are no push notifications.
- **Why.** Home-screen access without an app store. Signed-in pages and API responses are never cached because
  they are private and must be fresh. Push is left out to avoid permission prompts and a delivery service.
- **Where.** `app/manifest.ts`, `public/sw.js`, `components/pwa.tsx`, `app/offline/page.tsx`. The worker is
  registered in production builds only.
- **Cost.** No offline use of signed-in screens. No reminders: the reminder preference is stored but nothing is
  sent.

## 10. Accessibility targets

- **Decision.** Aim for WCAG 2.2 AA, with 44 px touch targets, visible focus and reduced-motion support. These
  are targets. No audit has been done and conformance is not claimed.
- **Where and current state.**

| Target | In code | Status |
|---|---|---|
| Touch targets of 44 px | `.btn` 46 px, inputs 46 px, `.check` 46 px, tab links 58 px, filter summary 44 px | `.btn.small` is 40 px: below our own target, above the 24 px AA minimum |
| Visible focus | `:focus-visible` 3 px ink outline; teal outline on form fields | Present |
| Reduced motion | `prefers-reduced-motion` removes transitions, animations, smooth scroll and the image tilt | Present |
| Skip link, landmarks, language | "Skip to content" link, `main#main`, `lang="en-IN"` | Present |
| Text contrast | Ink on ivory 15.4:1; soft ink on ivory 7.0:1; white on teal 5.1:1; deep teal on mint 7.1:1 (computed from the tokens) | Coral on ivory is 2.3:1, so coral is never used for text; `--coral-deep` is used instead |
| Automated checks | `@axe-core/playwright` is installed and referenced by the specs in `tests/e2e` | Being written in parallel; no results are recorded in this document |

## Other conventions

- Amounts are formatted as Indian rupees (`en-IN`); dates and times are shown in IST.
- Every form posts to a server action and shows pending, error and success states (`ActionForm`).
- Destructive actions (block, close account) need an explicit confirmation field.
- Error messages are plain sentences from the database rule that was hit, or a generic fallback.

## Swipe-first discovery and minimal text (12 November 2026)

- **Decision:** Discover opens on a swipe deck (one card at a time) for both people and rooms. Like and pass are large icon buttons; drag and the arrow keys do the same; undo brings back the last pass; a mutual like shows a match screen with "Say hello". A list view stays one tap away for people who want to compare and filter.
- **Why:** the owner asked for Tinder-like matching and far less text. Swiping is the interaction; the rest of the journey (fit reasons, full cost, mutual-interest chat, visits, moderation) is unchanged, so the product is still more than a swipe app.
- **Guardrails kept:** only candidates that pass the hard checks appear in the deck; each card still shows the two best reasons and one difference; every swipe goes through the same `interest_transition` RPC as the list buttons.
- **Lifestyle answers:** one tap per topic with emoji labels. The chosen option is stored as both the member's habit and what they would like; "must match" stores it as a dealbreaker. Stating a different expectation from your own habit is no longer possible in the UI (the data model still supports it).
- **Avatars:** members have no photos, so each gets a simple drawn face generated from their id. It is decorative, not a likeness.
- **Landing page:** reduced to a headline, three choices, four icon steps and three picture cards.
