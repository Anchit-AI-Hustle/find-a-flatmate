# Privacy and Safety

_November 2026 · Describes what the code does today, not what a policy page promises_

**No compliance claim is made anywhere in this document.** Section 8 is an unreviewed checklist. Legal review is
required before launch.

## 1. Data inventory

| Data | Stored in | Collected when | Notes |
|---|---|---|---|
| Email address | Supabase Auth (`auth.users`) | Sign-in | Never returned by any RPC or shown to other members |
| Display name | `profiles.display_name` | Basics | Filtered for links, emails, phone numbers and markup |
| City, 1–4 localities, budget range, move-in window, planned stay, intent | `profiles` | Basics | |
| Adult self-declaration | `profiles.age_confirmed` | Basics | A checkbox. No date of birth is collected |
| Lifestyle answers (14 dimensions: habit, expectation, strength) | `user_preference_answers` | Lifestyle step | Includes smoking, alcohol, kitchen and guest preferences |
| Listing text, costs, house rules, amenities | `listings` and child tables | Listing form | Title, description, transport, restrictions pass the public-text filter |
| Listing photos | Private bucket `room-photos`; `listing_images` | Upload | Re-encoded to WebP; embedded metadata (including GPS) is dropped |
| Interests, matches, saved items, blocks | `interests`, `matches`, `saved_items`, `blocks` | Use | |
| Chat messages | `messages` | Chat | Plain text, with a `suspicious` flag |
| Visit times, outcomes, history | `visit_requests`, `visit_events` | Visits | |
| Visit address | `private.visit_locations` | Shared by one member | Not readable through the API except in a time window |
| Reports | `reports` | Report form | Free-text details |
| Consents | `user_consents` | Basics, privacy settings | Purpose, granted, revision `2026-11`, time |
| Reminder preference | `notification_preferences` | Privacy settings | Stored only; no reminders are sent |
| Analytics events | `product_events` | Certain actions, **only with analytics consent** | User id, event name, city, intent, time |
| Ranking feedback | `ranking_feedback` | "Was this useful" | User id and yes/no. **Not** gated by analytics consent |
| Waitlist | `availability_waitlist` | Waitlist button | User id and city |
| Data requests | `data_subject_requests` | Data settings | Kind and optional details |
| Moderator activity | `moderation_actions`, `admin_audit_logs` | Moderation | Moderator id, target, action, reason |
| Rate-limit counters | `private.rate_buckets` | Every throttled write | User id, kind, window, count |
| Cookies | Browser | Sign-in; intent choice | Supabase session cookies; `ff_intent` (1 hour) |

Not collected by this codebase: phone number, government ID, date of birth, gender, photos of people, device
location, payment details, contacts.

Processors in use: Supabase (database, authentication, sign-in email, file storage) and Vercel (hosting, request
logs). Fonts are self-hosted. There is no analytics SDK, advertising tag or third-party script in `package.json`.

## 2. What is public and what is private

| Audience | Can see |
|---|---|
| Anyone, signed out | City and locality names; live room counts per city; for each live listing: id, title, locality, room type, itemised costs, availability dates, review and reconfirmation dates |
| Signed-in member with an **active** profile | Live listings in full (description, rules, amenities, photos, owner id); discoverable people: name, city, localities, budget range, dates, stay, intent, lifestyle answers, "email verified" |
| A person you sent interest to | Your profile, even if you are not discoverable |
| Your match | Chat, visit requests, and the visit address within its time window |
| Moderators | All listings in any state and their photos; all reports; data requests; analytics events with user ids; 60 recently updated profiles (id, name, status, created date); a reported message, one at a time, with a logged justification |
| Nobody through the API | Email addresses, other people's blocks and saved items, `private` tables, feature flags, ranking feedback |

Controls the member has (`save_privacy`): `discoverable` on or off, profile `active` or `paused`, analytics opt-in,
reminder opt-in. Pausing hides the profile and listings and makes existing chats unreadable for both sides until
the profile is active again.

Known limitation: turning `discoverable` off does not currently stop interest from someone who already has your
profile id (THREAT-MODEL gap G1).

## 3. Consent

| Consent | Default | Recorded | Withdrawal |
|---|---|---|---|
| Terms | Required to create a profile | `user_consents` purpose `terms`, revision `2026-11` | Close the account |
| 18+ declaration | Required | `profiles.age_confirmed` | — |
| Analytics | **Off** unless ticked | `user_consents` purpose `analytics` | Untick in privacy settings. New events stop at once. Events already stored stay until account closure |
| Reminders | Off | `notification_preferences.reminders` | Untick |
| Listing attestation ("I have permission to list this") | Required per save | `listings.attested` | — |
| Photo permission | Required per upload | Checked in the server action; not stored | Remove the photo while the listing is a draft |

Events written only when analytics consent is granted: `onboarding_completed`, `interest_sent`, `mutual_match`,
`first_message`, `visit_requested`, `visit_confirmed`, `visit_completed`, `discover_view`,
`compatible_profile_opened`, `home_found_self_reported`.

## 4. Retention as implemented

There is **no scheduled deletion of any data**. The table states what the code does.

| Event | What the code does | Not implemented |
|---|---|---|
| Member closes account (`data_request('delete')`) | Queues a pending `delete` request. Sets the profile to `closed` and not discoverable. Sets every open listing to `removed`. Deletes visit addresses the member shared. Deletes the member's analytics events. Sets analytics consent to not granted. The account can no longer write anything except further data requests. Chats become unreadable for the other person | Erasure of the profile row, display name, lifestyle answers, messages, interests, matches, saved items, reports, listing rows, photo records and photo files, and the Supabase Auth user (email). All of these remain. Delete requests cannot be marked fulfilled in the app |
| Member asks for an export | Queues a pending `export` request (one at a time) | Producing or delivering the export |
| Analytics consent withdrawn | No new events | Deleting earlier events |
| Visit leaves `confirmed` (completed, no-show, cancelled, rescheduled) | Address deleted | Deleting the address of a confirmed visit that nobody closes out. It becomes unreadable 2 hours after the start but stays stored |
| Block | Saved items between the two deleted; chat hidden from both | Deleting messages; cancelling an open visit |
| Listing filled or removed | Hidden from others | Deleting photos from storage |
| Photo removed from a draft | Row and file deleted | — |
| Messages, reports, audit logs, rate-limit counters ageing | Nothing | Any retention period or purge job |
| Supabase Auth user deleted by an operator | Database cascades remove the profile and most dependent rows; reports and moderation logs keep rows with the reference nulled | Removing the member's photo files from storage |

## 5. Moderator access to message evidence

Moderators have no general access to chats. Row level security on `messages` admits conversation members only.

1. A member reports a specific message (`file_report` with `message`). The reporter must still be able to see the
   conversation at that moment.
2. A moderator moves the report to `investigating` (`moderate('report', …)`), with a reason.
3. The moderator requests the evidence with a written justification of 10–500 characters
   (`review_reported_message`).
4. The function returns the body of **that one message** and writes two log rows: `moderation_actions`
   (`read_reported_message`, with the justification) and `admin_audit_logs`.
5. The report is resolved, dismissed or escalated. Evidence access also works while `escalated`.

Limits: surrounding messages are not available; there is no review of flagged-but-unreported messages; moderator
grants are made by direct database access and are not themselves logged.

## 6. Trust labels

Exactly three labels are backed by data. No other badge should be shown.

| Label | Backed by | What it does **not** mean |
|---|---|---|
| Email verified | `verification_checks` row of kind `email`, created at basics | Identity. Every member has it, because a confirmed email is required to do anything |
| Moderator reviewed | `listings.reviewed_at`, set on approval and cleared by any edit | That the poster owns or may sublet the home, or that anyone visited it |
| Availability reconfirmed | `listings.confirmed_at`, set on submit and on each renewal; history in `listing_reconfirmations` | That the room is still free. It records that the poster said so, at most 21 days ago |

None of these is a safety guarantee. The site footer says so, and says the product never holds deposits or rent.

## 7. Safety mechanisms

| Mechanism | Behaviour |
|---|---|
| Mutual opt-in | No chat until both people send interest |
| Public-text filter (`private.public_text`) | Rejects names and listing text containing `http://`, `https://`, `www.`, an email address, ten or more digits in a row (with separators), or `<…>` markup. It can also reject two full dates written next to each other |
| Scam keyword warning | A message is flagged `suspicious` if it contains: `upi`, `paytm`, `phonepe`, `gpay`, `aadhaar`, `aadhar`, `otp`, `whatsapp`, `bank details`, "advance … pay/transfer/deposit", or "token … fee/money/amount". The message is still delivered. Both members can see the flag. Nothing is sent to moderators |
| Limits of the warning | Matching is by substring, so ordinary words trigger it ("occupied" contains `upi`). Spaced or misspelt terms evade it. Text inside photos is not scanned |
| Repeated messages | A third identical message in the same chat within an hour is refused |
| Visit address | Stored apart from the chat; readable only for a confirmed visit, from 24 hours before to 2 hours after |
| Block | Immediate and permanent; hides the chat for both |
| Report | Categories: scam, harassment, underage, stale, privacy, appeal, other. Can block in the same step |
| Listing review | No listing is visible to others before a moderator approves it; edits return it to review |
| Rate limits | Per account, listed in API-CONTRACTS.md |

Known safety gaps are listed in THREAT-MODEL.md. Two matter most for members: a report cannot be filed once the
other person has paused, been suspended, closed their account or been blocked; and a suspended member cannot use
the report form to appeal (the support request works).

## 8. DPDP Act 2023 and DPDP Rules 2025 — UNREVIEWED checklist

This is an engineering checklist of topics to put in front of counsel. It has **not** been reviewed by a lawyer.
It is not legal advice and not a statement of compliance. The Rules were notified in November 2025 with phased
commencement; confirm which provisions apply on which dates from the official gazette, not from this file.

| Topic | What the code does today | Question for legal review |
|---|---|---|
| Notice at collection | Terms checkbox at basics; consent revision stored | Is the notice itemised, clear and available in the required languages? |
| Consent and withdrawal | Analytics is opt-in and can be switched off in settings | Is withdrawal as easy as giving consent for every purpose? What is the lawful basis for ranking feedback and waitlist data? |
| Purpose limitation | Fields are tied to matching, listing and safety | Is each field necessary? Are lifestyle answers treated appropriately? |
| Access and correction | Members can view and edit their profile, answers and listings | Is a summary of processing and of recipients required on request? |
| Erasure | Account closure hides data; erasure is not implemented | What must be erased, by when, and what may be kept (reports, audit logs)? |
| Export | Request is queued only | Is any export obligation engaged? |
| Grievance redressal | Support request queue | Published contact, named officer and response time? |
| Nomination | Not implemented | Is it required for this product? |
| Children | 18+ self-declaration; `underage` report category | Is self-declaration enough? What if a minor is found? |
| Security safeguards | RLS, RPC-only writes, private storage, logged moderator access | Are the gaps in THREAT-MODEL.md acceptable? Encryption, access logs and log retention requirements? |
| Breach notification | Not implemented | Process, timelines and templates for the Board and affected people |
| Retention | No retention schedule or purge | Required periods; erasure after inactivity; log retention |
| Processors | Supabase and Vercel | Contracts, sub-processors, hosting region |
| Cross-border transfer | Hosting region not yet chosen (database not provisioned) | Any restriction on the chosen regions? |
| Records of consent | `user_consents` holds current state only, not history | Is an auditable history needed? |
| Significant Data Fiduciary status | Not assessed | Does it apply at any planned scale? |
