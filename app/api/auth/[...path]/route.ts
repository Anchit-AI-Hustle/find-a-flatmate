import { neonAuth } from '@/lib/auth/neon';

// Sign-in and sign-out start in validated server actions. The provider SDK owns
// cookie exchange and verification; keep unrelated auth endpoints private.
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const auth = neonAuth();
  const path = (await context.params).path.join('/');
  if (!auth || !['get-session', 'verify-email', 'magic-link/verify'].includes(path)) {
    return new Response(null, { status: 404 });
  }
  const response = await auth.handler().GET(request, context);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
