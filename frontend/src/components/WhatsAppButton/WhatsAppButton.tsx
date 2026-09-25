import { useTranslation } from 'react-i18next';
import { buildWhatsAppLink } from '../../lib/buildWhatsAppLink';

interface WhatsAppButtonProps {
  phone: string | null | undefined;
  message?: string;
}

/**
 * Opens a pre-filled WhatsApp conversation for a staff member to
 * send manually — never sends anything automatically (see
 * buildWhatsAppLink.ts's comment for why: no official WhatsApp
 * Business API is connected to this deployment).
 */
export function WhatsAppButton({ phone, message }: WhatsAppButtonProps) {
  const { t } = useTranslation(['common']);
  const link = buildWhatsAppLink(phone, message);

  if (!link) return null;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11a16.5 16.5 0 01-1.6-.6c-2.82-1.22-4.66-4.06-4.8-4.25-.14-.19-1.15-1.53-1.15-2.92s.72-2.07.98-2.35c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.24.58.81 2 .88 2.15.07.15.11.32.02.5-.09.19-.14.3-.28.46-.14.16-.29.36-.42.48-.14.14-.28.28-.12.55.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.61-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.32.07.12.07.65-.16 1.32z" />
      </svg>
      {t('common:action.contactViaWhatsapp')}
    </a>
  );
}
