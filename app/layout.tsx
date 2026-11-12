import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './globals.css';
import { siteUrl } from '@/lib/env';
import { Pwa } from '@/components/pwa';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Find a Flatmate — find someone you can actually live with', template: '%s · Find a Flatmate' },
  description: 'Flatmate and room matching for Gurugram and Noida. Compare lifestyles, see the full monthly cost, chat only after you both opt in, and plan a visit safely.',
  applicationName: 'Find a Flatmate',
  appleWebApp: { capable: true, title: 'Flatmate', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: { type: 'website', siteName: 'Find a Flatmate', locale: 'en_IN', images: ['/art/hero.webp'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fbf9f5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
