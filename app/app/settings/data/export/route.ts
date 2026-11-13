import { session } from '@/lib/db';

/**
 * Self-serve export. Queries run as the signed-in member, so row-level security decides what is included.
 * A scoped RPC returns the member's own sent messages after a block closes a conversation.
 */
export async function GET() {
  const auth = await session();
  if (!auth) return new Response(null, { status: 401 });
  const { db, user } = auth;
  const own = (table: string, column: string) => db.from(table).select('*').eq(column, user.id).then(r => r.data ?? []);
  const sent = await db.rpc('export_sent_messages');
  if (sent.error) return new Response('The export could not be prepared. Please try again.', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const [profile, answers, consents, notifications, verification, listings, interests, saved, visits, messages, blocks, reports, requests, waitlist] = await Promise.all([
    own('profiles', 'id'), own('user_preference_answers', 'user_id'), own('user_consents', 'user_id'), own('notification_preferences', 'user_id'), own('verification_checks', 'user_id'),
    db.from('listings').select('*,listing_amenities(amenity),household_preferences(dimension,habit,expectation,strength),listing_images(id,created_at)').eq('owner_id', user.id).then(r => r.data ?? []),
    own('interests', 'actor_id'), own('saved_items', 'user_id'), own('visit_requests', 'requester_id'), sent.data, own('blocks', 'actor_id'), own('reports', 'reporter_id'),
    own('data_subject_requests', 'user_id'), own('availability_waitlist', 'user_id'),
  ]);
  const body = JSON.stringify({ exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at }, profile, answers, consents, notifications, verification, listings, interests, saved, visits, messages_sent: messages, blocks, reports_filed: reports, requests, waitlist }, null, 2);
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="find-a-flatmate-my-data.json"', 'Cache-Control': 'private, no-store' } });
}
