import Link from 'next/link';
import { Art } from '@/components/site';

export const metadata = {
  title: 'About',
  description: 'Find a Flatmate is an India-first flatmate and room matching web app, starting in Gurugram and Noida, built around fit, clear costs and safer first contact.',
};

export default function AboutPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">About</p>
        <h1>A calmer way to share a home</h1>
        <p className="lede">
          Find a Flatmate is a flatmate and room matching web app for adults in India, starting in Gurugram and Noida. Our aim fits in one line: find someone you can actually live with.
        </p>
      </div>

      <section className="section">
        <div className="wrap split">
          <div className="prose">
            <h2>Why we are building this</h2>
            <p>
              A room is easy to describe. Living with someone is not. Sleep, noise, guests, the kitchen, who pays for the AC: these everyday things decide whether a shared home works, and too often they are discovered only after moving in.
            </p>
            <p>
              So we put them first. You say how you live and what you want in a home, the app shows where two people line up and where they may not, and the full cost is on the table before anyone visits.
            </p>
            <p>
              The path we support is simple: discover, understand the fit, connect safely, schedule a visit, clarify costs and expectations, decide, move in. <Link href="/how-it-works">See how each step works</Link>.
            </p>
          </div>
          <Art name="together" width={960} height={720} alt="" tilt />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>What we hold ourselves to</h2>
          <div className="grid three">
            <div className="card">
              <h3>Fit before photos</h3>
              <p className="muted">Matching follows fixed rules you can read, with no AI. Every score comes with its reasons, possible friction, missing answers and a confidence level.</p>
            </div>
            <div className="card">
              <h3>Costs in full</h3>
              <p className="muted">Monthly total and move-in cash are shown separately in rupees. A refundable deposit is never counted as monthly cost, and an unknown is shown as unknown.</p>
            </div>
            <div className="card">
              <h3>Contact by consent</h3>
              <p className="muted">Chat opens only when both people are interested. Phone numbers, email addresses and exact addresses stay private by default.</p>
            </div>
            <div className="card">
              <h3>Honest labels</h3>
              <p className="muted">The only verification we have is “email verified”, and we say so. We do not claim to check identity or backgrounds, and no label here is a safety guarantee.</p>
            </div>
            <div className="card">
              <h3>Only what we need</h3>
              <p className="muted">We never ask for salary, religion, caste, politics, sexuality, health or ID numbers. We run no advertising trackers and no third-party analytics.</p>
            </div>
            <div className="card">
              <h3>No money through us</h3>
              <p className="muted">We do not handle payments, escrow, deposits or brokerage. The service is free during the MVP. See <Link href="/pricing">pricing</Link>.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap split flip">
          <div className="prose">
            <h2>Where we are starting</h2>
            <p>We are opening in four localities, so that a search returns real homes and not empty pages.</p>
            <ul>
              <li><Link href="/city/gurugram">Gurugram</Link>: DLF Phase 3 and Sector 56</li>
              <li><Link href="/city/noida">Noida</Link>: Sector 62 and Sector 137</li>
            </ul>
            <p>We will add more localities only when there is real inventory in them.</p>
            <h3>Who it is for</h3>
            <p>
              Adults aged 18 and over who are looking for a room or have a room to fill. If you want to find a home together with others, group search is coming later, and you can join a city waitlist in the meantime.
            </p>
            <h3>What we are not</h3>
            <p>
              We are not a broker, a landlord or a payments service, and we do not inspect flats. Please read our <Link href="/safety">safety advice</Link> before you visit or pay anyone.
            </p>
          </div>
          <Art name="kitchen" width={960} height={720} alt="" />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="band">
            <h2>Come and see if it fits</h2>
            <p>Tell us what you are looking for and how you like to live. You can skip any lifestyle question. Already have an account? <Link href="/login">Sign in</Link>.</p>
            <div className="row">
              <Link className="btn primary" href="/onboarding/intent">Get started</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
