import { NextResponse } from 'next/server';
import { verifiedNeonUser } from '@/lib/auth/neon';
import { mobileSecret, opaqueSecret, sha256 } from '@/lib/auth/mobile';
import { getPool } from '@/lib/db';
import { siteUrl, useNeon, authReady } from '@/lib/env';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  const challenge = mobileSecret.safeParse(new URL(request.url).searchParams.get('challenge'));
  if (!useNeon || !authReady || !challenge.success) return new Response(null, { status: 400, headers });
  const user = await verifiedNeonUser();
  if (!user) {
    const login = new URL('/login', siteUrl);
    login.searchParams.set('returnTo', '/mobile/authorize?challenge=' + challenge.data);
    return NextResponse.redirect(login, { headers });
  }
  const code = opaqueSecret();
  const db = getPool();
  await db.query('select private.sync_neon_identity($1::uuid)', [user.id]);
  await db.query(
    `insert into private.mobile_auth_codes(code_hash,challenge,user_id,provider_session_id,expires_at)
     values ($1,$2,$3,$4,now()+interval '90 seconds')`,
    [sha256(code), challenge.data, user.id, user.sessionId],
  );
  await db.query('delete from private.mobile_auth_codes where expires_at<=now()');
  return NextResponse.redirect('findaflatmate://auth?code=' + code, { headers });
}
