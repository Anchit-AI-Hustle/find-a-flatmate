'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { parseSampleIds, storeSampleIds } from '@/lib/samples';

/**
 * Practice state for the built-in sample cards. Nothing here reaches the server as data: the two cookies are read by
 * signed-in pages only to decide which labelled samples to draw, and practice messages stay in this browser's storage.
 *
 * Each store is the single source of truth and every write starts from what is stored now, so a second tab or a page
 * restored with the Back button cannot revive old state or drop newer state.
 */
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
};
const announce = () => listeners.forEach(listener => listener());

function cookieStore(name: string) {
  const raw = () => document.cookie.split('; ').find(c => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
  return {
    raw,
    write(change: (now: string[]) => string[]) {
      document.cookie = `${name}=${storeSampleIds(change(parseSampleIds(raw())))}; path=/app; max-age=15552000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
      announce();
    },
  };
}
/** Samples already swiped (liked or passed): they stay out of the deck. */
export const seenSamples = cookieStore('ff_samples_seen');
/** Samples the member liked: their practice matches, shown in Matches and Chats. */
export const likedSamples = cookieStore('ff_samples_liked');

/** Live list of sample ids from one of the stores; `initial` is what the server read from the same cookie. */
export function useSampleIds(store: { raw: () => string }, initial: string[]) {
  const raw = useSyncExternalStore(subscribe, store.raw, () => storeSampleIds(initial));
  return useMemo(() => parseSampleIds(raw), [raw]);
}

export type PracticeMessage = { mine: boolean; body: string; at: string };
const chatKey = (member: string) => `ff_sample_chat_${member}`;
const readChats = (member: string): Record<string, PracticeMessage[]> => {
  try { return JSON.parse(localStorage.getItem(chatKey(member)) ?? '{}') as Record<string, PracticeMessage[]>; } catch { return {}; }
};
/** Practice chat messages, kept per member in this browser only. */
export const practiceChat = {
  raw: (member: string) => { try { return localStorage.getItem(chatKey(member)) ?? '{}'; } catch { return '{}'; } },
  add(member: string, sample: string, message: PracticeMessage) {
    const all = readChats(member);
    all[sample] = [...(all[sample] ?? []), message].slice(-60);
    try { localStorage.setItem(chatKey(member), JSON.stringify(all)); } catch { /* storage is full or blocked: the chat just does not persist */ }
    announce();
  },
  remove(member: string, sample: string) {
    const all = readChats(member);
    delete all[sample];
    try { localStorage.setItem(chatKey(member), JSON.stringify(all)); } catch { /* nothing to remove */ }
    announce();
  },
};
export function usePracticeChat(member: string, sample: string): PracticeMessage[] {
  const raw = useSyncExternalStore(subscribe, () => practiceChat.raw(member), () => '{}');
  return useMemo(() => {
    try { const list = (JSON.parse(raw) as Record<string, PracticeMessage[]>)[sample]; return Array.isArray(list) ? list : []; } catch { return []; }
  }, [raw, sample]);
}
