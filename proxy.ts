import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authReady, supabaseKey, supabaseUrl } from '@/lib/env';
export async function proxy(request:NextRequest) {
  let response=NextResponse.next({request});
  if(!authReady || !request.cookies.getAll().some(c=>c.name.startsWith('sb-')&&c.name.includes('auth-token'))) return response;
  const db=createServerClient(supabaseUrl!,supabaseKey!,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll(items){
      for(const {name,value} of items) request.cookies.set(name,value);
      response=NextResponse.next({request});
      for(const {name,value,options} of items) response.cookies.set(name,value,options);
      response.headers.set('Cache-Control','private, no-store');
    },
  }});
  await db.auth.getClaims();
  return response;
}
export const config={matcher:['/app/:path*','/admin/:path*','/onboarding/:path*','/login','/api/media/:path*']};
