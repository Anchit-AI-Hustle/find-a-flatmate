import { Home, MessageCircle, ShieldCheck, Users } from 'lucide-react';
import { cities, intents } from '@/lib/catalog';

const features = [
  { icon: Users, title: 'Lifestyle matching', body: 'Compare sleep, cleanliness, cooking, guests and 10 more habits before you meet.' },
  { icon: Home, title: 'Full cost upfront', body: 'Rent, maintenance, utilities, deposit and brokerage shown together, in rupees.' },
  { icon: MessageCircle, title: 'Mutual opt-in chat', body: 'Conversations open only when both people say yes. Your number stays private.' },
  { icon: ShieldCheck, title: 'Reviewed listings', body: 'Listings are moderated, photo metadata is stripped and anyone can be reported or blocked.' },
];

export default function Page() {
  return (
    <main className="wrap">
      <header className="top">
        <span className="brand"><span className="logo" aria-hidden="true">F</span>Find a Flatmate</span>
      </header>
      <section className="hero">
        <p className="eyebrow">Launching in {Object.values(cities).map(c => c.name).join(' & ')}</p>
        <h1>Find people you’ll actually enjoy living with.</h1>
        <p className="lede">Flatmate and room matching built for India — compatibility first, honest costs, and privacy by default.</p>
        <ul className="intents" aria-label="Ways to use Find a Flatmate">
          {Object.values(intents).map(label => <li key={label}>{label}</li>)}
        </ul>
      </section>
      <section className="grid" aria-label="Features">
        {features.map(({ icon: Icon, title, body }) => (
          <article key={title} className="card">
            <Icon aria-hidden="true" size={22} />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <footer className="foot">© {new Date().getFullYear()} Find a Flatmate · For adults 18+ seeking shared housing.</footer>
    </main>
  );
}
