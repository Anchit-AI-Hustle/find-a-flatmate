import { describe, expect, it } from 'vitest';
import { dimensions, totals } from './catalog';
import { matchPeople, matchRoom, type Person } from './matching';
import { isSample, samplePeople, sampleRooms } from './samples';

const me: Person = {
  id: 'me', city: 'gurugram', areas: ['sector-56', 'dlf-phase-3'], from: '2026-12-01', until: '2027-01-15', months: 6, budgetMin: 1_200_000, budgetMax: 2_200_000,
  answers: { sleep: { habit: dimensions.sleep[0], want: dimensions.sleep[0], strength: 'preference' }, smoking: { habit: dimensions.smoking[0], want: dimensions.smoking[0], strength: 'preference' } },
};

describe('sample profiles', () => {
  it('are marked as samples and built around the member’s own search', () => {
    const people = samplePeople(me);
    expect(people.length).toBeGreaterThanOrEqual(6);
    for (const p of people) {
      expect(isSample(p.id)).toBe(true);
      expect(p.person).toMatchObject({ city: 'gurugram', from: me.from, until: me.until });
      expect(matchPeople(me, p.person).hard_fail_reasons).toEqual([]);
    }
    expect(isSample('3f0c6e9a-1c1e-4b7e-9a57-6f3f0b1f4c11')).toBe(false);
  });
  it('give a spread of scores, and withhold a score when a sample has answered too little', () => {
    const full: Person = { ...me, answers: Object.fromEntries(Object.keys(dimensions).map(k => [k, { habit: dimensions[k as keyof typeof dimensions][0], want: dimensions[k as keyof typeof dimensions][0], strength: 'preference' }])) };
    const results = samplePeople(full).map(p => ({ id: p.id, score: matchPeople(full, p.person).score }));
    const scores = results.map(r => r.score).filter((v): v is number => v !== null);
    expect(new Set(scores).size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThanOrEqual(15);
    expect(results.find(r => r.id === 'sample-dev')?.score).toBeNull();
  });
  it('are dropped when the member’s own dealbreaker rules them out', () => {
    const strict: Person = { ...me, answers: { smoking: { habit: dimensions.smoking[0], want: dimensions.smoking[0], strength: 'dealbreaker' } } };
    const blocked = samplePeople(strict).filter(p => matchPeople(strict, p.person).hard_fail_reasons.length);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.length).toBeLessThan(samplePeople(strict).length);
  });
  it('are stable between calls', () => {
    expect(samplePeople(me)).toEqual(samplePeople(me));
    expect(sampleRooms(me)).toEqual(sampleRooms(me));
  });
});

describe('sample rooms', () => {
  it('fit the member’s budget, area, dates and stay, with whole-rupee costs', () => {
    for (const r of sampleRooms(me)) {
      expect(isSample(r.id)).toBe(true);
      const t = totals(r.room.costs);
      expect(t.monthly).toBeLessThanOrEqual(me.budgetMax);
      expect(t.monthly % 50_000).toBe(0);
      expect(r.room.costs.deposit).toBe(r.room.costs.rent * 2);
      expect(matchRoom(me, r.room).hard_fail_reasons).toEqual([]);
    }
  });
  it('include one with unknown utilities, shown as unknown rather than zero', () => {
    expect(sampleRooms(me).some(r => r.room.costs.utilities === null)).toBe(true);
  });
});
