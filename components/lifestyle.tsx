'use client';
import { useState } from 'react';
import { dimensions, titles } from '@/lib/catalog';
import type { Answers } from '@/lib/matching';

const keys = Object.keys(dimensions) as (keyof typeof dimensions)[];
const prompts: Record<string, string> = {
  sleep: 'When do you usually sleep?', noise: 'How noisy is home life?', cleanliness: 'How do you keep shared spaces?', cooking: 'How often do you cook at home?',
  kitchen: 'What suits you in a shared kitchen?', guests: 'How often do you have guests?', smoking: 'Smoking at home?', alcohol: 'Alcohol in shared spaces?',
  pets: 'Pets at home?', wfh: 'Where do you work most days?', privacy: 'Time together or time apart?', chores: 'How should chores be shared?',
  expenses: 'How should shared bills be split?', utilities: 'AC and electricity use?',
};

/** Lifestyle questionnaire. `mode="home"` words the same questions as house rules for a listing. */
export function LifestyleFields({ initial, mode = 'person' }: { initial: Answers; mode?: 'person' | 'home' }) {
  const [answered, setAnswered] = useState(() => keys.filter(k => initial[k]?.habit || initial[k]?.want).length);
  const recount = (form: HTMLFormElement | null) => {
    if (!form) return;
    const data = new FormData(form);
    setAnswered(keys.filter(k => data.get(`${k}_habit`) || data.get(`${k}_want`)).length);
  };
  return (
    <div onChange={event => recount((event.target as HTMLElement).closest('form'))}>
      <div className="row between small muted" aria-live="polite"><span>{answered} of {keys.length} answered</span><span>Skip anything you’d rather not answer</span></div>
      <div className="progress" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={keys.length} aria-valuenow={answered} style={{ margin: '6px 0 16px' }}><span style={{ width: `${(answered / keys.length) * 100}%` }} /></div>
      {keys.map(key => {
        const a = initial[key];
        return (
          <fieldset key={key} className="question">
            <legend><span className="chip plain">{titles[key]}</span> {prompts[key]}</legend>
            <div className="cols three">
              <div className="field">
                <label htmlFor={`${key}_habit`}>{mode === 'home' ? 'This home today' : 'My habit'}</label>
                <select id={`${key}_habit`} name={`${key}_habit`} defaultValue={a?.habit ?? ''}>
                  <option value="">Skip</option>
                  {dimensions[key].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${key}_want`}>{mode === 'home' ? 'We’d like a flatmate who is' : 'I’d like my flatmates to be'}</label>
                <select id={`${key}_want`} name={`${key}_want`} defaultValue={a?.want ?? ''}>
                  <option value="">No preference</option>
                  {dimensions[key].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${key}_strength`}>How firm is that?</label>
                <select id={`${key}_strength`} name={`${key}_strength`} defaultValue={a?.strength ?? 'preference'}>
                  <option value="flexible">Flexible</option>
                  <option value="preference">A preference</option>
                  <option value="dealbreaker">A dealbreaker</option>
                </select>
              </div>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
