import Link from 'next/link';
import { DoorOpen, KeyRound, Users } from 'lucide-react';
import { Art } from '@/components/site';

export const metadata = {
  title: 'How it works',
  description: 'From first look to move-in: compare lifestyles, see the full monthly cost, chat only after you both opt in, and plan a visit before you decide.',
};

const weights = [
  ['Lifestyle', '40', 'Everyday living, such as sleep, noise, cleanliness, cooking, guests and smoking: what each person wants in a home against what the other actually does.'],
  ['Budget', '20', 'Whether a room’s monthly cost fits your budget or, between two people, whether your budget ranges overlap.'],
  ['Locality', '15', 'Whether your preferred localities overlap.'],
  ['Move-in dates and stay length', '15', 'Whether your move-in windows overlap and your intended lengths of stay line up.'],
  ['Household logistics', '10', 'Chores, shared expenses, and AC and utilities.'],
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">How it works</p>
        <h1>Find someone you can actually live with</h1>
        <p className="lede">
          Find a Flatmate helps adults in Gurugram and Noida work out whether a home and the people in it are a good fit, before anyone pays anything. Here is the whole path, step by step.
        </p>
        <div className="row">
          <Link className="btn primary" href="/onboarding/intent">Get started</Link>
          <Link className="btn" href="/login">Sign in</Link>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2>Start with what you need</h2>
            <p className="muted">You pick one of three starting points. Each asks only for what it needs.</p>
            <div className="stack">
              <div className="card">
                <h3><DoorOpen aria-hidden="true" size={18} /> I’m looking for a room</h3>
                <p className="muted">Set your city, localities, budget and move-in window, then browse rooms and the people who live there.</p>
              </div>
              <div className="card">
                <h3><KeyRound aria-hidden="true" size={18} /> I have a room to fill</h3>
                <p className="muted">List the room with an itemised cost breakdown and up to 6 photos. A moderator reviews every listing before it goes live.</p>
              </div>
              <div className="card">
                <h3><Users aria-hidden="true" size={18} /> I want to find a home together</h3>
                <p className="muted">Group search is coming later. For now you can join the waitlist for your city.</p>
              </div>
            </div>
          </div>
          <Art name="visit" width={960} height={720} alt="" tilt />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Seven steps, at your pace</h2>
          <ol className="steps">
            <li>
              <h3>Discover</h3>
              <p className="muted">Browse rooms and people in DLF Phase 3 and Sector 56 in Gurugram, and Sector 62 and Sector 137 in Noida. Only the locality is public, never the exact address.</p>
            </li>
            <li>
              <h3>Understand the fit</h3>
              <p className="muted">Every result shows a compatibility score with the reasons behind it, possible friction, missing answers and a confidence level.</p>
            </li>
            <li>
              <h3>Connect safely</h3>
              <p className="muted">Chat opens only after you both express interest. Phone numbers and email addresses are never shown.</p>
            </li>
            <li>
              <h3>Schedule a visit</h3>
              <p className="muted">Either of you proposes a time; the other confirms, declines or suggests another. After a visit is confirmed, the host may share the exact address for a limited window.</p>
            </li>
            <li>
              <h3>Clarify costs and expectations</h3>
              <p className="muted">Go through the monthly total, the move-in cash and the house habits that matter to each of you.</p>
            </li>
            <li>
              <h3>Decide</h3>
              <p className="muted">Take your time. Either of you can say no, and a “no” needs no explanation.</p>
            </li>
            <li>
              <h3>Move in</h3>
              <p className="muted">Rent, deposit and paperwork are settled directly between you, outside the app. We never handle money.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="narrow prose">
          <h2>How compatibility is worked out</h2>
          <p>
            The lifestyle questionnaire covers 14 topics, from sleep rhythm and cleanliness to guests, shared kitchen and AC use. For each one you say what you do, what you want in a home, and whether that is flexible, a preference or a dealbreaker. You can skip any question.
          </p>
          <p>
            Matching uses fixed rules, set out below. There is no AI involved. Hard checks come first: same city, overlapping locality, overlapping move-in window, budget and dealbreakers. Pairs that pass get a score out of 100.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th scope="col">Part</th><th scope="col">Points</th><th scope="col">What it looks at</th></tr>
              </thead>
              <tbody>
                {weights.map(([part, points, detail]) => (
                  <tr key={part}><th scope="row">{part}</th><td>{points}</td><td>{detail}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Skipped answers lower the confidence level (low, medium or high). They never raise a score. A score is a guide to conversation, not a prediction of harmony and not a safety rating.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split flip">
          <div className="prose">
            <h2>The full cost, in rupees, before you visit</h2>
            <p>Every listing itemises what you would actually pay.</p>
            <ul>
              <li><strong>Each month:</strong> rent, maintenance, estimated utilities and any other recurring charges.</li>
              <li><strong>Once, at move-in:</strong> deposit, brokerage and move-in fees.</li>
            </ul>
            <p>
              The monthly total and the move-in cash are shown separately, and a refundable deposit is never counted as a monthly cost. If utilities are not known, the listing says “unknown” rather than showing ₹0.
            </p>
            <p>Listings expire after 21 days unless the poster reconfirms that the room is still available.</p>
          </div>
          <Art name="costs" width={760} height={779} alt="" />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="band">
            <h2>Ready when you are</h2>
            <p>Finding, matching, chatting and listing are free during the MVP. Read our <Link href="/safety">safety advice</Link> before your first visit, or see <Link href="/help">common questions</Link>.</p>
            <div className="row">
              <Link className="btn primary" href="/onboarding/intent">Get started</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
