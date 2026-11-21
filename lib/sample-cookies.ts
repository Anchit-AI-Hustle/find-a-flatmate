import { cookies } from 'next/headers';
import { parseSampleIds } from './samples';

/** Sample cards the member has swiped, and the ones they liked (their practice matches). Both live only in this browser. */
export async function sampleCookies() {
  const jar = await cookies();
  return { seen: parseSampleIds(jar.get('ff_samples_seen')?.value), liked: parseSampleIds(jar.get('ff_samples_liked')?.value) };
}
export async function clearSampleCookies() {
  const jar = await cookies();
  for (const name of ['ff_samples_seen', 'ff_samples_liked']) jar.delete({ name, path: '/app' });
}
