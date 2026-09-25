import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ProductBar } from './ProductBar';
import { Drawer } from '../components/Drawer/Drawer';

/**
 * Authenticated shell. Below the `md` breakpoint the persistent
 * sidebar is hidden and replaced by a slide-over Drawer triggered
 * from Topbar's menu button (design doc section F/M) — same
 * <Sidebar> component rendered in both places, not two
 * implementations of the navigation list.
 *
 * ProductBar sits ABOVE the sidebar+content row, spanning full
 * width — it is Mizan's own identity and never changes per tenant,
 * unlike everything below it (Sidebar's logo/name, which reflects
 * whichever company is currently logged in).
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ProductBar />
      <div className="flex min-h-0 flex-1 bg-surface-muted">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <Drawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} side="start">
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </Drawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
