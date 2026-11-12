import Link from 'next/link';

export const metadata = {
  title: 'Community guidelines',
  description: 'A plain-language draft of what is expected of everyone on Find a Flatmate: honesty, respect, no brokers posing as occupants and no requests for advance payment.',
};

export default function CommunityGuidelinesPage() {
  return (
    <>
      <div className="narrow page-head">
        <p className="eyebrow">Community guidelines</p>
        <h1>How we treat each other here</h1>
        <p className="lede">Sharing a home starts with trust. These are the standards everyone on Find a Flatmate agrees to keep.</p>
        <p className="note warn">
          This is a plain-language draft pending legal review. It may change before public launch.
        </p>
        <p className="muted small">Last updated: November 2026</p>
      </div>

      <section className="section">
        <div className="narrow prose">
          <h2>Be honest</h2>
          <ul>
            <li><strong>About yourself.</strong> Answer the lifestyle questions as you actually live. If you would rather not answer, skip the question.</li>
            <li><strong>About the room.</strong> State every cost, use real and current photos of the room, and describe it as it is.</li>
            <li><strong>About who you are to the room.</strong> List only if you are the occupant or owner and have permission. Brokers posing as occupants are not allowed.</li>
          </ul>

          <h2>Keep listings real</h2>
          <ul>
            <li>No fake listings.</li>
            <li>No duplicates of the same room.</li>
            <li>No stale listings. If the room is taken, do not keep it listed. Listings expire after 21 days unless you reconfirm that the room is available.</li>
          </ul>

          <h2>Be respectful</h2>
          <ul>
            <li>No harassment, hate or discrimination, in profiles, listings, messages or visits.</li>
            <li><strong>Respect a “no”.</strong> Nobody owes you a reply, a visit or a reason. If someone declines, leave it there.</li>
            <li>Stating your own household habits, such as a vegetarian kitchen or no smoking indoors, is what the questionnaire is for. Demeaning people is not.</li>
          </ul>

          <h2>Keep money and private details out of it</h2>
          <ul>
            <li><strong>No asking for advance payment.</strong> That includes a “token” or deposit to hold a room before a visit.</li>
            <li>Do not ask anyone for OTPs, Aadhaar or bank details.</li>
            <li>Do not share other people’s private details. An address shared with you for a visit is for that visit only.</li>
            <li>Do not pressure anyone to move the conversation off the platform.</li>
          </ul>

          <h2>Adults only</h2>
          <p>Find a Flatmate is for people aged 18 and over.</p>

          <h2>If someone breaks these guidelines</h2>
          <p>
            Block them, which cuts chat and visibility both ways immediately, and report the profile, listing or message. Reports go to moderators, who can remove listings and suspend accounts. Every moderator action is logged.
          </p>
          <p>
            Moderators cannot browse chats. They can read only a specific reported message, and must record a written justification to do so.
          </p>
          <p>
            If your own account is suspended and you believe that is a mistake, you can appeal from <Link href="/app/settings/data">Settings → Data &amp; support</Link>.
          </p>

          <p className="note">
            Before you visit or pay anyone, read our <Link href="/safety">safety advice</Link>. These guidelines sit alongside the <Link href="/terms">terms</Link> and the <Link href="/privacy">privacy draft</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
