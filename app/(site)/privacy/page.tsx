import Link from 'next/link';

export const metadata = {
  title: 'Privacy',
  description: 'A plain-language draft of how Find a Flatmate collects, uses, stores and shares personal data, and the choices you have. Pending legal review.',
};

const collected = [
  ['Email address', 'To send your sign-in link.', 'Never shown to other members.'],
  ['Profile details you give, such as intent, city, localities, budget, move-in window and length of stay', 'To show you relevant rooms and people, and to run the hard checks in matching.', 'Other members, as part of your profile and match results.'],
  ['Lifestyle answers you choose to give', 'To work out compatibility and explain it.', 'Other members see how your answers compare with theirs: reasons, possible friction and missing answers.'],
  ['Listing details: itemised costs, locality and up to 6 photos', 'To publish your room once a moderator has reviewed it.', 'Anyone viewing the listing. Only the locality is public, and photo metadata such as location is stripped on upload.'],
  ['The exact address of a room', 'So that a host can share it for a confirmed visit.', 'Only the other person in that visit, from 24 hours before until 2 hours after it. The host can withdraw it.'],
  ['Messages and visit proposals', 'To let two people who have both expressed interest talk and plan a visit.', 'The two people in the conversation. A moderator can read only a specific reported message, with a logged written justification.'],
  ['Blocks and reports', 'To cut contact when you block someone and to let moderators act on reports.', 'Moderators. Moderator actions are logged.'],
  ['Product analytics, only if you opt in: event name, city and intent', 'To understand which parts of the product are used.', 'Us only. No precise location is recorded and nothing is sent to third-party analytics.'],
] as const;

export default function PrivacyPage() {
  return (
    <>
      <div className="narrow page-head">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy policy</h1>
        <p className="lede">What we collect, why, who can see it and what you can do about it, written to be read.</p>
        <p className="note warn">
          This is a plain-language draft pending legal review. It describes how the service works today and is not yet a final legal document.
        </p>
        <p className="muted small">Last updated: November 2026</p>
      </div>

      <section className="section">
        <div className="narrow prose">
          <h2>The short version</h2>
          <ul>
            <li>You sign in with an email magic link. There is no phone verification and no ID check, and we do not collect government ID.</li>
            <li>We never ask for your salary, religion, caste, politics, sexuality, health or ID numbers.</li>
            <li>Phone numbers and email addresses are never shown to other members, and a listing shows only its locality.</li>
            <li>We run no advertising trackers and no third-party analytics.</li>
            <li>You can download your data or close your account yourself.</li>
          </ul>

          <h2>What we collect and who sees it</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th scope="col">What</th><th scope="col">Why</th><th scope="col">Who can see it</th></tr>
              </thead>
              <tbody>
                {collected.map(([what, why, who]) => (
                  <tr key={what}><th scope="row">{what}</th><td>{why}</td><td>{who}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Lifestyle questions can be skipped. Skipping lowers the confidence shown with a match; it never raises a score.</p>

          <h2>How we use it</h2>
          <ul>
            <li>To run the service: matching, listings, chat, visits, moderation and safety.</li>
            <li>Compatibility is worked out by fixed rules, with no AI. See <Link href="/how-it-works">how it works</Link>.</li>
            <li>Messages are checked against simple keyword rules, not AI, so that mentions of advance payments, UPI, OTPs, Aadhaar or moving to WhatsApp can carry a warning for the person receiving them.</li>
            <li>Product analytics are off unless you opt in. We do not use your data for advertising.</li>
          </ul>

          <h2>Where it is stored</h2>
          <p>
            Data is stored with Supabase, in a Postgres database, and the service is hosted on Vercel. These providers process data on our behalf so that the service can run. A sign-in cookie keeps you logged in; we set no advertising cookies.
          </p>

          <h2>Your choices</h2>
          <p>From <Link href="/app/settings/data">Settings → Data &amp; support</Link> you can:</p>
          <ul>
            <li>download your data or request an export;</li>
            <li>close your account, which immediately hides your profile and removes your listings;</li>
            <li>appeal a suspension.</li>
          </ul>
          <p>You can also block anyone, which cuts chat and visibility both ways straight away. Retention periods are not yet set out in this draft.</p>

          <h2>Adults only</h2>
          <p>Find a Flatmate is for people aged 18 and over. It is not intended for children.</p>

          <h2>The law we are working to</h2>
          <p>
            The service is being designed with India’s Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 in mind. This text has not yet had legal review, and we make no claim of compliance or certification.
          </p>

          <h2>Contact and grievances</h2>
          <p>
            If you are signed in, raise a privacy question or complaint from <Link href="/app/settings/data">Settings → Data &amp; support</Link>. A named grievance contact will be published here before public launch.
          </p>
          <p className="muted">
            Related: <Link href="/terms">Terms</Link>, <Link href="/community-guidelines">Community guidelines</Link> and <Link href="/safety">Safety</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
