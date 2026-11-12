'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authReady,siteUrl } from './env';
import { server,session,service } from './db';
import { forms,formFields,readAnswers,uuid } from './validate';
import { z } from 'zod';
import sharp from 'sharp';
import {createHash,randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';

export type State={error?:string;success?:string;evidence?:string;match?:string};
const success={success:'Saved.'};
function friendly(error:{code?:string;message:string}){
  if(error.code==='P0001') return error.message;
  if(error.code==='23505') return 'That item already exists.';
  if(error.code==='42501') return 'You don’t have access to do that.';
  return 'We couldn’t save that. Check your entries and try again.';
}
const defaultPath = '/app';
const fieldMessage=(field:unknown)=>typeof field==='string'?`Check “${field.replaceAll('_',' ')}”: the value is missing or not in the expected format.`:'Check your entries: a value is missing or not in the expected format.';
export async function selectIntent(raw:string){
  const intent=z.enum(['looking_for_room','have_room','find_together']).safeParse(raw);
  if(intent.success) (await cookies()).set('ff_intent',intent.data,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:3600,path:'/'});
  redirect(await session()?(intent.success?'/onboarding/basics?intent='+intent.data:'/onboarding/basics'):'/login');
}
export async function login(_:State,f:FormData):Promise<State>{
 const db=await server(), email=forms.email.safeParse(f.get('email'));
 if(!authReady||!db) return {error:'Email sign-in is not configured yet.'};
 if(!email.success) return {error:'Enter a valid email address.'};
 const {error}=await db.auth.signInWithOtp({email:email.data,options:{emailRedirectTo:new URL('/auth/callback',siteUrl).href}});
 if(error) return {error:error.status===429?'Too many attempts. Try again later.':'We couldn’t send a sign-in link. Please try again later.'};
 return {success:'Check your email for a sign-in link. Open it in this browser to continue.'};
}
export async function logout(){
 const db=await server();
 if(db) await db.auth.signOut({scope:'local'});
 redirect('/');
}
function parse<T extends z.ZodType>(schema:T,f:FormData,nullable:string[]=[],extra:Record<string,unknown>={}):z.output<T>{
 const vals:Record<string,FormDataEntryValue|null>=formFields(f);
 for(const key of nullable) if(!vals[key]) vals[key]=null;
 return schema.parse({...vals,...extra});
}
/** Best-effort removal of a closing member's stored listing photos (the files, not only the rows). */
async function removePhotos(owner:string){
 const backend=service();
 if(!backend) return;
 const bucket=backend.storage.from('room-photos');
 const {data:folders}=await bucket.list(owner,{limit:100});
 for(const folder of folders??[]){
  const {data:files}=await bucket.list(owner+'/'+folder.name,{limit:100});
  if(files?.length) await bucket.remove(files.map(f=>owner+'/'+folder.name+'/'+f.name));
 }
}
export type Op='basics'|'lifestyle'|'privacy'|'listing'|'listingState'|'interest'|'save'|'block'|'report'|'message'|'visit'|'location'|'request'|'moderate'|'evidence'|'waitlist'|'feedback'|'found'|'upload'|'removePhoto';
export async function action(op:Op, _:State,f:FormData):Promise<State>{
 const auth=await session();
 if(!auth) return {error:'Sign in again to continue.'};
 const {db,user}=auth;
 let next:string|undefined;
 let result:State=success;
 const rpc=async(name:string,args?:Record<string,unknown>)=>{
  const {data,error}=await db.rpc(name,args);
  if(error) throw new Error(friendly(error));
  return data as unknown;
 };
 try{
  switch(op){
  case 'basics': await rpc('save_basics',{v:parse(forms.basics,f,[],{areas:f.getAll('areas')})});(await cookies()).delete('ff_intent'); next=f.get('editing')==='yes'?'/app/profile':'/onboarding/lifestyle';break;
  case 'lifestyle': await rpc('save_lifestyle',{answers:readAnswers(f)});next=f.get('editing')==='yes'?'/app/profile':'/onboarding/preferences';break;
  case 'privacy': await rpc('save_privacy',{v:parse(forms.privacy,f,['discoverable','analytics','reminders','status'])});if(f.get('onboarding')==='yes') next='/onboarding/complete';break;
  case 'listing':{
   const {id,...data}=parse(forms.listing,f,['id'],{amenities:f.getAll('amenities')});
   const saved=uuid.parse(await rpc('save_listing',{l:id,v:{...data,rules:readAnswers(f)}}));
   if(!id) next='/app/listings/'+saved+'/edit';
   result={success:'Draft saved. Submit it for review when ready.'};
   break;
  }
  case 'listingState':{const {id,action}=parse(forms.listingState,f);await rpc('listing_transition',{l:id,action});break;}
  case 'interest':{const p=parse(forms.interest,f,['listing']); const c=await rpc('interest_transition',p);const chat=c?uuid.parse(c):undefined;
   // The swipe deck stays on the page and shows the match itself; other screens go straight to the chat.
   if(chat&&f.get('stay')!=='yes')next='/app/messages/'+chat;result={success:p.action==='like'?'Interest sent. Chat opens when you both opt in.':'Connection preferences updated.',match:chat};break;}
  case 'save': await rpc('save_item',parse(forms.save,f));break;
  case 'block':{const {target}=parse(forms.block,f);await rpc('block_account',{target});next='/app/matches';break;}
  case 'report':{const p=parse(forms.report,f,['subject','listing','message','also_block']);await rpc('file_report',p);if(p.also_block) next='/app/matches';result={success:'Report received. Moderators can review it.'};break;}
  case 'message':await rpc('send_message',parse(forms.message,f));result={success:'Message sent.'};break;
  case 'visit':await rpc('visit_transition',parse(forms.visit,f,['v','at_time']));result={success:'Visit updated.'};break;
  case 'location':await rpc('visit_location',parse(forms.location,f,['location']));break;
  case 'request':{const {kind,details}=parse(forms.request,f,['details','confirm']);await rpc('data_request',{kind,details});if(kind==='delete') await removePhotos(user.id);result={success:kind==='delete'?'Account closed. A deletion request is in the privacy queue.':'Your request is in the support queue.'};break;}
  case 'moderate':await rpc('moderate',parse(forms.moderate,f));break;
  case 'evidence':{const body=await rpc('review_reported_message',parse(forms.evidence,f));result={success:'Evidence access was recorded.',evidence:z.string().parse(body)};break;}
  case 'waitlist': await rpc('join_waitlist');result={success:'You’re on the waitlist for this city. We don’t send alerts yet.'};break;
  case 'feedback':await rpc('match_feedback',parse(forms.feedback,f));result={success:'Thanks for the feedback.'};break;
  case 'found':await rpc('track_product_event',{event_name:'home_found_self_reported'});result={success:'Outcome recorded if you opted into analytics.'};break;
  case 'upload':{
   const backend=service();
   if(!backend) return {error:'Photo uploads are not configured.'};
   const l=uuid.parse(f.get('id')), file=f.get('photo');
   if(f.get('permission')!=='on'||!(file instanceof File)||file.size<10||file.size>2_500_000||!['image/jpeg','image/png','image/webp'].includes(file.type)) return {error:'Choose a JPG, PNG or WebP under 2.5 MB and confirm permission.'};
   const {data:owner}=await db.from('listings').select('id').eq('id',l).eq('owner_id',user.id).eq('status','draft').maybeSingle();
   if(!owner) return {error:'Only draft listings you own accept photos.'};
   let bytes:Buffer;
   try{
    const img=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:20_000_000,failOn:'warning'});
    const meta=await img.metadata();
    if(!['jpeg','png','webp'].includes(meta.format??'')||(meta.pages??1)!==1) throw new Error();
    bytes=await img.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();
   }catch{return {error:'That file could not be read as a supported photo.'};}
   if(bytes.byteLength>750_000) return {error:'Choose a smaller photo.'};
   const p=user.id+'/'+l+'/'+randomUUID()+'.webp';
   const bucket=backend.storage.from('room-photos');
   const {error:uploadError}=await bucket.upload(p,bytes,{contentType:'image/webp',upsert:false});
   if(uploadError) return {error:'Photo could not be uploaded.'};
   const {error:attachError}=await backend.rpc('attach_sanitized_photo',{u:user.id,l,p,d:createHash('sha256').update(bytes).digest('hex')});
   if(attachError){await bucket.remove([p]);return {error:friendly(attachError)};}
   result={success:'Photo added. Embedded metadata was removed.'};
   break;
  }
  case 'removePhoto':{
   const backend=service();
   if(!backend) return {error:'Photo uploads are not configured.'};
   const {data,error}=await backend.rpc('detach_sanitized_photo',{u:user.id,i:uuid.parse(f.get('id'))});
   if(error) return {error:friendly(error)};
   if(typeof data==='string') await backend.storage.from('room-photos').remove([data]);
   break;
  }
  default:return {error:'Unknown action.'};
  }
 }catch(e){
   return {error:e instanceof z.ZodError ? (e.issues[0]?.code==='custom'&&e.issues[0].message!=='Invalid input'?e.issues[0].message:fieldMessage(e.issues[0]?.path[0])) : e instanceof Error?e.message:'Something went wrong. Try again.'};
 }
 revalidatePath(defaultPath,'layout');
 revalidatePath('/admin');
 if(next) redirect(next);
 return result;
}
