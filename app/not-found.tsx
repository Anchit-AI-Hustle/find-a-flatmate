import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap center">
      <h1>Page not found</h1>
      <p className="lede">This page isn’t available yet.</p>
      <Link className="button" href="/">Back to home</Link>
    </main>
  );
}
