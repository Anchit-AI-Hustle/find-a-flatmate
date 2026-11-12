import type { Metadata, Viewport } from 'next';
import './globals.css';
import { siteUrl } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Find a Flatmate', template: '%s · Find a Flatmate' },
  description: 'India-first flatmate and room matching. Find compatible flatmates and verified rooms in Gurugram and Noida.',
  applicationName: 'Find a Flatmate',
  appleWebApp: { capable: true, title: 'Flatmate', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: { type: 'website', siteName: 'Find a Flatmate', locale: 'en_IN' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#16181d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
