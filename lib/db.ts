import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authReady, supabaseKey, supabaseUrl } from './env';
import type { Answers, Person, Room } from './matching';
import type { Costs } from './catalog';

export const server = cache(async () => {
  if (!authReady) return null;
  const jar = await cookies();
  return createServerClient(supabaseUrl!,supabaseKey!, { cookies: {
    getAll:()=>jar.getAll(),
    setAll(items){try{for(const {name,value,options} of items) jar.set(name,value,options)}catch{/* Proxy handles refresh during render. */}},
  }});
});
export const service = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return supabaseUrl && key ? createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
};
export const session = cache(async () => {
  const db = await server();
  if(!db) return null;
  const {data:{user}} = await db.auth.getUser();
  return user?.email_confirmed_at ? {user,db} : null;
});
export type Profile = {
 id:string; display_name:string; city_id:string; localities:string[]; budget_min:number; budget_max:number;
 move_from:string; move_until:string; stay_months:number; intent:string; status:string; discoverable:boolean;
};
export type Candidate = Omit<Profile,'status'|'discoverable'> & {email_verified:boolean; answers:Answers};
export type PublicRoom = Costs & {
 id:string; title:string; city_id:string; locality_id:string; room_type:string;
 available_from:string; available_until:string; reviewed_at:string|null; confirmed_at:string|null;
};
export type Listing = PublicRoom & {
 owner_id:string; description:string; building:string; furnishing:string; bath_sharing:string; rooms:number; bathrooms:number;
 occupants:number; capacity:number; poster_type:string; transport:string; restrictions:string; min_months:number;
 status:string; expires_at:string|null; monthly:number; created_at:string;
 listing_amenities?:{amenity:string}[];
 listing_images?:{id:string}[];
 household_preferences?:AnswerRow[];
};
export type AnswerRow = {dimension:string; habit:string|null; expectation:string|null; strength:'flexible'|'preference'|'dealbreaker'};
export type Thread = {id:string; other_id:string; display_name:string; unread:number; activity:string};
export type Message = {id:string; sender_id:string; body:string; suspicious:boolean; created_at:string};
export type Visit = {id:string; conversation_id:string; proposer_id:string; requester_id:string; starts_at:string; status:string};
export type Interest = {actor_id:string; target_id:string; status:string};
export const profile = cache(async () => {
  const s = await session();
  if (!s) return null;
  const {data,error} = await s.db.from('profiles').select('*').eq('id',s.user.id).maybeSingle<Profile>();
  if(error) throw new Error('Unable to load your profile');
  return data;
});
export async function requireSession() {
  const s = await session();
  if(!s) redirect('/login');
  return s;
}
export async function requireProfile() {
  const s=await requireSession();
  const p=await profile();
  if(!p) redirect(/^(looking_for_room|have_room|find_together)$/.test((await cookies()).get('ff_intent')?.value??'')?'/onboarding/basics':'/onboarding/intent');
  if(p.status==='draft') {
    // Resume onboarding where the member left off.
    const {data}=await s.db.from('onboarding_progress').select('step').eq('user_id',s.user.id).maybeSingle<{step:string}>();
    redirect(data?.step==='preferences'?'/onboarding/preferences':'/onboarding/lifestyle');
  }
  if(p.status==='suspended'||p.status==='closed') redirect('/app/settings/data');
  return {...s,profile:p};
}
export async function requireModerator(){
  const s=await requireSession();
  const {data}=await s.db.rpc('is_moderator');
  return data===true ? s : null;
}
export function person(row:Profile|Candidate, answers:Answers):Person{
  return {id:row.id,city:row.city_id,areas:row.localities,budgetMin:row.budget_min,budgetMax:row.budget_max,from:row.move_from,until:row.move_until,months:row.stay_months,answers};
}
export function answerMap(rows:AnswerRow[]):Answers {
  return Object.fromEntries(rows.map(r=>[r.dimension,{habit:r.habit??undefined,want:r.expectation??undefined,strength:r.strength}]));
}
export const expandedListing='*,listing_images(id),listing_amenities(amenity),household_preferences(dimension,habit,expectation,strength)';
export async function rooms(city:string,locality?:string,id?:string) {
  const db=await server();
  if(!db) return null;
  const {data,error}=await db.rpc('public_rooms',{city,locality,room_id:id}).overrideTypes<PublicRoom[],{merge:false}>();
  return error?null:data;
}

/** Cookie-less anonymous client so public pages stay cacheable; it can only call anon-granted RPCs. */
export const publicDb = () => authReady ? createClient(supabaseUrl!,supabaseKey!,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
/** Honest live room counts per city; null when the database is not configured or unreachable. */
export async function inventory():Promise<Record<string,number>|null> {
  const db=publicDb();
  if(!db) return null;
  const {data,error}=await db.rpc('public_inventory');
  if(error||!Array.isArray(data)) return null;
  return Object.fromEntries((data as {city_id:string;live_rooms:number}[]).map(r=>[r.city_id,Number(r.live_rooms)]));
}
export async function publicRooms(city?:string,locality?:string,id?:string):Promise<PublicRoom[]|null> {
  const db=publicDb();
  if(!db) return null;
  const {data,error}=await db.rpc('public_rooms',{city,locality,room_id:id});
  return error?null:(data??[]) as PublicRoom[];
}
/** The signed-in, onboarded member with their own answers shaped for matching. */
export async function me() {
  const s=await requireProfile();
  const {data}=await s.db.rpc('own_answers');
  const answers=(data??{}) as Answers;
  return {...s,answers,person:person(s.profile,answers)};
}
export function room(l:Listing):Room {
  return {ownerId:l.owner_id,city:l.city_id,areas:[l.locality_id],from:l.available_from,until:l.available_until,months:l.min_months,
    costs:{rent:l.rent,maintenance:l.maintenance,utilities:l.utilities,recurring:l.recurring,deposit:l.deposit,brokerage:l.brokerage,fees:l.fees},rules:answerMap(l.household_preferences??[])};
}

/** Interest requests waiting for this member's answer; ones they already passed on do not count. */
export async function pendingRequests(s:NonNullable<Awaited<ReturnType<typeof session>>>):Promise<Interest[]> {
  const {data}=await s.db.from('interests').select('actor_id,target_id,status').order('updated_at',{ascending:false}).limit(200);
  const rows=(data??[]) as Interest[];
  const declined=new Set(rows.filter(r=>r.actor_id===s.user.id&&r.status==='passed').map(r=>r.target_id));
  return rows.filter(r=>r.target_id===s.user.id&&r.status==='sent'&&!declined.has(r.actor_id));
}
