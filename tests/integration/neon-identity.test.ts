import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sql } from '../support/local';

describe('Neon access migration on local Postgres', () => {
  it('requires a verified identity and a live provider session while keeping private schemas closed', () => {
    const bootstrap = readFileSync('neon/0000_neon_compat.sql', 'utf8');
    const migration = readFileSync('neon/0001_managed_identity.sql', 'utf8')
      .replace(/^begin;$/im, '').replace(/^commit;$/im, '');
    const member = '919ce054-9d45-4ec3-a76c-e34ff31a90cb';
    const session = 'd4f269de-bd99-4c30-b8f2-a6fd7eb9391d';
    expect(sql(`begin;
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anonymous') then create role anonymous nologin; end if;
      end $$;
      ${bootstrap}
      create schema neon_auth;
      create table neon_auth."user" (id uuid primary key, email text, "emailVerified" boolean, banned boolean, "createdAt" timestamptz);
      create table neon_auth."session" (id uuid, "userId" uuid, "expiresAt" timestamptz, "impersonatedBy" uuid);
      ${migration}
      insert into neon_auth."user" values ('${member}', 'local-neon@example.test', false, false, now());
      insert into neon_auth."session" values ('${session}', '${member}', now()+interval '1 hour', null);
      do $$ begin
        if private.sync_neon_identity('${member}') is not null then raise exception 'unverified identity synced'; end if;
        if has_table_privilege('authenticated','ff_auth.users','SELECT') then raise exception 'identity readable'; end if;
        if has_table_privilege('anonymous','ff_storage.objects','SELECT') then raise exception 'media readable'; end if;
        if has_table_privilege('authenticated','private.mobile_sessions','SELECT') then raise exception 'native tokens readable'; end if;
        if not has_function_privilege('anonymous','public.public_inventory()','EXECUTE') then raise exception 'public inventory unavailable'; end if;
      end $$;
      update neon_auth."user" set "emailVerified"=true;
      do $$ begin
        if private.sync_neon_identity('${member}') is null then raise exception 'verified identity did not sync'; end if;
      end $$;
      set local role authenticated;
      set local app.current_user_id='${member}';
      do $$ begin
        if ff_auth.uid() is not null then raise exception 'actor without a session allowed'; end if;
      end $$;
      set local app.current_session_id='${session}';
      do $$ begin
        if ff_auth.uid() is distinct from '${member}'::uuid then raise exception 'active actor denied'; end if;
      end $$;
      reset role;
      delete from neon_auth."session";
      set local role authenticated;
      do $$ begin
        if ff_auth.uid() is not null then raise exception 'revoked session allowed'; end if;
      end $$;
      rollback;
      select 'access checks passed';`)).toMatch(/access checks passed$/);
  });
});
