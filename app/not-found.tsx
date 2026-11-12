import Link from 'next/link';
import { Art, Brand } from '@/components/site';

export default function NotFound() {
  return (
    <>
      <header className="site-head"><div className="wrap"><Brand /></div></header>
      <main id="main" className="narrow section">
        <div className="card empty">
          <Art name="together" width={960} height={720} />
          <h1>We can’t find that page</h1>
          <p className="muted">It may have moved, expired or never existed. Listings disappear once they’re filled or no longer confirmed as available.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn primary" href="/">Back to home</Link>
            <Link className="btn" href="/app">Open the app</Link>
          </div>
        </div>
      </main>
    </>
  );
}
