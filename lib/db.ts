import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authReady, supabaseKey, supabaseUrl } from './env';
import type { Answers, Person } from './matching';
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
  if(!p||p.status==='draft') redirect('/onboarding/intent');
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
