import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool } from '@neondatabase/serverless';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authReady, neonDbUrl, supabaseKey, supabaseUrl, useNeon } from './env';
import type { Answers, Person, Room } from './matching';
import type { Costs } from './catalog';
import { verifiedNeonUser } from './auth/neon';
import { mobileSecret, sha256 } from './auth/mobile';

let _pool: Pool | null = null;
export function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: neonDbUrl! });
  return _pool;
}

type DbError = { code?: string; message: string };
type QueryResult<T> = { data: T; error: DbError | null; count?: number | null };

function toDbError(e: unknown): DbError {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message ?? 'Database error' };
}

const resolveNeonAuth = cache(async () => {
  const user = await verifiedNeonUser();
  if (!user) return null;
  // The database only copies identity from a confirmed, non-banned Neon user.
  const { rows } = await getPool().query(
    'select private.sync_neon_identity($1::uuid) as verified_at',
    [user.id],
  );
  const verifiedAt = rows[0]?.verified_at;
  if (!(verifiedAt instanceof Date)) return null;
  return {
    id: user.id,
    email: user.email,
    email_confirmed_at: verifiedAt.toISOString(),
    created_at: user.createdAt.toISOString(),
    sessionId: user.sessionId,
  };
});

class NeonQueryBuilder<T = unknown> implements PromiseLike<QueryResult<T>> {
  private _table: string;
  private _selectCols = '*';
  private _countExact = false;
  private _headOnly = false;
  private _filters: { col: string; op: string; val: unknown }[] = [];
  private _orderBy: { col: string; asc: boolean }[] = [];
  private _limitVal: number | null = null;
  private _single = false;
  private _identity: { id: string; sessionId: string } | null;
  private _role: 'authenticated' | 'anonymous' | 'service';

  constructor(table: string, identity: { id: string; sessionId: string } | null, role: 'authenticated' | 'anonymous' | 'service') {
    this._table = table;
    this._identity = identity;
    this._role = role;
  }

  select(cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    this._selectCols = cols;
    if (opts?.count === 'exact') this._countExact = true;
    if (opts?.head) this._headOnly = true;
    return this;
  }
  eq(col: string, val: unknown) { this._filters.push({ col, op: '=', val }); return this; }
  neq(col: string, val: unknown) { this._filters.push({ col, op: '<>', val }); return this; }
  gt(col: string, val: unknown) { this._filters.push({ col, op: '>', val }); return this; }
  lte(col: string, val: unknown) { this._filters.push({ col, op: '<=', val }); return this; }
  gte(col: string, val: unknown) { this._filters.push({ col, op: '>=', val }); return this; }
  in(col: string, vals: unknown[]) { this._filters.push({ col, op: 'IN', val: vals }); return this; }
  not(col: string, op: string, val: string) { this._filters.push({ col, op: `NOT_${op.toUpperCase()}`, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this._orderBy.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this._limitVal = n; return this; }
  maybeSingle<U = unknown>() { this._single = true; this._limitVal = 1; return this as unknown as NeonQueryBuilder<U | null>; }
  overrideTypes<U>() { return this as unknown as NeonQueryBuilder<U>; }

  private async exec(): Promise<QueryResult<T>> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      if (this._role !== 'service') {
        await client.query(`SET LOCAL ROLE ${this._role}`);
      }
      if (this._identity) {
        await client.query("SELECT set_config('app.current_user_id', $1, true), set_config('app.current_session_id', $2, true)", [this._identity.id, this._identity.sessionId]);
      }

      const params: unknown[] = [];
      const whereParts: string[] = [];
      const safeIdent = (s: string) => {
        if (!/^[a-zA-Z0-9_]+$/.test(s)) throw new Error(`Invalid identifier: ${s}`);
        return `"${s}"`;
      };

      for (const f of this._filters) {
        const col = safeIdent(f.col);
        if (f.op === 'IN') {
          if (!Array.isArray(f.val) || f.val.length === 0) {
            whereParts.push('FALSE');
          } else {
            params.push(f.val);
            whereParts.push(`${col} = ANY($${params.length})`);
          }
        } else if (f.op === 'NOT_IN') {
          const inner = String(f.val).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
          params.push(inner);
          whereParts.push(`NOT (${col} = ANY($${params.length}))`);
        } else {
          params.push(f.val);
          whereParts.push(`${col} ${f.op} $${params.length}`);
        }
      }

      const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
      const table = safeIdent(this._table);

      if (this._headOnly && this._countExact) {
        const cRes = await client.query(`SELECT count(*)::int AS c FROM public.${table} ${whereSql}`, params);
        await client.query('COMMIT');
        return { data: null as T, count: cRes.rows[0]?.c ?? 0, error: null };
      }

      let selectExpr = '*';
      const hasRelations = this._selectCols.includes('listing_images(') || this._selectCols.includes('listing_amenities(') || this._selectCols.includes('household_preferences(');
      if (hasRelations && this._table === 'listings') {
        selectExpr = `*,
          COALESCE((SELECT json_agg(json_build_object('id', li.id, 'created_at', li.created_at)) FROM public.listing_images li WHERE li.listing_id = listings.id), '[]'::json) AS listing_images,
          COALESCE((SELECT json_agg(json_build_object('amenity', la.amenity)) FROM public.listing_amenities la WHERE la.listing_id = listings.id), '[]'::json) AS listing_amenities,
          COALESCE((SELECT json_agg(json_build_object('dimension', hp.dimension, 'habit', hp.habit, 'expectation', hp.expectation, 'strength', hp.strength)) FROM public.household_preferences hp WHERE hp.listing_id = listings.id), '[]'::json) AS household_preferences`;
      } else if (this._selectCols !== '*') {
        const cols = this._selectCols.split(',').map((c) => c.trim()).filter((c) => /^[a-zA-Z0-9_]+$/.test(c)).map(safeIdent);
        if (cols.length) selectExpr = cols.join(', ');
      }

      const orderSql = this._orderBy.length
        ? `ORDER BY ${this._orderBy.map((o) => `${safeIdent(o.col)} ${o.asc ? 'ASC' : 'DESC'}`).join(', ')}`
        : '';
      const limitSql = this._limitVal !== null ? `LIMIT ${Number(this._limitVal)}` : '';

      const res = await client.query(`SELECT ${selectExpr} FROM public.${table} ${whereSql} ${orderSql} ${limitSql}`, params);
      await client.query('COMMIT');

      if (this._single) {
        return { data: (res.rows[0] ?? null) as T, error: null };
      }
      return { data: res.rows as T, count: this._countExact ? res.rows.length : undefined, error: null };
    } catch (e: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      return { data: null as T, error: toDbError(e) };
    } finally {
      client.release();
    }
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function createNeonDbClient(identity: { id: string; sessionId: string } | null, role: 'authenticated' | 'anonymous' | 'service') {
  return {
    from(table: string) {
      return new NeonQueryBuilder(table, identity, role);
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      const execRpc = async (): Promise<{ data: unknown; error: DbError | null }> => {
        if (!/^[a-zA-Z0-9_]+$/.test(name)) return { data: null, error: { message: 'Invalid RPC' } };
        const client = await getPool().connect();
        try {
          await client.query('BEGIN');
          if (role !== 'service') await client.query(`SET LOCAL ROLE ${role}`);
          if (identity) await client.query("SELECT set_config('app.current_user_id', $1, true), set_config('app.current_session_id', $2, true)", [identity.id, identity.sessionId]);

          const keys = Object.keys(args).filter((k) => args[k] !== undefined);
          const params = keys.map((k) => args[k]);
          const argList = keys.map((k, i) => {
            if (!/^[a-z][a-z0-9_]*$/.test(k)) throw new Error('Invalid RPC argument');
            return `${k} => $${i + 1}`;
          }).join(', ');
          const meta = await client.query(
            `SELECT proretset FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1 LIMIT 1`,
            [name]
          );
          const isSet = meta.rows[0]?.proretset === true;
          const sql = isSet ? `SELECT * FROM public.${name}(${argList})` : `SELECT public.${name}(${argList}) AS res`;
          const res = await client.query(sql, params);
          await client.query('COMMIT');
          return { data: isSet ? res.rows : (res.rows[0]?.res ?? null), error: null };
        } catch (e: unknown) {
          await client.query('ROLLBACK').catch(() => {});
          return { data: null, error: toDbError(e) };
        } finally {
          client.release();
        }
      };
      const p = execRpc() as Promise<{ data: unknown; error: DbError | null }> & {
        overrideTypes: <U>() => Promise<{ data: U; error: DbError | null }>;
      };
      p.overrideTypes = <U>() => p as Promise<{ data: U; error: DbError | null }>;
      return p;
    },
    storage: {
      from(bucketId: string) {
        return {
          async upload(path: string, fileBody: Buffer | Uint8Array | ArrayBuffer, opts?: { contentType?: string }) {
            try {
              const buf = Buffer.isBuffer(fileBody) ? fileBody : Buffer.from(fileBody instanceof ArrayBuffer ? new Uint8Array(fileBody) : fileBody);
              await getPool().query(
                `INSERT INTO ff_storage.objects (bucket_id, name, data, mime_type)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (bucket_id, name) DO UPDATE SET data = EXCLUDED.data, mime_type = EXCLUDED.mime_type`,
                [bucketId, path, buf, opts?.contentType || 'image/webp']
              );
              return { data: { path }, error: null };
            } catch (e: unknown) {
              return { data: null, error: toDbError(e) };
            }
          },
          async download(path: string) {
            try {
              const res = await getPool().query(
                `SELECT data, mime_type FROM ff_storage.objects WHERE bucket_id = $1 AND name = $2 LIMIT 1`,
                [bucketId, path]
              );
              const row = res.rows[0] as { data?: Buffer; mime_type?: string } | undefined;
              if (!row?.data) return { data: null, error: { message: 'Not found' } };
              return { data: new Blob([new Uint8Array(row.data)], { type: row.mime_type || 'image/webp' }), error: null };
            } catch (e: unknown) {
              return { data: null, error: toDbError(e) };
            }
          },
          async list(prefix: string) {
            try {
              const res = await getPool().query(
                `SELECT name FROM ff_storage.objects WHERE bucket_id = $1 AND name LIKE $2`,
                [bucketId, `${prefix}%`]
              );
              const seen = new Set<string>();
              for (const r of res.rows as { name: string }[]) {
                const rel = String(r.name).slice(prefix.replace(/^\//, '').length).replace(/^\//, '');
                const seg = rel.split('/')[0];
                if (seg) seen.add(seg);
              }
              return { data: Array.from(seen).map((name) => ({ name })), error: null };
            } catch (e: unknown) {
              return { data: [], error: toDbError(e) };
            }
          },
          async remove(paths: string[]) {
            if (!paths.length) return { data: [], error: null };
            await getPool().query(`DELETE FROM ff_storage.objects WHERE bucket_id = $1 AND name = ANY($2::text[])`, [bucketId, paths]);
            return { data: paths, error: null };
          },
        };
      },
    },

  };
}

export const server = cache(async () => {
  if (!authReady) return null;
  if (useNeon) {
    const u = await resolveNeonAuth();
    return createNeonDbClient(u, u ? 'authenticated' : 'anonymous') as unknown as SupabaseClient;
  }
  const jar = await cookies();
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        try {
          for (const { name, value, options } of items) jar.set(name, value, options);
        } catch {
          /* Proxy handles refresh during render. */
        }
      },
    },
  });
});

export const service = () => {
  if (useNeon) return createNeonDbClient(null, 'service') as unknown as SupabaseClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return supabaseUrl && key ? createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
};

export const session = cache(async () => {
  if (!authReady) return null;
  if (useNeon) {
    const bearer = (await headers()).get('authorization');
    if (bearer?.startsWith('Bearer ')) {
      const token = mobileSecret.safeParse(bearer.slice(7));
      if (!token.success) return null;
      const { rows } = await getPool().query(
        `select u.id,u.email,u.email_confirmed_at,u.created_at,ns.id as "sessionId"
         from private.mobile_sessions ms join ff_auth.users u on u.id=ms.user_id
         join neon_auth."session" ns on ns.id=ms.provider_session_id and ns."userId"=u.id
         join neon_auth."user" nu on nu.id=u.id
         where ms.token_hash=$1 and ms.expires_at>now() and ns."expiresAt">now()
          and ns."impersonatedBy" is null and nu."emailVerified" and not coalesce(nu.banned,false)`,
        [sha256(token.data)],
      );
      const user = rows[0] as { id:string; email:string; email_confirmed_at:Date; created_at:Date; sessionId:string } | undefined;
      return user ? { user: { ...user, created_at:user.created_at.toISOString(), email_confirmed_at:user.email_confirmed_at.toISOString() },
        db: createNeonDbClient(user, 'authenticated') as unknown as SupabaseClient } : null;
    }
    const user = await resolveNeonAuth();
    return user ? { user, db: createNeonDbClient(user, 'authenticated') as unknown as SupabaseClient } : null;
  }
  const db = await server();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  return user?.email_confirmed_at ? { user, db } : null;
});

export type Profile = {
  id: string; display_name: string; city_id: string; localities: string[]; budget_min: number; budget_max: number;
  move_from: string; move_until: string; stay_months: number; intent: string; status: string; discoverable: boolean;
};
export type Candidate = Omit<Profile, 'status' | 'discoverable'> & { email_verified: boolean; answers: Answers };
export type PublicRoom = Costs & {
  id: string; title: string; city_id: string; locality_id: string; room_type: string;
  available_from: string; available_until: string; reviewed_at: string | null; confirmed_at: string | null;
};
export type Listing = PublicRoom & {
  owner_id: string; description: string; building: string; furnishing: string; bath_sharing: string; rooms: number; bathrooms: number;
  occupants: number; capacity: number; poster_type: string; transport: string; restrictions: string; min_months: number;
  status: string; expires_at: string | null; monthly: number; created_at: string;
  listing_amenities?: { amenity: string }[];
  listing_images?: { id: string }[];
  household_preferences?: AnswerRow[];
};
export type AnswerRow = { dimension: string; habit: string | null; expectation: string | null; strength: 'flexible' | 'preference' | 'dealbreaker' };
export type Thread = { id: string; other_id: string; display_name: string; unread: number; activity: string };
export type Message = { id: string; sender_id: string; body: string; suspicious: boolean; created_at: string };
export type Visit = { id: string; conversation_id: string; proposer_id: string; requester_id: string; starts_at: string; status: string };
export type Interest = { actor_id: string; target_id: string; status: string };

export const profile = cache(async () => {
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.db.from('profiles').select('*').eq('id', s.user.id).maybeSingle<Profile>();
  if (error) throw new Error('Unable to load your profile');
  return data;
});

export async function requireSession() {
  const s = await session();
  if (!s) redirect('/login');
  return s;
}

export async function requireProfile() {
  const s = await requireSession();
  const p = await profile();
  if (!p) redirect(/^(looking_for_room|have_room|find_together)$/.test((await cookies()).get('ff_intent')?.value ?? '') ? '/onboarding/basics' : '/onboarding/intent');
  if (p.status === 'draft') {
    const { data } = await s.db.from('onboarding_progress').select('step').eq('user_id', s.user.id).maybeSingle<{ step: string }>();
    redirect(data?.step === 'preferences' ? '/onboarding/preferences' : '/onboarding/lifestyle');
  }
  if (p.status === 'suspended' || p.status === 'closed') redirect('/app/settings/data');
  return { ...s, profile: p };
}

export async function requireModerator() {
  const s = await requireSession();
  const { data } = await s.db.rpc('is_moderator');
  return data === true ? s : null;
}

export function person(row: Profile | Candidate, answers: Answers): Person {
  return { id: row.id, city: row.city_id, areas: row.localities, budgetMin: row.budget_min, budgetMax: row.budget_max, from: row.move_from, until: row.move_until, months: row.stay_months, answers };
}
export function answerMap(rows: AnswerRow[]): Answers {
  return Object.fromEntries(rows.map((r) => [r.dimension, { habit: r.habit ?? undefined, want: r.expectation ?? undefined, strength: r.strength }]));
}
export const expandedListing = '*,listing_images(id),listing_amenities(amenity),household_preferences(dimension,habit,expectation,strength)';

export async function rooms(city: string, locality?: string, id?: string) {
  const db = await server();
  if (!db) return null;
  const { data, error } = await db.rpc('public_rooms', { city, locality, room_id: id }).overrideTypes<PublicRoom[], { merge: false }>();
  return error ? null : data;
}

export const publicDb = () => {
  if (useNeon) return createNeonDbClient(null, 'anonymous') as unknown as SupabaseClient;
  return supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
};

export async function inventory(): Promise<Record<string, number> | null> {
  const db = publicDb();
  if (!db) return null;
  const { data, error } = await db.rpc('public_inventory');
  if (error || !Array.isArray(data)) return null;
  return Object.fromEntries((data as { city_id: string; live_rooms: number }[]).map((r) => [r.city_id, Number(r.live_rooms)]));
}

export async function publicRooms(city?: string, locality?: string, id?: string): Promise<PublicRoom[] | null> {
  const db = publicDb();
  if (!db) return null;
  const { data, error } = await db.rpc('public_rooms', { city, locality, room_id: id });
  return error ? null : ((data ?? []) as PublicRoom[]);
}

export async function me() {
  const s = await requireProfile();
  const { data } = await s.db.rpc('own_answers');
  const answers = (data ?? {}) as Answers;
  return { ...s, answers, person: person(s.profile, answers) };
}

export function room(l: Listing): Room {
  return {
    ownerId: l.owner_id, city: l.city_id, areas: [l.locality_id], from: l.available_from, until: l.available_until, months: l.min_months,
    costs: { rent: l.rent, maintenance: l.maintenance, utilities: l.utilities, recurring: l.recurring, deposit: l.deposit, brokerage: l.brokerage, fees: l.fees }, rules: answerMap(l.household_preferences ?? []),
  };
}

export async function pendingRequests(s: NonNullable<Awaited<ReturnType<typeof session>>>): Promise<Interest[]> {
  const { data } = await s.db.from('interests').select('actor_id,target_id,status').order('updated_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as Interest[];
  const declined = new Set(rows.filter((r) => r.actor_id === s.user.id && r.status === 'passed').map((r) => r.target_id));
  return rows.filter((r) => r.target_id === s.user.id && r.status === 'sent' && !declined.has(r.actor_id));
}
