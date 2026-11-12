import { Art, Brand } from '@/components/site';

export const metadata = { title: 'You’re offline', robots: { index: false } };
export default function Offline() {
  return (
    <>
      <header className="site-head"><div className="wrap"><Brand /></div></header>
      <main id="main" className="narrow section">
        <div className="card empty">
          <Art name="together" width={960} height={720} />
          <h1>You’re offline</h1>
          <p className="muted">We couldn’t reach Find a Flatmate. Check your connection and try again. Nothing you’ve saved is lost, and your private pages are never stored on this device.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is intended: it retries the network */}
          <a className="btn primary" href="/">Try again</a>
        </div>
      </main>
    </>
  );
}
