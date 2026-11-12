import { service } from '@/lib/db';

/**
 * Daily housekeeping, called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 * Marks listings whose availability was not reconfirmed as expired. Members never see such listings anyway
 * (every read checks `expires_at`); this keeps owner and moderator views accurate.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const backend = service();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  if (!backend) return Response.json({ error: 'not configured' }, { status: 503 });
  const { data, error } = await backend.rpc('expire_rooms');
  return error ? Response.json({ error: 'failed' }, { status: 500 }) : Response.json({ expired: data });
}
