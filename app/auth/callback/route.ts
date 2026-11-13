import { NextResponse } from 'next/server';
import { server } from '@/lib/db';
import { siteUrl, useNeon } from '@/lib/env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  if (useNeon) return NextResponse.redirect(new URL('/login?expired=1', siteUrl), {
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });

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
