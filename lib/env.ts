export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const neonDbUrl = process.env.DATABASE_URL;
export const neonAuthUrl = process.env.NEON_AUTH_BASE_URL || process.env.VITE_NEON_AUTH_URL;
export const useNeon = Boolean(neonDbUrl && !(supabaseUrl && supabaseKey));
export const authReady = Boolean((supabaseUrl && supabaseKey) || neonDbUrl);
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
