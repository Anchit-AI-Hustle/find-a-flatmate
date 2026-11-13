import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authReady, supabaseKey, supabaseUrl, useNeon } from '@/lib/env';
import { neonAuth } from '@/lib/auth/neon';
export async function proxy(request:NextRequest) {
  if (useNeon) {
    const auth = neonAuth();
    if (!auth || !authReady) return NextResponse.next();
    if (request.nextUrl.pathname.startsWith('/api/media/')) return NextResponse.next();
    if (!request.nextUrl.searchParams.has('neon_auth_session_verifier')) return NextResponse.next();
    const response = await auth.middleware({loginUrl: '/login'})(request);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
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
export const config={matcher:['/app/:path*','/admin/:path*','/onboarding/:path*','/login','/api/media/:path*','/mobile/authorize']};
