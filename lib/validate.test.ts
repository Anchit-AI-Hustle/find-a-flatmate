import { describe, expect, it } from 'vitest';
import { formFields, forms, paise, readAnswers } from './validate';

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

describe('paise', () => {
  it('converts rupee strings to integer paise', () => {
    expect(paise.parse('12345')).toBe(1_234_500);
    expect(paise.parse('99.5')).toBe(9_950);
    expect(paise.parse('0.05')).toBe(5);
  });
  it('rejects malformed or out-of-range amounts', () => {
    for (const bad of ['', 'abc', '-1', '1.234', '1234567', '1,000']) expect(paise.safeParse(bad).success).toBe(false);
  });
});

describe('forms.basics', () => {
  const valid = {
    name: 'Asha', city: 'gurugram', areas: ['sector-56'], min: '10000', max: '20000',
    from: '2026-12-01', until: '2027-01-31', months: '6', intent: 'looking_for_room', adult: 'on', terms: 'on',
  };
  it('accepts a complete, consistent profile', () => {
    const out = forms.basics.parse(valid);
    expect(out).toMatchObject({ min: 1_000_000, max: 2_000_000, months: 6, adult: true, terms: true });
  });
  it('rejects localities from another city', () => {
    expect(forms.basics.safeParse({ ...valid, areas: ['sector-62'] }).success).toBe(false);
  });
  it('rejects an inverted budget or date range', () => {
    expect(forms.basics.safeParse({ ...valid, min: '30000' }).success).toBe(false);
    expect(forms.basics.safeParse({ ...valid, until: '2026-11-01' }).success).toBe(false);
  });
  it('requires the adult and terms confirmations', () => {
    expect(forms.basics.safeParse({ ...valid, adult: null }).success).toBe(false);
  });
  it('rejects markup in names', () => {
    expect(forms.basics.safeParse({ ...valid, name: '<script>' }).success).toBe(false);
  });
});

describe('other forms', () => {
  it('maps privacy checkboxes to booleans', () => {
    expect(forms.privacy.parse({ discoverable: 'on', analytics: null, reminders: null, status: null }))
      .toEqual({ discoverable: true, analytics: false, reminders: false, status: null });
  });
  it('requires confirmation before account deletion', () => {
    expect(forms.request.safeParse({ kind: 'delete', details: null, confirm: null }).success).toBe(false);
    expect(forms.request.safeParse({ kind: 'delete', details: null, confirm: 'on' }).success).toBe(true);
    expect(forms.request.safeParse({ kind: 'export', details: null, confirm: null }).success).toBe(true);
  });
  it('normalises visit times to IST offsets', () => {
    const out = forms.visit.parse({ c: crypto.randomUUID(), v: null, action: 'request', at_time: '2026-12-01T18:30' });
    expect(out.at_time).toBe('2026-12-01T18:30:00+05:30');
  });
  it('validates emails', () => {
    expect(forms.email.safeParse('person@example.com').success).toBe(true);
    expect(forms.email.safeParse('not-an-email').success).toBe(false);
  });
});

describe('form helpers', () => {
  it('drops Next.js internal action fields', () => {
    expect(formFields(fd([['$ACTION_ID_abc', 'x'], ['name', 'Asha']]))).toEqual({ name: 'Asha' });
  });
  it('reads lifestyle answers and rejects unknown options', () => {
    expect(readAnswers(fd([['sleep_habit', 'Early nights'], ['sleep_want', 'Varies'], ['sleep_strength', 'preference']])))
      .toEqual({ sleep: { habit: 'Early nights', want: 'Varies', strength: 'preference' } });
    expect(() => readAnswers(fd([['sleep_habit', 'Never sleeps'], ['sleep_strength', 'flexible']]))).toThrow();
    expect(readAnswers(fd([]))).toEqual({});
  });
});
