import { defineConfig } from 'vitest/config';

// Runs against a local Supabase stack: `npx supabase start`, then `npm run test:integration`.
export default defineConfig({ test: { include: ['tests/integration/**/*.test.ts'], fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 } });
