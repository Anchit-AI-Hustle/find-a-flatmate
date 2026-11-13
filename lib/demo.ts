import { matchPeople, matchRoom, type Person, type Room } from './matching';

export const exampleHabits = {
  sleep: { habit: 'Early nights', want: 'Early nights', strength: 'preference' },
  noise: { habit: 'Usually quiet', want: 'Usually quiet', strength: 'preference' },
  cleanliness: { habit: 'Tidy daily', want: 'Tidy daily', strength: 'preference' },
  smoking: { habit: 'No shared-space smoking', want: 'No shared-space smoking', strength: 'dealbreaker' },
  chores: { habit: 'Weekly rota', want: 'Weekly rota', strength: 'preference' },
} satisfies Person['answers'];

export function demoResults(city: 'gurugram' | 'noida') {
  const area = city === 'noida' ? 'sector-62' : 'sector-56';
  const base: Person = { id: 'example-self', city, areas: [area], from: '2030-01-01', until: '2030-01-25', months: 6, budgetMin: 1_200_000, budgetMax: 2_400_000, answers: exampleHabits };
  const people = [
    { id: 'example-tidy', title: 'The early riser', blurb: 'Quiet evenings and a weekly chore rota.', answers: exampleHabits },
    { id: 'example-social', title: 'The night owl', blurb: 'Later nights, with a preference for tidy shared spaces.', answers: { ...exampleHabits, sleep: { habit: 'Late nights', want: 'Late nights', strength: 'preference' as const } } },
  ].map(p => ({ ...p, area, fit: matchPeople(base, { ...base, ...p }) }));
  const room: Room = {
    ownerId: 'example-owner', city, areas: [area], from: '2030-01-10', until: '2030-01-20', months: 3, rules: exampleHabits,
    costs: { rent: 1_500_000, maintenance: 150_000, utilities: null, recurring: 0, deposit: 2_500_000, brokerage: 0, fees: 0 },
  };
  const rooms = [
    { title: 'Quiet room with a shared kitchen', blurb: '₹16,500 known monthly subtotal. Utilities are unknown.', room },
    { title: 'Furnished room near transit', blurb: '₹19,500 estimated monthly, including estimated utilities.', room: { ...room, costs: { ...room.costs, rent: 1_650_000, maintenance: 180_000, utilities: 120_000 } } },
  ].map(({ title, blurb, room }) => ({ title, blurb, area, fit: matchRoom(base,room) }));
  return { people, rooms };
}
