import Link from 'next/link';
import { Ban, CalendarCheck, ClipboardCheck, EyeOff, MapPin, MessageCircle, TriangleAlert } from 'lucide-react';
import { Art } from '@/components/site';

export const metadata = {
  title: 'Safety',
  description: 'What Find a Flatmate does to reduce risk, what it does not check, and the steps to take yourself before you visit a flat or pay anyone.',
};

const builtIn = [
  { Icon: MapPin, title: 'Locality only', text: 'Listings show the locality, never the exact address. Location data is stripped from photos when they are uploaded.' },
  { Icon: MessageCircle, title: 'Chat needs two yeses', text: 'A conversation opens only after both people express interest. Phone numbers and email addresses are never shown.' },
  { Icon: TriangleAlert, title: 'Warnings on risky messages', text: 'Messages that mention advance payments, UPI, OTPs, Aadhaar or moving to WhatsApp are flagged with a warning to the person receiving them. These are simple keyword rules, not AI.' },
  { Icon: CalendarCheck, title: 'Address shared late, and briefly', text: 'After a visit is confirmed, the host may share the exact address. Only the other person can see it, from 24 hours before the visit until 2 hours after, and the host can withdraw it.' },
  { Icon: ClipboardCheck, title: 'Listings are reviewed', text: 'A moderator reviews every listing before it goes live. Posters attest that they are the occupant or owner and have permission to list. Listings expire after 21 days unless reconfirmed.' },
  { Icon: Ban, title: 'Block and report', text: 'Blocking cuts chat and visibility both ways, immediately. You can report any profile, listing or message to our moderators.' },
] as const;

export default function SafetyPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Safety</p>
        <h1>Visit, verify, then decide</h1>
        <p className="lede">
          We have built Find a Flatmate to slow down the moments where people get hurt or cheated. No app can make a stranger safe, so this page is honest about what we do, what we do not do, and what only you can check.
        </p>
      </div>

      <section className="section">
        <div className="wrap split">
          <div className="prose">
            <div className="note warn">
              <p><strong>What “email verified” means.</strong> It means the person signed in through a link sent to their email address, and nothing more. We do not verify phone numbers, check identity documents or run background checks, and we do not collect government ID. A compatibility score is not a safety rating.</p>
            </div>
            <h2>Before you pay anything</h2>
            <ul>
              <li><strong>See the flat in person first.</strong> Never pay a “token” or advance to hold a room you have not seen.</li>
              <li><strong>Meet in daylight and tell a friend</strong> where you are going and when you expect to be back.</li>
              <li><strong>Check the poster’s right to let the room.</strong> Ask to see the rent agreement or the owner’s consent.</li>
              <li><strong>Read the paperwork</strong> before you sign or transfer money, including what happens to the deposit when you leave.</li>
              <li><strong>Never share OTPs, Aadhaar or bank details</strong> with anyone you meet here.</li>
              <li><strong>Report pressure.</strong> If someone pushes you to pay quickly or to move the conversation off the platform, report them.</li>
            </ul>
            <p className="muted">We never hold rent, deposits or brokerage. Any payment you make is directly between you and the other person, so make it only when you are satisfied.</p>
          </div>
          <Art name="visit" width={960} height={720} alt="" />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>What the app does for you</h2>
          <div className="grid three">
            {builtIn.map(({ Icon, title, text }) => (
              <div className="card" key={title}>
                <h3><Icon aria-hidden="true" size={18} /> {title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split flip">
          <div className="prose">
            <h2>When you report something</h2>
            <p>Reports go to our moderators. They can remove listings and suspend accounts, and every moderator action is logged.</p>
            <p>
              <EyeOff aria-hidden="true" size={18} /> Moderators cannot browse your chats. They can read only a specific message that has been reported, and only after writing a justification that is itself logged.
            </p>
            <p>If your account is suspended and you think that is wrong, you can appeal from <Link href="/app/settings/data">Settings → Data &amp; support</Link>.</p>
            <h3>What we do not do</h3>
            <ul>
              <li>We do not check identity, phone numbers, ownership documents or backgrounds.</li>
              <li>We do not inspect flats or attend visits.</li>
              <li>We do not handle payments, escrow, deposits or brokerage.</li>
            </ul>
          </div>
          <Art name="kitchen" width={960} height={720} alt="" />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="band">
            <h2>If something feels off, stop</h2>
            <p>You never owe anyone a visit, a reply or a payment. Block, report, and walk away. Our <Link href="/community-guidelines">community guidelines</Link> set out what is not allowed, and <Link href="/help">Help</Link> answers common questions.</p>
            <p className="small">If you are in immediate danger, contact the local emergency services first.</p>
          </div>
        </div>
      </section>
    </>
  );
}
