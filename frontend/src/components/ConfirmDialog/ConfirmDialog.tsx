import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
  /** Distinct styling for a destructive action (delete) vs. a risky-but-not-destructive one (e.g. completing a work order). */
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

/**
 * Used before every delete action and before transitions that
 * risk a 422 the user should consciously accept trying (design
 * doc section K) — never a native window.confirm().
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-muted">{message}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                {t('action.cancel')}
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={
                variant === 'destructive'
                  ? 'rounded bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50'
                  : 'rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50'
              }
            >
              {isLoading ? t('action.processing') : t('action.confirm')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
