import { Home, Search, Users } from 'lucide-react';
import { intents } from '@/lib/catalog';
import { selectIntent } from '@/lib/actions';

export const metadata = { title: 'What brings you here?', robots: { index: false } };
const cards = [
  { id: 'looking_for_room', icon: Search, sub: 'I need a room in a shared flat.' },
  { id: 'have_room', icon: Home, sub: 'There’s a vacancy in my flat or property.' },
  { id: 'find_together', icon: Users, sub: 'I’d like to team up and rent a place.' },
] as const;
export default function Intent() {
  return (
    <div className="stack">
      <ol className="stepper" aria-label="Step 1 of 4"><li className="done" /><li /><li /><li /></ol>
      <h1>What brings you here?</h1>
      <p className="lede">Pick one to start. You can change it any time from your profile.</p>
      <div className="intent-cards">
        {cards.map(({ id, icon: Icon, sub }) => (
          <form key={id} action={selectIntent.bind(null, id)}>
            <button className="intent-card">
              <span className="ico"><Icon size={22} aria-hidden="true" /></span>
              <span><strong>{intents[id]}</strong><span className="sub">{sub}</span></span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
