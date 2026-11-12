import Link from 'next/link';
import { CalendarCheck, HandCoins, Heart, Home, MessagesSquare, Search, ShieldCheck, Users } from 'lucide-react';
import { Art } from '@/components/site';
import { cities, intents } from '@/lib/catalog';
import { inventory } from '@/lib/db';
import { selectIntent } from '@/lib/actions';

export const revalidate = 300;

const intentCards = [
  { id: 'looking_for_room', icon: Search },
  { id: 'have_room', icon: Home },
  { id: 'find_together', icon: Users },
] as const;
const steps = [
  { icon: Heart, title: 'Swipe', text: 'Like people and rooms that fit.' },
  { icon: MessagesSquare, title: 'Match', text: 'Chat opens only if you both like.' },
  { icon: CalendarCheck, title: 'Visit', text: 'Pick a time. Address stays private.' },
  { icon: Home, title: 'Move in', text: 'Know the full cost first.' },
];

export default async function Landing() {
  const live = await inventory();
  const total = live ? Object.values(live).reduce((a, b) => a + b, 0) : null;
  return (
    <>
      <section className="wrap hero">
        <div>
          <p className="eyebrow">Gurugram · Noida</p>
          <h1>Find someone you can actually <span className="squiggle">live with</span>.</h1>
          <p className="lede">Flatmates and rooms, matched on how you live.</p>
          <div className="intent-cards" role="group" aria-label="What are you looking for?">
            {intentCards.map(({ id, icon: Icon }) => (
              <form key={id} action={selectIntent.bind(null, id)}>
                <button className="intent-card">
                  <span className="ico"><Icon size={22} aria-hidden="true" /></span>
                  <strong>{intents[id]}</strong>
                </button>
              </form>
            ))}
          </div>
          <p className="small muted" data-testid="inventory">
            {total === null ? 'Listings open here soon. Sign-in is being set up.'
              : total === 0 ? 'Just opening: no rooms are live yet. Be the first.'
              : `${total} reviewed room${total === 1 ? '' : 's'} live now.`}
          </p>
        </div>
        <Art name="hero" width={1248} height={832} tilt priority alt="Illustration of two flatmates: one pours chai on the sofa while the other carries in a moving box." />
      </section>

      <section className="wrap section" aria-label="How it works">
        <ol className="steps icons">
          {steps.map(({ icon: Icon, title, text }) => (
            <li key={title}><Icon size={26} aria-hidden="true" /><h2>{title}</h2><p className="muted">{text}</p></li>
          ))}
        </ol>
      </section>

      <section className="wrap section grid three" aria-label="Why it works">
        <article className="pic-card">
          <Art name="kitchen" width={960} height={720} alt="Illustration of two flatmates cooking together." />
          <h2><Heart size={20} aria-hidden="true" /> Real fit</h2>
          <p className="muted">Sleep, food, guests, chores. See where you agree before you meet.</p>
        </article>
        <article className="pic-card">
          <Art name="costs" width={760} height={779} alt="Illustration of two hands going over a rent bill with keys and a calculator." />
          <h2><HandCoins size={20} aria-hidden="true" /> Full cost</h2>
          <p className="muted">Rent, maintenance, deposit, brokerage. No surprises.</p>
        </article>
        <article className="pic-card">
          <Art name="visit" width={960} height={720} alt="Illustration of a host showing a room to a visitor." />
          <h2><ShieldCheck size={20} aria-hidden="true" /> Safer by design</h2>
          <p className="muted">Reviewed listings. Private number. Block or report in two taps. <Link href="/safety">How</Link></p>
        </article>
      </section>

      <section className="wrap section" style={{ textAlign: 'center' }}>
        <h2>Free. Three minutes to set up.</h2>
        <div className="row" style={{ justifyContent: 'center', marginBottom: 14 }}>
          <Link className="btn primary" href="/onboarding/intent">Get started</Link>
          <Link className="btn" href="/how-it-works">How it works</Link>
        </div>
        <ul className="facts" style={{ justifyContent: 'center' }} aria-label="Cities">
          {Object.entries(cities).map(([id, city]) => (
            <li key={id}><Link className="chip plain" href={`/city/${id}`}>{city.name}{live ? ` · ${live[id] ?? 0}` : ''}</Link></li>
          ))}
        </ul>
      </section>
    </>
  );
}
