'use client';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">We couldn’t load this page. Check your connection and try again. Nothing you saved earlier is lost.</p>
      <button className="btn primary" onClick={reset}>Try again</button>
    </div>
  );
}
