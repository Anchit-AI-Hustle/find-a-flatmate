'use client';
import { useState } from 'react';
import { dimensions, titles } from '@/lib/catalog';
import type { Answers, Strength } from '@/lib/matching';

type Key = keyof typeof dimensions;
const keys = Object.keys(dimensions) as Key[];
const emoji: Record<Key, string> = { sleep: '🌙', noise: '🔊', cleanliness: '🧹', cooking: '🍳', kitchen: '🥗', guests: '👋', smoking: '🚭', alcohol: '🍷', pets: '🐾', wfh: '💻', privacy: '🚪', chores: '🧽', expenses: '💸', utilities: '❄️' };
type Pick = { habit: string; strength: Strength };

/**
 * One tap per topic. The chosen option is both "how I live" and "what I'd like"; the checkbox turns it into a dealbreaker.
 * Tap a chosen option again to skip the topic. `mode="home"` words it as house rules for a listing.
 */
export function LifestyleFields({ initial, mode = 'person' }: { initial: Answers; mode?: 'person' | 'home' }) {
  const [picks, setPicks] = useState<Partial<Record<Key, Pick>>>(() =>
    Object.fromEntries(keys.flatMap(k => { const a = initial[k]; const habit = a?.habit ?? a?.want; return habit ? [[k, { habit, strength: a!.strength }]] : []; })));
  const answered = keys.filter(k => picks[k]).length;
  const set = (k: Key, pick: Pick | undefined) => setPicks(p => { const next = { ...p }; if (pick) next[k] = pick; else delete next[k]; return next; });
  return (
    <div>
      <div className="row between small muted" aria-live="polite"><span>{answered} of {keys.length} answered</span><span>Tap again to skip</span></div>
      <div className="progress" role="progressbar" aria-label="Topics answered" aria-valuemin={0} aria-valuemax={keys.length} aria-valuenow={answered} style={{ margin: '6px 0 14px' }}><span style={{ width: `${(answered / keys.length) * 100}%` }} /></div>
      {keys.map(key => {
        const pick = picks[key];
        return (
          <fieldset key={key} className="topic">
            <legend><span className="emoji" aria-hidden="true">{emoji[key]}</span>{titles[key]}</legend>
            <div className="chips">
              {dimensions[key].map(option => (
                <button key={option} type="button" className="chip-btn" aria-pressed={pick?.habit === option}
                  onClick={() => set(key, pick?.habit === option ? undefined : { habit: option, strength: pick?.strength ?? 'preference' })}>{option}</button>
              ))}
            </div>
            {pick ? (
              <>
                <label className="must">
                  <input type="checkbox" checked={pick.strength === 'dealbreaker'} onChange={e => set(key, { habit: pick.habit, strength: e.target.checked ? 'dealbreaker' : 'preference' })} />
                  {mode === 'home' ? 'A flatmate must match this' : 'My flatmate must match this'}
                </label>
                <input type="hidden" name={`${key}_habit`} value={pick.habit} />
                <input type="hidden" name={`${key}_want`} value={pick.habit} />
                <input type="hidden" name={`${key}_strength`} value={pick.strength} />
              </>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
