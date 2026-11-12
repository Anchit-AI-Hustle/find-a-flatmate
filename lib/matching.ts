import { dimensions, titles, type Costs, totals } from './catalog';

export const scoringVersion = '1.0.0';
export type Strength = 'flexible'|'preference'|'dealbreaker';
export type Answer = {habit?:string; want?:string; strength:Strength};
export type Answers = Partial<Record<keyof typeof dimensions,Answer>>;
type Geo = {city:string; areas:string[]; from:string; until:string; months:number};
export type Person = Geo & {id:string; budgetMin:number; budgetMax:number; answers:Answers};
export type Room = Geo & {ownerId:string; costs:Costs; rules:Answers};
type Result = {
  score:number|null; confidence:'low'|'medium'|'high'; top_reasons:string[];
  potential_friction:string[]; hard_fail_reasons:string[]; missing_answers:string[]; scoring_version:string;
};
const logistics = new Set(['chores','expenses','utilities']);
const sorted = (items:string[]) => [...new Set(items)].sort();
const overlap = (a:Geo,b:Geo) => a.from <= b.until && b.from <= a.until;
function shared(a:Geo,b:Geo) {
  const hard:string[] = [], reasons:string[] = [], friction:string[] = [];
  if(a.city!==b.city) hard.push('Different cities');
  const location = a.areas.some(area => b.areas.includes(area));
  if(!location) hard.push('No overlapping preferred locality');
  else reasons.push('Your preferred localities overlap.');
  if(!overlap(a,b)) hard.push('Move-in windows do not overlap');
  else reasons.push('Your move-in windows overlap.');
  return {hard,reasons,friction,points:(location?15:0)+(overlap(a,b)?10:0)};
}
function lifestyle(a:Answers,b:Answers,room:boolean) {
  const hard:string[]=[], reasons:string[]=[], friction:string[]=[], missing:string[]=[];
  let points=0, known=0;
  const keys=Object.keys(dimensions) as (keyof typeof dimensions)[];
  for(const key of keys){
    const aa=a[key], bb=b[key], weight=logistics.has(key)?10/3:40/11;
    const comparisons=room ? [[aa,bb]] : [[aa,bb],[bb,aa]];
    let explained=0, fit=0;
    for(const [expects,other] of comparisons){
      if(!expects?.want || !other?.habit) continue;
      explained++;
      if(expects.want===other.habit || expects.strength==='flexible') fit++;
      else if(expects.strength==='dealbreaker') hard.push(`Dealbreaker: ${titles[key]}`);
    }
    const coverage=explained/comparisons.length;
    known+=coverage;
    points+=weight*fit/comparisons.length;
    if(coverage<1) missing.push(titles[key]);
    if(explained>fit) friction.push(`Different expectations for ${titles[key].toLowerCase()}.`);
    if(coverage===1 && fit===comparisons.length && aa?.want===bb?.habit) reasons.push(`Compatible expectations for ${titles[key].toLowerCase()}.`);
  }
  return {hard,reasons,friction,missing,points,known:known/keys.length};
}
function result(base:ReturnType<typeof shared>, life:ReturnType<typeof lifestyle>, extra:number, missing:string[]=[]):Result {
  const hard=sorted([...base.hard,...life.hard]);
  const coverage=life.known;
  return { score:hard.length||coverage<0.25?null:Math.min(100,Math.round(base.points+life.points+extra)),
    confidence:coverage>=.75&&!missing.length?'high':coverage>=.4?'medium':'low',
    top_reasons:[...sorted(life.reasons),...sorted(base.reasons)].slice(0,5),
    potential_friction:sorted([...base.friction,...life.friction]), hard_fail_reasons:hard,
    missing_answers:sorted([...life.missing,...missing]), scoring_version:scoringVersion };
}
export function matchPeople(a:Person,b:Person):Result {
  const base=shared(a,b);
  if(a.id===b.id) base.hard.push('Same account');
  const budgets=Math.max(a.budgetMin,b.budgetMin)<=Math.min(a.budgetMax,b.budgetMax);
  if(budgets) base.reasons.push('Your monthly budget ranges overlap.');
  else base.hard.push('Monthly budget ranges do not overlap');
  const stay=Math.abs(a.months-b.months)<=3;
  if(!stay) base.friction.push('You prefer different lengths of stay.');
  return result(base,lifestyle(a.answers,b.answers,false),(budgets?20:0)+(stay?5:0));
}
export function matchRoom(person:Person,room:Room):Result {
  const base=shared(person,room), cost=totals(room.costs);
  if(person.id===room.ownerId) base.hard.push('Own listing');
  if(cost.monthly>person.budgetMax) base.hard.push('Listed recurring cost exceeds budget');
  else if(cost.incomplete) base.friction.push('Utilities are unknown; check the full cost before deciding.');
  else base.reasons.push('Estimated monthly cost is within your maximum budget.');
  const stay=person.months>=room.months;
  if(!stay) base.hard.push('Minimum stay exceeds your plans');
  return result(base,lifestyle(person.answers,room.rules,true),(cost.monthly<=person.budgetMax?(cost.incomplete?10:20):0)+(stay?5:0),cost.incomplete?['Utility estimate']:[]);
}
