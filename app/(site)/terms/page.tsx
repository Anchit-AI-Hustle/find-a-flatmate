import Link from 'next/link';

export const metadata = {
  title: 'Terms',
  description: 'A plain-language draft of the terms for using Find a Flatmate: who can use it, what the service does and does not do, and how moderation works. Pending legal review.',
};

export default function TermsPage() {
  return (
    <>
      <div className="narrow page-head">
        <p className="eyebrow">Terms</p>
        <h1>Terms of use</h1>
        <p className="lede">The ground rules for using Find a Flatmate, in plain language: what we provide, what we do not, and what we ask of you.</p>
        <p className="note warn">
          This is a plain-language draft pending legal review. It is not yet a final legal document and some sections are still to be written.
        </p>
        <p className="muted small">Last updated: November 2026</p>
      </div>

      <section className="section">
        <div className="narrow prose">
          <h2>1. What Find a Flatmate is</h2>
          <p>
            Find a Flatmate is a web app that helps adults find flatmates and rooms, starting in Gurugram and Noida. It lets you compare lifestyles, see itemised costs, chat once both people are interested, and arrange a visit.
          </p>
          <p>
            We introduce people. We are not a broker, landlord or agent, we do not inspect homes, and we are not a party to any agreement you make with another member.
          </p>

          <h2>2. Who can use it</h2>
          <ul>
            <li>You must be 18 or older.</li>
            <li>You sign in with a magic link sent to your email address, so you need an email account that you control.</li>
          </ul>

          <h2>3. Price and payments</h2>
          <p>
            The service is free during the MVP: discovery, matching, chat and listings cost nothing, and there are no paid plans. See <Link href="/pricing">pricing</Link>.
          </p>
          <p>
            We do not handle payments, escrow, deposits or brokerage. Any money that changes hands is directly between members, outside the app, and at your own decision.
          </p>

          <h2>4. What “verified” means here</h2>
          <p>
            The only verification we carry out is “email verified”. We do not verify phone numbers, check identity documents or run background checks. No label, listing review or compatibility score is a safety guarantee. Please follow our <Link href="/safety">safety advice</Link> and make your own checks before you visit or pay anyone.
          </p>

          <h2>5. Your responsibilities</h2>
          <ul>
            <li>Give honest, accurate information about yourself and any room you list.</li>
            <li>Follow the <Link href="/community-guidelines">community guidelines</Link>.</li>
            <li>Do not ask other members for advance payments, OTPs, Aadhaar or bank details.</li>
            <li>Do not share another person’s private details, including an address shared with you for a visit.</li>
            <li>You are responsible for what you post, and you allow us to show it to other members as needed to run the service.</li>
          </ul>

          <h2>6. Listings</h2>
          <ul>
            <li>When you list a room, you confirm that you are the occupant or owner and that you have permission to list it.</li>
            <li>Costs must be itemised in rupees: rent, maintenance, estimated utilities and other recurring charges, with deposit, brokerage and move-in fees stated separately.</li>
            <li>Every listing is reviewed by a moderator before it goes live. Review is not an inspection of the home or a check of ownership.</li>
            <li>Listings expire after 21 days unless you reconfirm that the room is available.</li>
          </ul>

          <h2>7. Compatibility scores</h2>
          <p>
            Scores are produced by fixed rules from the answers people give, with no AI. They are a guide for conversation. A score is not a prediction of harmony and not a safety rating.
          </p>

          <h2>8. Moderation, suspension and appeals</h2>
          <p>
            Anyone can block or report a profile, listing or message. Moderators can remove listings and suspend accounts that break these terms or the community guidelines, and every moderator action is logged. If your account is suspended you can appeal from <Link href="/app/settings/data">Settings → Data &amp; support</Link>.
          </p>

          <h2>9. Leaving</h2>
          <p>
            You can close your account at any time from <Link href="/app/settings/data">Settings → Data &amp; support</Link>. Closing immediately hides your profile and removes your listings. How we handle personal data is described in the <Link href="/privacy">privacy draft</Link>.
          </p>

          <h2>10. Still to be written</h2>
          <p>
            This draft does not yet include wording on governing law, dispute resolution or limits of liability. Those sections need legal review before public launch.
          </p>

          <h2>11. Contact and grievances</h2>
          <p>
            If you are signed in, contact us from <Link href="/app/settings/data">Settings → Data &amp; support</Link>. A named grievance contact will be published here before public launch.
          </p>
        </div>
      </section>
    </>
  );
}
