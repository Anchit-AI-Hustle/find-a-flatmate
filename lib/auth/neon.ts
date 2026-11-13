import { createNeonAuth } from '@neon/auth/next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { neonAuthUrl, siteUrl } from '@/lib/env';

export function neonAuth() {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!neonAuthUrl || !secret || secret.length < 32) return null;
  return createNeonAuth({
    baseUrl: neonAuthUrl,
    cookies: { secret, sessionDataTtl: 60 },
    logLevel: 'error',
  });
}

const verifiedUser = z.object({
  id: z.uuid(),
  email: z.email(),
  emailVerified: z.literal(true),
  name: z.string().optional(),
  createdAt: z.coerce.date(),
});

export async function verifiedNeonUser() {
  const auth = neonAuth();
  if (!auth) return null;
  const { data } = await auth.getSession({ query: { disableCookieCache: 'true' } });
  const user = verifiedUser.safeParse(data?.user).data;
  const session = z.object({ id: z.uuid(), impersonatedBy: z.string().nullish() }).safeParse(data?.session).data;
  return user && session && !session.impersonatedBy ? { ...user, sessionId: session.id } : null;
}

/** Only trust origins explicitly configured for this deployment. */
export async function authOrigin() {
  const requested = (await headers()).get('origin');
  const configured = [
    siteUrl,
    ...(process.env.AUTH_TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
  ].map((value) => new URL(value.trim()).origin);
  return requested && configured.includes(requested) ? requested : configured[0];
}

/** Neon shared Google credentials use a provider-owned relay before Google. */
export function googleRedirect(value: string, providerBaseUrl: string | undefined = neonAuthUrl) {
  try {
    const destination = new URL(value);
    if (destination.protocol !== 'https:' || destination.username || destination.password) return null;
    if (destination.origin === 'https://accounts.google.com') return destination.href;
    if (providerBaseUrl) {
      const relay = new URL(providerBaseUrl.replace(/\/$/, '') + '/sign-in/social/init');
      if (destination.origin === relay.origin && destination.pathname === relay.pathname) return destination.href;
    }
    return null;
  } catch {
    return null;
  }
}

// The managed Next.js runtime exposes this endpoint, but the SDK's inferred
// Better Auth client type omits the plugin method from signIn.
type MagicLinkOptions = {
  email: string;
  callbackURL: string;
  newUserCallbackURL: string;
  errorCallbackURL: string;
};
export function sendMagicLink(auth: NonNullable<ReturnType<typeof neonAuth>>, options: MagicLinkOptions) {
  const signIn = auth.signIn as typeof auth.signIn & {
    magicLink(input: MagicLinkOptions): Promise<{ error: { status: number } | null }>;
  };
  return signIn.magicLink(options);
}
