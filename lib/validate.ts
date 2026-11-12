import {z} from 'zod';
import {amenities,cities,dimensions,intents,roomTypes} from './catalog';
import type {Answers} from './matching';
export const uuid=z.uuid();
export const city=z.enum(['gurugram','noida']);
export const intent=z.enum(Object.keys(intents) as [keyof typeof intents,...(keyof typeof intents)[]]);
export const roomType=z.enum(Object.keys(roomTypes) as [keyof typeof roomTypes,...(keyof typeof roomTypes)[]]);
const plain=(min:number,max:number)=>z.string().trim().min(min).max(max).regex(/^[^<>]*$/);
const day=z.iso.date();
const num=(min:number,max:number)=>z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
export const paise=z.string().regex(/^\d{1,6}(\.\d{1,2})?$/).transform(s=>{const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}).pipe(z.number().int().min(0).max(50_000_000));
const checkbox=z.union([z.literal('on'),z.null()]).transform(v=>v==='on');
const checked=z.literal('on').transform(()=>true);
const scope=z.object({city,areas:z.array(z.string()).min(1).max(4)}).refine(v=>v.areas.every(a=>Object.hasOwn(cities[v.city].areas,a)),{message:'Choose localities in the selected city'});
const basics=z.object({name:plain(2,60),city,areas:z.array(z.string()),min:paise,max:paise,from:day,until:day,months:num(1,36),intent,adult:checked,terms:checked})
 .refine(v=>scope.safeParse(v).success&&v.min<=v.max&&v.from<=v.until,{message:'Check the locality, budget and dates'});
const listing=z.object({
 id:uuid.nullable(),title:plain(8,90),description:plain(10,1200),city_id:city,locality_id:z.string(),room_type:roomType,
 building:z.enum(['Society apartment','Independent floor','Standalone building','Other']),furnishing:z.enum(['Unfurnished','Semi-furnished','Furnished']),
 bath_sharing:z.enum(['Private','Shared']),rooms:num(1,20),bathrooms:num(1,20),occupants:num(0,20),capacity:num(1,20),poster_type:z.enum(['Occupant','Owner']),attested:checked,
 transport:plain(0,300),restrictions:plain(0,300),rent:paise.refine(p=>p>=100),maintenance:paise,utilities:z.union([z.literal('').transform(()=>null),paise]),
 recurring:paise,deposit:paise,brokerage:paise,fees:paise,available_from:day,available_until:day,min_months:num(1,36),amenities:z.array(z.enum(amenities)).max(7),
}).refine(v=>v.capacity>v.occupants&&v.available_until>=v.available_from&&Object.hasOwn(cities[v.city_id].areas,v.locality_id),{message:'Check occupancy, locality and availability dates'});
export function readAnswers(form:FormData):Answers {
  const output:Answers={};
  for(const key of Object.keys(dimensions) as (keyof typeof dimensions)[]){
    const opts=dimensions[key];
    const get=(field:string)=>{
      const val=form.get(key+'_'+field);
      if(!val) return undefined;
      return z.string().refine(s=>(opts as readonly string[]).includes(s)).parse(val);
    };
    const habit=get('habit'),want=get('want');
    if(habit||want) output[key]={habit,want,strength:z.enum(['flexible','preference','dealbreaker']).parse(form.get(key+'_strength'))};
  }
  return output;
}
export const forms={
 basics,listing,
 privacy:z.object({discoverable:checkbox,analytics:checkbox,reminders:checkbox,status:z.enum(['active','paused']).nullable()}),
 listingState:z.object({id:uuid,action:z.enum(['submit','pause','renew','fill'])}),
 interest:z.object({target:uuid,action:z.enum(['like','pass','withdraw','reset']),listing:uuid.nullable()}),
 save:z.object({kind:z.enum(['listing','profile']),target:uuid,enabled:z.enum(['yes','no']).transform(x=>x==='yes')}),
 block:z.object({target:uuid,confirm:checked}),
 report:z.object({subject:uuid.nullable(),listing:uuid.nullable(),message:uuid.nullable(),category:z.enum(['scam','harassment','underage','stale','privacy','appeal','other']),details:plain(5,1200),also_block:checkbox}),
 message:z.object({c:uuid,body:z.string().trim().min(1).max(1500),request_key:uuid}),
 visit:z.object({c:uuid,v:uuid.nullable(),action:z.enum(['request','confirm','decline','reschedule','cancel','completed','no_show']),at_time:z.iso.datetime({local:true}).transform(v=>v.length===16?v+':00+05:30':v+'+05:30').nullable()}),
 location:z.object({c:uuid,v:uuid,location:plain(4,300).nullable()}),
 request:z.object({kind:z.enum(['delete','export','support']),details:plain(0,1200).nullable(),confirm:checkbox}).refine(v=>v.kind!=='delete'||v.confirm,{message:'Confirm account closure'}),
 moderate:z.object({kind:z.enum(['listing','profile','report','request']),target:uuid,action:plain(1,30),reason:plain(5,500)}),
 evidence:z.object({report_id:uuid,justification:plain(10,500)}),
 feedback:z.object({useful:z.enum(['yes','no']).transform(v=>v==='yes')}),
 email:z.email().max(254),
};
export const formFields=(f:FormData)=>Object.fromEntries([...f].filter(([k])=>!k.startsWith('$ACTION_')));
export const dateText=(d:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium'}).format(new Date(d));
export const timeText=(d:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(d))+' IST';
