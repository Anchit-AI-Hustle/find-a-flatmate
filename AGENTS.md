# Find a Flatmate
Use Node 22 or 24 and npm. Run lint, typecheck, unit tests, build, and relevant SQL/browser tests. Do not seed users, rooms, or admin credentials in production. Keep all writes behind validated server handlers and actor-scoped Postgres RPCs; document changes to the access model and transitions. Never print or commit secrets. Check IMPLEMENTATION-STATUS before release.

- SQL and browser tests need the local Supabase stack (see README). They must never point at a remote project.
- A change to an RPC or policy goes in a new migration with a header comment that states the access-model change, plus a test in `tests/integration`.
- Public copy must not invent statistics, testimonials, verification, pricing or safety guarantees. Only "email verified", "moderator reviewed" and "availability confirmed" exist as trust labels.
- Artwork in `public/art` is decorative illustration; never present it as a real member or home.
- UI uses the tokens and classes in `app/globals.css`; keep WCAG 2.2 AA (the browser tests run axe).
