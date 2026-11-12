import { Brand } from '@/components/site';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-head"><div className="wrap"><Brand /></div></header>
      <main id="main" className="narrow section">{children}</main>
    </>
  );
}
