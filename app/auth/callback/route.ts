import { NextResponse } from 'next/server';
import { server, setNeonSessionCookie } from '@/lib/db';
import { neonAuthUrl, siteUrl, useNeon } from '@/lib/env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  if (useNeon && neonAuthUrl) {
    const token = params.get('token');
    const cookie = request.headers.get('cookie') || '';
    try {
      if (token) {
        const verifyRes = await fetch(`${neonAuthUrl}/magic-link/verify?token=${encodeURIComponent(token)}`, {
          headers: { cookie },
          redirect: 'manual',
        });
        const setCookie = verifyRes.headers.get('set-cookie');
        const sessionRes = await fetch(`${neonAuthUrl}/get-session`, {
          headers: { cookie: setCookie ? `${cookie}; ${setCookie}` : cookie },
          cache: 'no-store',
        });
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          if (data?.user?.id && data?.user?.email) {
            await setNeonSessionCookie({ id: String(data.user.id), email: String(data.user.email), name: data.user.name });
            return NextResponse.redirect(new URL('/app', siteUrl), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
          }
        }
      }
      const res = await fetch(`${neonAuthUrl}/get-session`, { headers: { cookie }, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.user?.id && data?.user?.email) {
          await setNeonSessionCookie({ id: String(data.user.id), email: String(data.user.email), name: data.user.name });
          return NextResponse.redirect(new URL('/app', siteUrl), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
        }
      }
    } catch {
      // Fall through to expired
    }
    return NextResponse.redirect(new URL('/login?expired=1', siteUrl), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }

  const db = await server();
  if (db) {
    const code = params.get('code');
    if (code) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL('/app', siteUrl), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
  }
  return NextResponse.redirect(new URL('/login?expired=1', siteUrl), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
