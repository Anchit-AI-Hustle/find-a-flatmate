export const cities = {
  gurugram: { name: 'Gurugram', areas: { 'dlf-phase-3': 'DLF Phase 3', 'sector-56': 'Sector 56' } },
  noida: { name: 'Noida', areas: { 'sector-62': 'Sector 62', 'sector-137': 'Sector 137' } },
} as const;
export const intents = {
  looking_for_room: 'I’m looking for a room',
  have_room: 'I have a room to fill',
  find_together: 'I want to find a home together',
} as const;
export const dimensions = {
  sleep: ['Early nights', 'Late nights', 'Varies'],
  noise: ['Usually quiet', 'Some background noise', 'Lively home'],
  cleanliness: ['Tidy daily', 'Weekly clean', 'Flexible routine'],
  cooking: ['Cook most days', 'Cook occasionally', 'Rarely cook'],
  kitchen: ['Vegetarian kitchen', 'Mixed kitchen', 'Separate utensils'],
  guests: ['Occasional daytime guests', 'Overnight guests', 'Rare guests'],
  smoking: ['No shared-space smoking', 'Smoking outdoors only', 'Shared-space smoking'],
  alcohol: ['No alcohol in shared spaces', 'Occasional alcohol', 'Flexible'],
  pets: ['No pets', 'Pets welcome', 'Ask first'],
  wfh: ['Mostly office', 'Hybrid', 'Mostly home'],
  privacy: ['Mostly private', 'Some time together', 'Social household'],
  chores: ['Weekly rota', 'Clean as you go', 'Shared cleaner'],
  expenses: ['Equal shares', 'Split by use', 'Agree case by case'],
  utilities: ['Limit AC use', 'AC as needed', 'Agree case by case'],
} as const;
export const amenities = ['Lift','AC','Parking','Power backup','Wi-Fi','Step-free access','Reliable water'] as const;
export const roomTypes = { private_room:'Private room', shared_room:'Shared room', entire_flat:'Flat seeking co-tenants', other:'Other room arrangement' } as const;
export const titles: Record<string,string> = {sleep:'Sleep rhythm',noise:'Noise',cleanliness:'Cleanliness',cooking:'Cooking',kitchen:'Shared kitchen',guests:'Guests',smoking:'Smoking',alcohol:'Alcohol',pets:'Pets',wfh:'Work from home',privacy:'Privacy',chores:'Chores',expenses:'Shared expenses',utilities:'AC and utilities'};
export type City = keyof typeof cities;
export function areaName(city: string, area: string) {
  return (cities[city as City]?.areas as Record<string,string> | undefined)?.[area] ?? area;
}
export function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export const rupees = (paise:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:paise%100?2:0,maximumFractionDigits:2}).format(paise/100);
export type Costs = {rent:number; maintenance:number; utilities:number|null; recurring:number; deposit:number; brokerage:number; fees:number};
export function totals(c:Costs) {
  const monthly = c.rent+c.maintenance+(c.utilities??0)+c.recurring;
  return {monthly, initial:monthly+c.deposit+c.brokerage+c.fees, incomplete:c.utilities===null};
}
/** Request time for server-rendered pages (kept out of component bodies so renders stay pure). */
export const nowMs = () => Date.now();
