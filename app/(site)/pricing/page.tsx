import Link from 'next/link';

export const metadata = {
  title: 'Pricing',
  description: 'Find a Flatmate is free during the MVP. Discovery, matching, chat and listings cost nothing, and the app never handles rent, deposits or brokerage.',
};

const included = [
  'Browsing rooms and people in our launch localities',
  'The lifestyle questionnaire and compatibility scores, with reasons',
  'Chat, once you have both expressed interest',
  'Proposing and confirming visits',
  'Listing a room, with up to 6 photos and an itemised cost breakdown',
  'Blocking, reporting and moderator review',
] as const;

export default function PricingPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Pricing</p>
        <h1>Free while we are in MVP</h1>
        <p className="lede">
          Discovery, matching, chat and listings cost nothing. There are no paid plans, and nothing in the app asks for your card or UPI details.
        </p>
      </div>

      <section className="section">
        <div className="wrap grid two">
          <div className="card">
            <p className="chip">Available today</p>
            <h2>Everything below, for ₹0</h2>
            <p className="muted">For people looking for a room and people with a room to fill.</p>
            <div className="prose">
              <ul>
                {included.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="row">
              <Link className="btn primary" href="/onboarding/intent">Get started</Link>
              <Link className="btn" href="/login">Sign in</Link>
            </div>
          </div>

          <div className="stack">
            <div className="note warn">
              <p><strong>We never handle money between flatmates.</strong> There are no payments, escrow, deposits or brokerage in the app. Rent and deposits are settled directly between you and the other person. If anyone asks you to pay through Find a Flatmate, or to pay to “unlock” a room or a chat, it is not us. Please report them.</p>
            </div>
            <div className="card">
              <h2>What a room costs is the poster’s to state</h2>
              <p className="muted">
                Listings itemise rent, maintenance, estimated utilities and other recurring charges, with the one-time deposit, brokerage and move-in fees shown separately. Those amounts are set by the person listing the room, not by us. See <Link href="/how-it-works">how it works</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="narrow prose">
          <h2>Ideas we may test later</h2>
          <p>
            Running a careful service costs money, and we would rather say so now. The items below are ideas we may test later. They are not available today, they have no prices, and we have not committed to building any of them.
          </p>
          <ul>
            <li><strong>Assisted matching</strong>, for people who want more help with their search.</li>
            <li><strong>Optional verification</strong>, carried out through licensed partners, for people who choose it.</li>
            <li><strong>Sponsored listings</strong>, clearly labelled as sponsored wherever they appear.</li>
          </ul>
          <p className="note">If we do test any of these, they would be optional extras, and the free core described above is what exists today. We run no advertising trackers and no third-party analytics. See our <Link href="/privacy">privacy draft</Link>.</p>
          <p className="muted">More questions? Try <Link href="/help">Help</Link>.</p>
        </div>
      </section>
    </>
  );
}
