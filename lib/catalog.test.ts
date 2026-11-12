import { describe, expect, it } from 'vitest';
import { areaName, rupees, today, totals } from './catalog';

describe('totals', () => {
  it('adds recurring costs and upfront costs', () => {
    expect(totals({ rent: 1_500_000, maintenance: 200_000, utilities: 100_000, recurring: 50_000, deposit: 3_000_000, brokerage: 0, fees: 10_000 }))
      .toEqual({ monthly: 1_850_000, initial: 4_860_000, incomplete: false });
  });
  it('flags unknown utilities as incomplete and treats them as zero', () => {
    expect(totals({ rent: 100_000, maintenance: 10_000, utilities: null, recurring: 0, deposit: 500_000, brokerage: 0, fees: 0 }))
      .toEqual({ monthly: 110_000, initial: 610_000, incomplete: true });
  });
});

describe('formatting helpers', () => {
  it('formats paise as Indian rupees', () => {
    expect(rupees(1_234_500)).toBe('₹12,345');
    expect(rupees(150)).toBe('₹1.50');
  });
  it('resolves known area names and falls back to the slug', () => {
    expect(areaName('gurugram', 'sector-56')).toBe('Sector 56');
    expect(areaName('noida', 'unknown-area')).toBe('unknown-area');
    expect(areaName('mumbai', 'bandra')).toBe('bandra');
  });
  it('returns today as an ISO date in IST', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
