import { dimensions } from './catalog';
import type { Answers, Person, Room } from './matching';

/**
 * Practice profiles for the swipe deck. They are generated in code around the signed-in member's own search,
 * are always labelled "Sample" on screen, and are never written to the database: no account, no interest,
 * no chat. They exist so a new member can try matching while real supply is thin.
 */
type Key = keyof typeof dimensions;
const pick = (choices: Partial<Record<Key, 0 | 1 | 2>>): Answers =>
  Object.fromEntries(Object.entries(choices).map(([k, i]) => { const v = dimensions[k as Key][i as number]; return [k, { habit: v, want: v, strength: 'preference' }]; }));

const people: { id: string; name: string; intent: 'looking_for_room' | 'have_room' | 'find_together'; likesYou?: true; budget: [number, number]; months: number; answers: Answers }[] = [
  { id: 'aarav', name: 'Aarav', intent: 'looking_for_room', likesYou: true, budget: [0.8, 1.1], months: 0, answers: pick({ sleep: 0, noise: 0, cleanliness: 0, cooking: 0, kitchen: 0, guests: 2, smoking: 0, alcohol: 0, pets: 0, wfh: 1, privacy: 1, chores: 0, expenses: 0, utilities: 0 }) },
  { id: 'meher', name: 'Meher', intent: 'have_room', budget: [0.9, 1.2], months: 2, answers: pick({ sleep: 1, noise: 1, cleanliness: 1, cooking: 1, kitchen: 1, guests: 0, smoking: 0, alcohol: 1, pets: 1, wfh: 2, privacy: 2, chores: 1, expenses: 0, utilities: 1 }) },
  { id: 'kabir', name: 'Kabir', intent: 'find_together', likesYou: true, budget: [0.7, 1.0], months: -1, answers: pick({ sleep: 2, noise: 1, cleanliness: 1, cooking: 2, kitchen: 1, guests: 0, smoking: 1, alcohol: 1, pets: 2, wfh: 0, privacy: 1, chores: 2, expenses: 1 }) },
  { id: 'ananya', name: 'Ananya', intent: 'looking_for_room', budget: [0.85, 1.05], months: 1, answers: pick({ sleep: 0, noise: 0, cleanliness: 0, cooking: 0, kitchen: 2, guests: 2, smoking: 0, alcohol: 0, pets: 2, wfh: 2, privacy: 0, chores: 1 }) },
  { id: 'rohan', name: 'Rohan', intent: 'have_room', budget: [0.9, 1.3], months: 3, answers: pick({ sleep: 1, noise: 2, cleanliness: 2, cooking: 2, kitchen: 1, guests: 1, smoking: 1, alcohol: 2, pets: 1, wfh: 0, privacy: 2, chores: 2, expenses: 2, utilities: 1 }) },
  { id: 'tara', name: 'Tara', intent: 'find_together', budget: [0.75, 1.0], months: 0, answers: pick({ sleep: 0, noise: 1, cleanliness: 1, cooking: 1, kitchen: 0, guests: 0, smoking: 0, alcohol: 0, pets: 0, wfh: 0, privacy: 1, chores: 0, expenses: 0, utilities: 2 }) },
  { id: 'dev', name: 'Dev', intent: 'looking_for_room', budget: [0.8, 1.15], months: 0, answers: pick({ sleep: 2, cleanliness: 1, smoking: 0 }) },
  { id: 'isha', name: 'Isha', intent: 'have_room', budget: [0.95, 1.25], months: 2, answers: pick({ sleep: 1, noise: 1, cleanliness: 0, cooking: 1, kitchen: 1, guests: 1, smoking: 1, alcohol: 1, pets: 2, wfh: 1, privacy: 1, chores: 1, expenses: 1, utilities: 1 }) },
];
const rooms: { id: string; title: string; type: 'private_room' | 'shared_room' | 'entire_flat'; art: 'visit' | 'kitchen' | 'hero' | 'together'; cost: number; utilities: number | null; rules: Answers }[] = [
  { id: 'balcony', title: 'Sunny room with a balcony', type: 'private_room', art: 'visit', cost: 0.82, utilities: null, rules: pick({ sleep: 0, noise: 0, cleanliness: 0, kitchen: 0, smoking: 0, pets: 0, guests: 2 }) },
  { id: 'metro', title: 'Furnished room near the metro', type: 'private_room', art: 'hero', cost: 0.92, utilities: 0.06, rules: pick({ sleep: 1, noise: 1, cleanliness: 1, kitchen: 1, smoking: 1, pets: 2, guests: 0 }) },
  { id: 'kitchen', title: 'Room in a flat that cooks together', type: 'private_room', art: 'kitchen', cost: 0.74, utilities: 0.05, rules: pick({ sleep: 0, cooking: 0, kitchen: 1, cleanliness: 0, chores: 0, expenses: 0, smoking: 0 }) },
  { id: 'twin', title: 'Twin-share room, bills included', type: 'shared_room', art: 'together', cost: 0.55, utilities: 0.04, rules: pick({ sleep: 2, noise: 1, cleanliness: 1, guests: 0, privacy: 2, utilities: 1 }) },
  { id: 'whole', title: 'Empty 2BHK looking for co-tenants', type: 'entire_flat', art: 'visit', cost: 0.97, utilities: null, rules: pick({ noise: 1, pets: 1, guests: 1, wfh: 2 }) },
];

export type SamplePerson = { id: string; name: string; intent: 'looking_for_room' | 'have_room' | 'find_together'; likesYou: boolean; person: Person };
export type SampleRoom = { id: string; title: string; type: 'private_room' | 'shared_room' | 'entire_flat'; art: 'visit' | 'kitchen' | 'hero' | 'together'; room: Room };
export const isSample = (id: string) => id.startsWith('sample-');
/** Round rupee amounts (stored in paise) to the nearest ₹500 so sample figures look like real quotes. */
const tidy = (paise: number) => Math.max(50_000, Math.round(paise / 50_000) * 50_000);

export function samplePeople(me: Person): SamplePerson[] {
  return people.map(p => ({
    id: `sample-${p.id}`, name: p.name, intent: p.intent, likesYou: Boolean(p.likesYou),
    person: { id: `sample-${p.id}`, city: me.city, areas: me.areas.slice(0, 2), from: me.from, until: me.until, months: Math.max(1, me.months + p.months),
      budgetMin: tidy(me.budgetMin * p.budget[0]), budgetMax: tidy(me.budgetMax * p.budget[1]), answers: p.answers },
  }));
}
export function sampleRooms(me: Person): SampleRoom[] {
  return rooms.map(r => {
    const monthly = tidy(me.budgetMax * r.cost);
    const maintenance = tidy(monthly * 0.1);
    const rent = Math.max(50_000, monthly - maintenance);
    return {
      id: `sample-${r.id}`, title: r.title, type: r.type, art: r.art,
      room: { ownerId: `sample-${r.id}`, city: me.city, areas: me.areas.slice(0, 1), from: me.from, until: me.until, months: Math.min(3, me.months), rules: r.rules,
        costs: { rent, maintenance, utilities: r.utilities === null ? null : tidy(me.budgetMax * r.utilities), recurring: 0, deposit: rent * 2, brokerage: 0, fees: 0 } },
    };
  });
}
