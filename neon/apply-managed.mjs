// Apply the additive Neon-only migration over verified TLS without printing credentials.
import { spawnSync } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
Object.assign(env, {
  PGHOST: url.hostname,
  PGDATABASE: url.pathname.slice(1),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: 'verify-full',
  PGSSLROOTCERT: 'system',
  PGCONNECT_TIMEOUT: '15',
});
const flags = process.argv.slice(2);
if (!flags.length) flags.push('-f', 'neon/0001_managed_identity.sql');
const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', ...flags], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
