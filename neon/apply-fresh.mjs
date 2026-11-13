// Bootstrap a new Neon database with the canonical Postgres workflows.
// For existing databases use apply-managed.mjs instead.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const sql = readdirSync('supabase/migrations').sort().filter(name => name.endsWith('.sql'))
  .map(name => readFileSync('supabase/migrations/' + name, 'utf8')
    .replace('create schema private;', 'create schema if not exists private;')
    .replaceAll('auth.users', 'ff_auth.users').replaceAll('auth.uid()', 'ff_auth.uid()')
    .replaceAll('storage.buckets', 'ff_storage.buckets').replaceAll('storage.objects', 'ff_storage.objects'));
const bootstrap = readFileSync('neon/0000_neon_compat.sql', 'utf8');
const result = spawnSync(process.execPath, ['neon/apply-managed.mjs', '-1', '-f', '-'], {
  env: process.env, input: [bootstrap, ...sql].join('\n'), stdio: ['pipe', 'inherit', 'inherit'],
});
if (result.status !== 0) process.exit(result.status ?? 1);
const managed = spawnSync(process.execPath, ['neon/apply-managed.mjs'], { env: process.env, stdio: 'inherit' });
process.exitCode = managed.status ?? 1;
