import Link from 'next/link';
import { CalendarCheck, HandCoins, Home, MessagesSquare, Search, ShieldCheck, Users } from 'lucide-react';
import { Art } from '@/components/site';
import { Receipt } from '@/components/costs';
import { cities, intents } from '@/lib/catalog';
import { inventory } from '@/lib/db';
import { selectIntent } from '@/lib/actions';

export const revalidate = 300;

const intentCards = [
  { id: 'looking_for_room', icon: Search, sub: 'See rooms and people that fit your budget, dates and habits.' },
  { id: 'have_room', icon: Home, sub: 'List a real vacancy with full costs and house rules.' },
  { id: 'find_together', icon: Users, sub: 'Meet people to rent with. Group tools are coming later.' },
] as const;

export default async function Landing() {
  const live = await inventory();
  const total = live ? Object.values(live).reduce((a, b) => a + b, 0) : null;
  return (
    <>
      <section className="wrap hero">
        <div>
          <p className="eyebrow">Now opening in Gurugram and Noida</p>
          <h1>Find someone you can actually <span className="squiggle">live with</span>.</h1>
          <p className="lede">Compare how you live, see the full monthly cost, chat only when you both say yes, and plan a visit without sharing your number.</p>
          <div className="intent-cards" role="group" aria-label="What are you looking for?">
            {intentCards.map(({ id, icon: Icon, sub }) => (
              <form key={id} action={selectIntent.bind(null, id)}>
                <button className="intent-card">
                  <span className="ico"><Icon size={22} aria-hidden="true" /></span>
                  <span><strong>{intents[id]}</strong><span className="sub">{sub}</span></span>
                </button>
              </form>
            ))}
          </div>
          <p className="small muted" data-testid="inventory">
            {total === null ? 'Listings open here soon. Sign-in is being set up.'
              : total === 0 ? 'We’re just opening: no rooms are live yet. List yours, or join and we’ll show you rooms as they are approved.'
              : `${total} moderator-reviewed room${total === 1 ? '' : 's'} live right now.`}
          </p>
        </div>
        <Art name="hero" width={1248} height={832} tilt priority alt="Illustration of two flatmates: one pours chai on the sofa while the other carries in a moving box." />
      </section>

      <section className="wrap section">
        <p className="eyebrow">How it works</p>
        <h2>The whole journey, not just a swipe</h2>
        <ol className="steps">
          <li><h3>Understand the fit</h3><p className="muted">Answer 14 quick questions about sleep, food, guests, chores and more. See where you agree and where you differ.</p></li>
          <li><h3>See the real cost</h3><p className="muted">Rent, maintenance, utilities, deposit and brokerage are listed separately, so the headline rent hides nothing.</p></li>
          <li><h3>Connect safely</h3><p className="muted">Chat opens only after you both show interest. Your phone number and email stay private.</p></li>
          <li><h3>Plan the visit</h3><p className="muted">Agree a time in the app. The exact address is shared only for a confirmed visit.</p></li>
        </ol>
        <p style={{ marginTop: 16 }}><Link href="/how-it-works">Read how it works in detail</Link></p>
      </section>

      <section className="wrap section split">
        <Art name="kitchen" width={960} height={720} alt="Illustration of two flatmates cooking together in a small kitchen." />
        <div>
          <p className="eyebrow">Compatibility you can read</p>
          <h2>Reasons, not just a number</h2>
          <p className="muted">Price and location are the easy part. Most flat-shares go wrong over sleep, food, cleanliness, guests and bills. We compare what each of you does with what the other needs, and we treat dealbreakers as dealbreakers.</p>
          <ul className="fit" style={{ listStyle: 'none', padding: 0 }}>
            <li className="card flat"><strong>What you’ll see on every match</strong>
              <ul>
                <li className="good"><ShieldCheck size={16} aria-hidden="true" /><span>What you agree on, in plain words</span></li>
                <li className="diff"><MessagesSquare size={16} aria-hidden="true" /><span>Differences worth talking about before you visit</span></li>
                <li className="miss"><CalendarCheck size={16} aria-hidden="true" /><span>Anything one of you hasn’t answered yet — never guessed</span></li>
              </ul>
            </li>
          </ul>
          <p className="small muted">The score comes from fixed, published rules. It is not AI, and it is not a safety rating.</p>
        </div>
      </section>

      <section className="wrap section split flip">
        <Art name="costs" width={760} height={779} alt="Illustration of two hands going over a rent bill beside house keys and a calculator." />
        <div>
          <p className="eyebrow">Honest costs</p>
          <h2>Know the monthly total and the move-in cash</h2>
          <p className="muted">Every listing shows what you pay each month and what you need on day one, separately. Unknown utilities are shown as unknown, never as zero.</p>
          <p className="chip plain"><HandCoins size={14} aria-hidden="true" /> Example layout — not a real listing</p>
          <Receipt costs={{ rent: 1_550_000, maintenance: 200_000, utilities: null, recurring: 0, deposit: 3_100_000, brokerage: 0, fees: 0 }} />
        </div>
      </section>

      <section className="wrap section">
        <div className="band split">
          <div>
            <h2>Built for strangers meeting about a home</h2>
            <p>Listings are reviewed by a moderator before they go live and expire unless the poster reconfirms. You can block or report anyone in two taps. We verify email addresses only, and we say so — no badge here is a safety guarantee.</p>
            <p><Link href="/safety">How we handle safety and what you should still check yourself</Link></p>
          </div>
          <Art name="visit" width={960} height={720} alt="Illustration of a host showing a tidy room to a visitor with a backpack." />
        </div>
      </section>

      <section className="wrap section">
        <p className="eyebrow">Where we’re starting</p>
        <h2>A few neighbourhoods, done properly</h2>
        <div className="grid two">
          {Object.entries(cities).map(([id, city]) => (
            <Link key={id} href={`/city/${id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>{city.name}</h3>
              <p className="muted">{Object.values(city.areas).join(' · ')}</p>
              <span className="chip">{live === null ? 'Opening soon' : `${live[id] ?? 0} room${(live[id] ?? 0) === 1 ? '' : 's'} live`}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap section" style={{ textAlign: 'center' }}>
        <h2>Ready when you are</h2>
        <p className="lede" style={{ margin: '0 auto 20px' }}>It’s free. Takes about three minutes to set up.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href="/onboarding/intent">Get started</Link>
          <Link className="btn" href="/how-it-works">See how it works</Link>
        </div>
      </section>
    </>
  );
}
