import { SideNav, TabBar } from '@/components/nav';
import { Brand } from '@/components/site';
import { requireSession, type Thread } from '@/lib/db';
import { logout } from '@/lib/actions';

export const metadata = { robots: { index: false } };
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user } = await requireSession();
  const [inbox, incoming, mod] = await Promise.all([
    db.rpc('inbox'),
    db.from('interests').select('actor_id', { count: 'exact', head: true }).eq('target_id', user.id).eq('status', 'sent'),
    db.rpc('is_moderator'),
  ]);
  const unread = ((inbox.data ?? []) as Thread[]).reduce((n, t) => n + Number(t.unread), 0);
  const requests = incoming.count ?? 0;
  return (
    <div className="app">
      <aside className="side" aria-label="App navigation">
        <Brand href="/app" />
        <SideNav unread={unread} requests={requests} moderator={mod.data === true} />
        <span className="spacer" />
        <form action={logout}><button className="btn small block">Sign out</button></form>
      </aside>
      <div>
        <header className="app-top"><div className="wrap"><Brand href="/app" /></div></header>
        <main id="main" className="wrap app-main">{children}</main>
      </div>
      <TabBar unread={unread} requests={requests} />
    </div>
  );
}
