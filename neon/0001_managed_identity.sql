-- Neon only. Trust verified managed identity and restrict old compatibility grants.
begin;
revoke all on schema ff_auth from public,anonymous,service_role;
revoke all on ff_auth.users from public, anon, authenticated, anonymous, service_role;
revoke all on all tables in schema ff_storage from public, anon, authenticated, anonymous, service_role;
revoke usage on schema ff_storage from public, anon, authenticated, anonymous, service_role;
revoke usage on schema private from public, anon, anonymous, service_role;
grant usage on schema private,ff_auth to authenticated;
grant usage on schema ff_auth to anon;
revoke execute on function ff_auth.uid() from public,anonymous;
grant execute on function ff_auth.uid() to authenticated,anon;
-- Neon’s built-in anonymous role gets only the two public inventory RPCs.
grant usage on schema public to anonymous;
grant execute on function public.public_inventory(),public.public_rooms(text,text,uuid) to anonymous;
create or replace function private.sync_neon_identity(p_user uuid)
returns timestamptz language sql security invoker set search_path='' as $$
  insert into ff_auth.users (id,email,email_confirmed_at,created_at)
  select id,lower(email),now(), "createdAt" from neon_auth."user"
  where id=p_user and "emailVerified" and not coalesce(banned,false)
  on conflict(id) do update set email=excluded.email,
    email_confirmed_at=coalesce(ff_auth.users.email_confirmed_at,excluded.email_confirmed_at)
  returning email_confirmed_at;
$$;
revoke execute on function private.sync_neon_identity(uuid) from public,anon,authenticated,anonymous,service_role;

-- A legacy application cookie cannot authorize database reads or writes.
-- Bind identity to a live managed provider session in every scoped transaction.
create or replace function ff_auth.uid() returns uuid
language sql stable security definer set search_path='' as $$
 select n.id from neon_auth."user" n
 join neon_auth."session" s on s."userId"=n.id
 where n.id=nullif(current_setting('app.current_user_id',true),'')::uuid
 and s.id=nullif(current_setting('app.current_session_id',true),'')::uuid
 and s."expiresAt">now() and s."impersonatedBy" is null
 and n."emailVerified" and not coalesce(n.banned,false)
$$;

-- Store only the hashes of short-lived, single-use codes and native sessions.
create table if not exists private.mobile_auth_codes (
  code_hash text primary key,
  challenge text not null,
  user_id uuid not null references ff_auth.users(id) on delete cascade,
  provider_session_id uuid not null,
  expires_at timestamptz not null
);
create table if not exists private.mobile_sessions (
  token_hash text primary key,
  user_id uuid not null references ff_auth.users(id) on delete cascade,
  provider_session_id uuid not null,
  expires_at timestamptz not null
);
revoke all on private.mobile_auth_codes,private.mobile_sessions from public,anon,authenticated,anonymous,service_role;
commit;
