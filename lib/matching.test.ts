import { describe, expect, it } from 'vitest';
import { matchPeople, matchRoom, scoringVersion, type Answers, type Person, type Room } from './matching';
import { dimensions } from './catalog';

const keys = Object.keys(dimensions) as (keyof typeof dimensions)[];
const agreeing: Answers = Object.fromEntries(keys.map(k => [k, { habit: dimensions[k][0], want: dimensions[k][0], strength: 'preference' }]));

const person = (over: Partial<Person> = {}): Person => ({
  id: 'a', city: 'gurugram', areas: ['sector-56'], from: '2026-12-01', until: '2027-01-31', months: 6,
  budgetMin: 1_000_000, budgetMax: 2_000_000, answers: agreeing, ...over,
});
const room = (over: Partial<Room> = {}): Room => ({
  ownerId: 'owner', city: 'gurugram', areas: ['sector-56'], from: '2026-12-15', until: '2027-06-30', months: 3,
  costs: { rent: 1_500_000, maintenance: 100_000, utilities: 100_000, recurring: 0, deposit: 3_000_000, brokerage: 0, fees: 0 },
  rules: agreeing, ...over,
});

describe('matchPeople', () => {
  it('scores fully compatible people at 100 with high confidence', () => {
    const r = matchPeople(person(), person({ id: 'b' }));
    expect(r).toMatchObject({ score: 100, confidence: 'high', hard_fail_reasons: [], missing_answers: [], scoring_version: scoringVersion });
    expect(r.top_reasons.length).toBeLessThanOrEqual(5);
  });
  it('is symmetric', () => {
    const a = person(), b = person({ id: 'b', months: 12, budgetMin: 1_500_000, budgetMax: 3_000_000 });
    expect(matchPeople(a, b).score).toBe(matchPeople(b, a).score);
  });
  it('returns no score when there is a hard fail', () => {
    const r = matchPeople(person(), person({ id: 'b', city: 'noida', areas: ['sector-62'] }));
    expect(r.score).toBeNull();
    expect(r.hard_fail_reasons).toEqual(expect.arrayContaining(['Different cities', 'No overlapping preferred locality']));
  });
  it('rejects matching an account with itself', () => {
    expect(matchPeople(person(), person()).hard_fail_reasons).toContain('Same account');
  });
  it('fails non-overlapping budgets and move-in windows', () => {
    const r = matchPeople(person(), person({ id: 'b', budgetMin: 2_500_000, budgetMax: 3_000_000, from: '2027-03-01', until: '2027-04-01' }));
    expect(r.hard_fail_reasons).toEqual(expect.arrayContaining(['Monthly budget ranges do not overlap', 'Move-in windows do not overlap']));
  });
  it('turns a conflicting dealbreaker into a hard fail', () => {
    const strict: Answers = { ...agreeing, smoking: { habit: dimensions.smoking[0], want: dimensions.smoking[0], strength: 'dealbreaker' } };
    const smoker: Answers = { ...agreeing, smoking: { habit: dimensions.smoking[2], want: dimensions.smoking[2], strength: 'flexible' } };
    expect(matchPeople(person({ answers: strict }), person({ id: 'b', answers: smoker })).hard_fail_reasons).toContain('Dealbreaker: Smoking');
  });
  it('withholds a score when too few answers are known', () => {
    const r = matchPeople(person({ answers: {} }), person({ id: 'b', answers: {} }));
    expect(r.score).toBeNull();
    expect(r.confidence).toBe('low');
    expect(r.missing_answers).toHaveLength(keys.length);
  });
});

describe('matchRoom', () => {
  it('scores an affordable, compatible room', () => {
    const r = matchRoom(person(), room());
    expect(r).toMatchObject({ score: 100, confidence: 'high', hard_fail_reasons: [], potential_friction: [] });
    expect(r.top_reasons).toHaveLength(5);
  });
  it('fails rooms over budget, own listings and long minimum stays', () => {
    const r = matchRoom(person({ id: 'owner' }), room({ months: 12, costs: { ...room().costs, rent: 5_000_000 } }));
    expect(r.score).toBeNull();
    expect(r.hard_fail_reasons).toEqual(expect.arrayContaining(['Own listing', 'Listed recurring cost exceeds budget', 'Minimum stay exceeds your plans']));
  });
  it('flags unknown utilities as friction and missing information', () => {
    const r = matchRoom(person(), room({ costs: { ...room().costs, utilities: null } }));
    expect(r.potential_friction).toContain('Utilities are unknown; check the full cost before deciding.');
    expect(r.missing_answers).toContain('Utility estimate');
    expect(r.confidence).not.toBe('high');
    expect(r.score).toBe(90);
  });
});

describe('household rules', () => {
  it('treats the household’s own dealbreaker about a flatmate as a hard fail', () => {
    const rules: Answers = { ...agreeing, pets: { habit: dimensions.pets[0], want: dimensions.pets[0], strength: 'dealbreaker' } };
    const petOwner: Answers = { ...agreeing, pets: { habit: dimensions.pets[1], want: dimensions.pets[0], strength: 'flexible' } };
    const r = matchRoom(person({ answers: petOwner }), room({ rules }));
    expect(r.score).toBeNull();
    expect(r.hard_fail_reasons).toContain('Household dealbreaker: Pets');
  });
  it('never lets a skipped answer raise a score', () => {
    const partial: Answers = { sleep: agreeing.sleep, noise: agreeing.noise, cleanliness: agreeing.cleanliness, cooking: agreeing.cooking };
    const full = matchPeople(person(), person({ id: 'b' }));
    const skipped = matchPeople(person({ answers: partial }), person({ id: 'b' }));
    expect(skipped.score!).toBeLessThan(full.score!);
    expect(skipped.confidence).not.toBe('high');
    expect(skipped.missing_answers.length).toBe(10);
  });
});
