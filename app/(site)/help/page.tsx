import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Help',
  description: 'Answers to common questions about signing in, compatibility scores, listings and costs, chat, visits, reporting and your data on Find a Flatmate.',
};

type Faq = { q: string; a: ReactNode };

const groups: { title: string; items: Faq[] }[] = [
  {
    title: 'Getting started',
    items: [
      { q: 'Who can use Find a Flatmate?', a: <p>Adults aged 18 and over who are looking for a room or have a room to fill. We are starting in Gurugram (DLF Phase 3, Sector 56) and Noida (Sector 62, Sector 137), and will add localities only when there is real inventory.</p> },
      { q: 'How do I sign in? I was not asked for a password.', a: <p>Sign-in is passwordless. Enter your email address on the <Link href="/login">sign-in page</Link> and we send you a magic link. Opening it signs you in and marks your email as verified.</p> },
      { q: 'Does it cost anything?', a: <p>No. Discovery, matching, chat and listings are free during the MVP, and there are no paid plans. See <Link href="/pricing">pricing</Link>.</p> },
      { q: 'I want to find a flat together with other people. Can I?', a: <p>Group search is coming later. For now you can join the waitlist for your city.</p> },
    ],
  },
  {
    title: 'Compatibility',
    items: [
      { q: 'What does the lifestyle questionnaire ask?', a: <p>It covers 14 topics: sleep rhythm, noise, cleanliness, cooking, shared kitchen (including vegetarian or mixed), guests, smoking, alcohol, pets, work from home, privacy and social time, chores, shared expenses, and AC and utilities. For each you give your own habit, what you want in a home, and whether that is flexible, a preference or a dealbreaker.</p> },
      { q: 'Do I have to answer everything?', a: <p>No, any question can be skipped. Skipped answers lower the confidence level shown with a match. They never raise a score.</p> },
      { q: 'How is the score calculated?', a: <p>By fixed rules, with no AI. Hard checks come first (same city, overlapping locality, overlapping move-in window, budget, dealbreakers). Then a score out of 100: lifestyle 40, budget 20, locality 15, move-in dates and stay length 15, household logistics 10. The full table is on <Link href="/how-it-works">How it works</Link>.</p> },
      { q: 'Does a high score mean the person is safe?', a: <p>No. A score is not a prediction of harmony and not a safety rating. It tells you where your stated habits line up. Please read our <Link href="/safety">safety advice</Link>.</p> },
      { q: 'Is there anything you will not ask me?', a: <p>We never ask for your salary, religion, caste, politics, sexuality, health or ID numbers.</p> },
    ],
  },
  {
    title: 'Listings and costs',
    items: [
      { q: 'What do I need to list a room?', a: <p>An itemised cost breakdown in rupees, the locality, and up to 6 photos. You confirm that you are the occupant or owner and have permission to list. A moderator reviews every listing before it goes live.</p> },
      { q: 'Will my address be public?', a: <p>No. Only the locality is shown. Location data and other metadata are stripped from photos when you upload them.</p> },
      { q: 'How are costs shown?', a: <p>Rent, maintenance, estimated utilities and other recurring charges make up the monthly total. Deposit, brokerage and move-in fees are listed separately as move-in cash. A refundable deposit is never counted as a monthly cost, and unknown utilities are shown as “unknown”, not ₹0.</p> },
      { q: 'Why did my listing disappear?', a: <p>Listings expire after 21 days unless you reconfirm that the room is still available. A moderator may also remove a listing that breaks the <Link href="/community-guidelines">community guidelines</Link>.</p> },
    ],
  },
  {
    title: 'Chat and visits',
    items: [
      { q: 'Why can’t I message someone straight away?', a: <p>Chat opens only after both of you express interest. Phone numbers and email addresses are never shown.</p> },
      { q: 'Why did a message arrive with a warning?', a: <p>Messages that mention advance payments, UPI, OTPs, Aadhaar or moving to WhatsApp are flagged for the person receiving them. These are simple keyword rules, not AI, so a warning is a prompt to be careful and not an accusation.</p> },
      { q: 'How do visits work?', a: <p>Either person proposes a time. The other confirms, declines or proposes a new time.</p> },
      { q: 'When do I get the exact address?', a: <p>After a visit is confirmed, the host may choose to share it. It is visible only to you, from 24 hours before the visit until 2 hours after, and the host can withdraw it.</p> },
      { q: 'Can I pay a deposit or rent through the app?', a: <p>No. We do not handle payments, escrow, deposits or brokerage. Never pay a “token” or advance for a room you have not seen.</p> },
    ],
  },
  {
    title: 'Blocking, reporting and your account',
    items: [
      { q: 'What happens when I block someone?', a: <p>Chat and visibility are cut both ways, immediately.</p> },
      { q: 'What happens when I report something?', a: <p>You can report a profile, a listing or a message. Reports go to moderators, who can remove listings and suspend accounts. Every moderator action is logged.</p> },
      { q: 'Can moderators read my chats?', a: <p>They cannot browse chats. They can read only a specific reported message, and must write a justification that is logged.</p> },
      { q: 'My account was suspended. What can I do?', a: <p>You can appeal from <Link href="/app/settings/data">Settings → Data &amp; support</Link>.</p> },
      { q: 'How do I download my data or close my account?', a: <p>Both are in <Link href="/app/settings/data">Settings → Data &amp; support</Link>. Closing your account immediately hides your profile and removes your listings. More detail is in the <Link href="/privacy">privacy draft</Link>.</p> },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <div className="narrow page-head">
        <p className="eyebrow">Help</p>
        <h1>Questions, answered plainly</h1>
        <p className="lede">Short answers about how Find a Flatmate works today. Tap a question to open it.</p>
      </div>

      <section className="section">
        <div className="narrow prose">
          {groups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <div className="stack">
                {group.items.map((item) => (
                  <details className="card stack" key={item.q}>
                    <summary><strong>{item.q}</strong></summary>
                    <div className="muted">{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="narrow">
          <div className="note">
            <p><strong>Still stuck?</strong> If you are signed in, contact us from <Link href="/app/settings/data">Settings → Data &amp; support</Link>. A named grievance contact will be published on our <Link href="/privacy">privacy page</Link> before public launch.</p>
          </div>
        </div>
      </section>
    </>
  );
}
