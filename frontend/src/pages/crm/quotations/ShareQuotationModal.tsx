import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';

interface ShareQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicToken: string;
}

/**
 * The link this encodes is entirely unauthenticated (see
 * PublicQuotationController on the backend) — anyone with the
 * link or the QR code can view this quotation, by design. This is
 * DISTINCT from the ZATCA QR on invoices (InvoiceDetailPage),
 * which encodes compliance data, not a URL.
 */
export function ShareQuotationModal({ open, onOpenChange, publicToken }: ShareQuotationModalProps) {
  const { t } = useTranslation(['quotations', 'common']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/quote/${publicToken}`;

  useEffect(() => {
    if (open && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shareUrl, { margin: 1, width: 180 }).catch(() => {
        // Display-only concern — the link/copy button below still works even if the canvas render fails.
      });
    }
  }, [open, shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable — the link is still visible to select manually.
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('quotations:share.title')}>
      <div className="flex flex-col items-center gap-4">
        <canvas ref={canvasRef} />
        <p className="text-center text-xs text-ink-muted">{t('quotations:share.hint')}</p>
        <div className="flex w-full items-center gap-2">
          <input readOnly value={shareUrl} className="flex-1 rounded border border-border bg-surface-muted px-3 py-2 text-xs text-ink-muted" onFocus={(e) => e.target.select()} />
          <button type="button" onClick={handleCopy} className="rounded border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted">
            {copied ? t('quotations:share.copied') : t('common:action.copy')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
