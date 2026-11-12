'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Polls for new messages while the tab is visible and keeps the newest message in view. */
export function ChatLive({ count }: { count: number }) {
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tick = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) router.refresh(); }, 7000);
    return () => clearInterval(tick);
  }, [router]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count]);
  return <div ref={end} />;
}
