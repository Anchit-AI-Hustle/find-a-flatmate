import {NextResponse} from 'next/server';
import { server } from '@/lib/db';
import { siteUrl } from '@/lib/env';

export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const db=await server();
 if(db){
  const code=params.get('code');
  const token=params.get('token_hash');
  if(code||token){
   const {error}=code?await db.auth.exchangeCodeForSession(code):await db.auth.verifyOtp({token_hash:token!,type:'email'});
   if(!error) return NextResponse.redirect(new URL('/app',siteUrl),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
 }
 return NextResponse.redirect(new URL('/login?expired=1',siteUrl),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
