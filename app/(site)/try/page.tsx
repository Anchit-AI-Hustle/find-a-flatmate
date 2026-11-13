import Link from 'next/link';
import { Fit } from '@/components/fit';
import { Art } from '@/components/site';
import { cities } from '@/lib/catalog';
import { demoResults } from '@/lib/demo';

export const metadata = { title: 'Try matching', robots: { index: false } };

export default async function TryMatching({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const city = (await searchParams).city === 'noida' ? 'noida' : 'gurugram';
  const { people, rooms } = demoResults(city);
  return (
    <section className="wrap stack" style={{ paddingBlock: '2.5rem 4rem' }}>
      <div className="page-title"><h1>Try matching</h1></div>
      <p className="note warn">Practice with fictional people and rooms. These examples use the real matching rules and stay out of live search, chat and inventory counts.</p>
      <nav className="segmented" aria-label="Practice city">
        {Object.entries(cities).map(([id,c]) => <Link key={id} href={'/try?city='+id} aria-current={city===id?'true':undefined}>{c.name}</Link>)}
      </nav>
      <p className="muted">The sample seeker prefers quiet evenings and a tidy home, has a monthly budget of ₹12,000–₹24,000 and wants a six-month stay.</p>
      <h2>Sample flatmates</h2>
      <div className="grid two">{people.map(p => <article key={p.title} className="card stack"><span className="tag">Sample profile</span><h3>{p.title}</h3><p>{p.blurb}</p><Fit result={p.fit}/></article>)}</div>
      <h2>Sample rooms</h2>
      <div className="grid two">{rooms.map(r => <article key={r.title} className="card stack"><span className="tag">Sample room</span><h3>{r.title}</h3><p>{r.blurb}</p><Fit result={r.fit}/></article>)}</div>
      <Art name="together" alt="" width={640} height={400} />
      <Link className="btn primary" href="/app/discover">Search live rooms and people</Link>
    </section>
  );
}
