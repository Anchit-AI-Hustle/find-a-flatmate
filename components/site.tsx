import Link from 'next/link';

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#167C70" />
      <path d="M7 16.5 16 8l9 8.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.5" cy="20" r="2.6" fill="#F08A72" />
      <circle cx="19.5" cy="20" r="2.6" fill="#E6F4ED" />
    </svg>
  );
}
export function Brand({ href = '/' }: { href?: string }) {
  return <Link className="brand" href={href}><Logo />Find a Flatmate</Link>;
}
export function SiteHeader() {
  return (
    <header className="site-head">
      <div className="wrap">
        <Brand />
        <nav className="site-nav" aria-label="Main">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Safety</Link>
          <Link href="/city/gurugram">Gurugram</Link>
          <Link href="/city/noida">Noida</Link>
          <Link href="/help">Help</Link>
        </nav>
        <Link className="btn small" href="/login">Sign in</Link>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <nav aria-label="Footer">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Safety</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/help">Help</Link>
          <Link href="/community-guidelines">Community guidelines</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p>For adults 18+ looking for shared housing in India. We never hold deposits or rent, and no label here is a safety guarantee — always visit and verify before paying anyone.</p>
        <p>© {new Date().getFullYear()} Find a Flatmate</p>
      </div>
    </footer>
  );
}
/** Decorative illustration; all artwork is illustrative and does not depict real members or homes. */
export function Art({ name, alt = '', width, height, tilt, priority, caption }: { name: 'hero' | 'visit' | 'together' | 'kitchen' | 'costs'; alt?: string; width: number; height: number; tilt?: boolean; priority?: boolean; caption?: string }) {
  return (
    <figure className={tilt ? 'art tilt' : 'art'}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised static WebP; avoids the image optimiser cost */}
      <img src={`/art/${name}.webp`} alt={alt} width={width} height={height} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
