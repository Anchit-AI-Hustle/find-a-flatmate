CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS ff_auth;
CREATE SCHEMA IF NOT EXISTS ff_storage;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS ff_auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION ff_auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS ff_storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS ff_storage.objects (
  bucket_id text NOT NULL REFERENCES ff_storage.buckets(id) ON DELETE CASCADE,
  name text NOT NULL,
  data bytea,
  mime_type text DEFAULT 'image/webp',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id, name)
);

GRANT USAGE ON SCHEMA public, private, ff_auth, ff_storage TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ff_storage TO authenticated, anon;
GRANT SELECT ON ff_auth.users TO authenticated, anon;
