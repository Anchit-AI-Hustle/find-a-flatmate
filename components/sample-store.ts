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
const notify = () => listeners.forEach(listener => listener());
// Cookie writes raise no browser event, so other tabs are told over a channel, and every tab re-reads when it regains focus.
let channel: BroadcastChannel | null = null;
const subscribe = (listener: () => void) => {
  if (!listeners.size) {
    if ('BroadcastChannel' in window) { channel = new BroadcastChannel('ff-samples'); channel.onmessage = notify; }
    window.addEventListener('storage', notify);
    window.addEventListener('focus', notify);
    window.addEventListener('pageshow', notify);
    document.addEventListener('visibilitychange', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    channel?.close();
    channel = null;
    window.removeEventListener('storage', notify);
    window.removeEventListener('focus', notify);
    window.removeEventListener('pageshow', notify);
    document.removeEventListener('visibilitychange', notify);
  };
};
const announce = () => { notify(); channel?.postMessage('changed'); };

function cookieStore(name: string) {
  const raw = () => document.cookie.split('; ').find(c => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
  return {
    raw,
    write(member: string, change: (now: string[]) => string[]) {
      document.cookie = `${name}=${storeSampleIds(change(parseSampleIds(raw(), member)), member)}; path=/app; max-age=15552000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
      announce();
    },
  };
}
/** Samples already swiped (liked or passed): they stay out of the deck. */
export const seenSamples = cookieStore('ff_samples_seen');
/** Samples the member liked: their practice matches, shown in Matches and Chats. */
export const likedSamples = cookieStore('ff_samples_liked');

/** Live list of this member's sample ids from one of the stores; `initial` is what the server read from the same cookie. */
export function useSampleIds(store: { raw: () => string }, initial: string[], member: string) {
  const raw = useSyncExternalStore(subscribe, store.raw, () => storeSampleIds(initial, member));
  return useMemo(() => parseSampleIds(raw, member), [raw, member]);
}

export type PracticeMessage = { mine: boolean; body: string; at: string };
const chatKey = (member: string) => `ff_sample_chat_${member}`;
// Used instead of storage when the browser refuses a write, so the chat still works for this visit.
const unsaved = new Map<string, string>();
const isMessage = (m: unknown): m is PracticeMessage => {
  const v = m as PracticeMessage | null;
  return typeof v === 'object' && v !== null && typeof v.mine === 'boolean' && typeof v.body === 'string' && typeof v.at === 'string' && !Number.isNaN(Date.parse(v.at));
};
/** Whatever is in storage is treated as untrusted: anything that is not a well-formed message list is dropped. */
function parseChats(raw: string): Record<string, PracticeMessage[]> {
  try {
    const all = JSON.parse(raw) as unknown;
    if (typeof all !== 'object' || all === null || Array.isArray(all)) return {};
    return Object.fromEntries(Object.entries(all).map(([sample, list]) => [sample, Array.isArray(list) ? list.filter(isMessage) : []]));
  } catch { return {}; }
}
const rawChats = (member: string) => {
  if (unsaved.has(member)) return unsaved.get(member)!;
  try { return localStorage.getItem(chatKey(member)) ?? '{}'; } catch { return '{}'; }
};
function saveChats(member: string, all: Record<string, PracticeMessage[]>) {
  const text = JSON.stringify(all);
  try { localStorage.setItem(chatKey(member), text); unsaved.delete(member); } catch { unsaved.set(member, text); }
  announce();
}
/** Practice chat messages, kept per member in this browser only. */
export const practiceChat = {
  add(member: string, sample: string, message: PracticeMessage) {
    const all = parseChats(rawChats(member));
    all[sample] = [...(all[sample] ?? []), message].slice(-60);
    saveChats(member, all);
  },
  remove(member: string, sample: string) {
    const all = parseChats(rawChats(member));
    delete all[sample];
    saveChats(member, all);
  },
};
export function usePracticeChat(member: string, sample: string): PracticeMessage[] {
  const raw = useSyncExternalStore(subscribe, () => rawChats(member), () => '{}');
  return useMemo(() => parseChats(raw)[sample] ?? [], [raw, sample]);
}
/** Forgets every practice chat stored in this browser (called on sign-out). */
export function clearPracticeChats() {
  unsaved.clear();
  try { for (const key of Object.keys(localStorage)) if (key.startsWith('ff_sample_chat_')) localStorage.removeItem(key); } catch { /* storage is blocked: nothing was stored */ }
}
