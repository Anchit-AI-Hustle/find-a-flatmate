import {NextResponse} from 'next/server';
import { server } from '@/lib/db';
import { siteUrl } from '@/lib/env';

export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const db=await server();
 if(db){
  // PKCE only: the code is useless without the verifier cookie set in the browser that asked for the link,
  // which prevents signing someone in to another person's account with a forwarded link.
  const code=params.get('code');
  if(code){
   const {error}=await db.auth.exchangeCodeForSession(code);
   if(!error) return NextResponse.redirect(new URL('/app',siteUrl),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
 }
 return NextResponse.redirect(new URL('/login?expired=1',siteUrl),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
