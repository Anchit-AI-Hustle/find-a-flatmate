import Link from 'next/link';
import { headers } from 'next/headers';
import { Art } from '@/components/site';

export const metadata = { title: 'Get the app' };
const file = (name: string) => 'https://github.com/Anchit-AI-Hustle/find-a-flatmate/releases/download/native-preview/' + name;

async function available(name: string) {
  try {
    const response = await fetch(file(name), { method: 'HEAD', next: { revalidate: 300 }, signal: AbortSignal.timeout(3500) });
    return response.ok;
  } catch { return false; }
}
export default async function GetApp() {
  // Vercel should check release availability after CI publishes the files.
  await headers();
  const [android, ios, simulator] = await Promise.all([
    available('find-a-flatmate-android.apk'),
    available('find-a-flatmate-ios.ipa'),
    available('find-a-flatmate-ios-simulator.zip'),
  ]);
  return (
    <section className="wrap stack" style={{ paddingBlock: '2.5rem 4rem' }}>
      <div className="page-title"><h1>Get Find a Flatmate</h1></div>
      <p className="muted">Use the native iPhone or Android app to find a room, compare flatmate fit, and keep track of messages and visits.</p>
      <div className="grid two">
        <article className="card stack">
          <h2>Android</h2>
          {android ? <><p>Download the Android preview APK. If prompted, allow your browser to install apps and open the downloaded file.</p><a className="btn primary" href={file('find-a-flatmate-android.apk')}>Download Android APK</a></> : <p>The Android download appears here after the build is published.</p>}
        </article>
        <article className="card stack">
          <h2>iPhone</h2>
          {ios ? <><p>This preview IPA needs a valid Apple signature before it can be installed on an iPhone. You can sign it yourself with a sideloading tool and your Apple ID.</p><a className="btn primary" href={file('find-a-flatmate-ios.ipa')}>Download unsigned iOS IPA</a></> : <p>The iPhone preview download appears here after the build is published.</p>}
          {simulator && <a className="btn" href={file('find-a-flatmate-ios-simulator.zip')}>Download iOS Simulator build</a>}
        </article>
      </div>
      <Link className="btn" href="/">Open the web app</Link>
      <Art name="together" alt="" width={640} height={400} />
    </section>
  );
}
