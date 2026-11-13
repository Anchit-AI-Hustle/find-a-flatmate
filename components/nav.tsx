'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, CalendarDays, Compass, Handshake, Home, KeyRound, MessageCircle, Settings, ShieldAlert, UserRound } from 'lucide-react';

const tabs = [
  { href: '/app', label: 'Home', icon: Home },
  { href: '/app/discover', label: 'Discover', icon: Compass },
  { href: '/app/matches', label: 'Matches', icon: Handshake },
  { href: '/app/messages', label: 'Chats', icon: MessageCircle },
  { href: '/app/profile', label: 'You', icon: UserRound },
];
const more = [
  { href: '/app/visits', label: 'Visits', icon: CalendarDays },
  { href: '/app/saved', label: 'Saved', icon: Bookmark },
  { href: '/app/listings', label: 'My listings', icon: KeyRound },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];
const active = (path: string, href: string) => (href === '/app' ? path === '/app' : path === href || path.startsWith(href + '/'));

export function TabBar({ unread, requests }: { unread: number; requests: number }) {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="App">
      {tabs.map(({ href, label, icon: Icon }) => {
        const count = href === '/app/messages' ? unread : href === '/app/matches' ? requests : 0;
        return (
          <Link key={href} href={href} prefetch={false} aria-current={active(path, href) ? 'page' : undefined}>
            <Icon size={22} aria-hidden="true" />{label}
            {count ? <span className="badge">{count > 9 ? '9+' : count}<span className="sr"> new</span></span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
export function SideNav({ unread, requests, moderator }: { unread: number; requests: number; moderator: boolean }) {
  const path = usePathname();
  return (
    <>
      {[...tabs.slice(0, 4), ...more.slice(0, 3), tabs[4], more[3]].map(({ href, label, icon: Icon }) => {
        const count = href === '/app/messages' ? unread : href === '/app/matches' ? requests : 0;
        return (
          <Link key={href} className="nav" href={href} prefetch={false} aria-current={active(path, href) ? 'page' : undefined}>
            <Icon size={19} aria-hidden="true" />{label === 'You' ? 'Profile' : label === 'Chats' ? 'Messages' : label}
            {count ? <span className="count">{count}<span className="sr"> new</span></span> : null}
          </Link>
        );
      })}
      {moderator ? <Link className="nav" href="/admin" prefetch={false}><ShieldAlert size={19} aria-hidden="true" />Moderation</Link> : null}
    </>
  );
}
