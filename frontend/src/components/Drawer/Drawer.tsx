import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  side?: 'start' | 'end';
}

/**
 * Used for two purposes (design doc section B/F): detail "peek"
 * views on desktop, and the mobile navigation slide-over. `side`
 * uses logical start/end (not left/right) so it flips correctly
 * under RTL without any conditional logic here.
 */
export function Drawer({ open, onOpenChange, title, children, side = 'end' }: DrawerProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  // logical "end" = right in LTR, left in RTL — and vice versa for "start"
  const resolvedSide = side === 'end' ? (isRtl ? 'left' : 'right') : isRtl ? 'right' : 'left';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className="fixed top-0 z-50 h-full w-full max-w-sm bg-surface shadow-xl focus:outline-none"
          style={{ [resolvedSide]: 0 }}
        >
          <div className="flex h-full flex-col overflow-y-auto p-5">
            {title && <Dialog.Title className="mb-4 text-base font-semibold text-ink">{title}</Dialog.Title>}
            {!title && <Dialog.Title className="sr-only">Panel</Dialog.Title>}
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
