import { z } from 'zod';
import { getPool } from '@/lib/db';
import { authReady, useNeon } from '@/lib/env';
import { mobileSecret, opaqueSecret, sha256 } from '@/lib/auth/mobile';

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export async function POST(request: Request) {
  if (!useNeon || !authReady) return new Response(null, { status: 503, headers });
  const input = z.object({ code: mobileSecret, verifier: mobileSecret }).safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400, headers });
  const token = opaqueSecret();
  const { rowCount } = await getPool().query(
    `with used as (
       delete from private.mobile_auth_codes c
       using neon_auth."session" s, neon_auth."user" u
       where c.code_hash=$1 and c.challenge=$2 and c.expires_at>now()
       and s.id=c.provider_session_id and s."userId"=c.user_id and s."expiresAt">now()
       and s."impersonatedBy" is null and u.id=c.user_id and u."emailVerified" and not coalesce(u.banned,false)
       returning c.user_id,c.provider_session_id,s."expiresAt"
     )
     insert into private.mobile_sessions(token_hash,user_id,provider_session_id,expires_at)
     select $3,user_id,provider_session_id,least("expiresAt",now()+interval '7 days') from used`,
    [sha256(input.data.code), sha256(input.data.verifier), sha256(token)],
  );
  if (!rowCount) return new Response(null, { status: 401, headers });
  await getPool().query('delete from private.mobile_sessions where expires_at<=now()');
  return Response.json({ token }, { headers });
}

export async function DELETE(request: Request) {
  if (!useNeon || !authReady) return new Response(null, { status: 503, headers });
  const token = mobileSecret.safeParse(request.headers.get('authorization')?.replace(/^Bearer /, ''));
  if (token.success) await getPool().query('delete from private.mobile_sessions where token_hash=$1', [sha256(token.data)]);
  return new Response(null, { status: 204, headers });
}
