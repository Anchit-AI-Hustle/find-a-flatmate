'use client';
import { logout } from '@/lib/actions';
import { clearPracticeChats } from './sample-store';

/** Signs out, and first forgets the practice chats kept in this browser so they do not outlive the session. */
export function SignOut({ className = 'btn' }: { className?: string }) {
  return <form action={logout} onSubmit={clearPracticeChats}><button className={className}>Sign out</button></form>;
}
