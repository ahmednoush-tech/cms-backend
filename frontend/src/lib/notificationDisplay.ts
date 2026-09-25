import type { TFunction } from 'i18next';
import type { AppNotification } from '../types/entities/notification';

/**
 * Where clicking a notification takes the user. Paths confirmed
 * against routes/index.tsx. Returns null for anything without a
 * detail page, in which case the notification is just marked read.
 */
const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  task: (id) => `/ops/tasks/${id}`,
  work_order: (id) => `/ops/work-orders/${id}`,
  project: (id) => `/ops/projects/${id}`,
  quotation: (id) => `/crm/quotations/${id}`,
  lead: (id) => `/crm/leads/${id}`,
  opportunity: (id) => `/crm/opportunities/${id}`,
  customer: (id) => `/crm/customers/${id}`,
  employee: (id) => `/admin/employees/${id}`,
  employee_iqama: (id) => `/admin/employees/${id}`,
};

export function notificationLink(n: Pick<AppNotification, 'entityType' | 'entityId'>): string | null {
  if (!n.entityType || !n.entityId) return null;
  const build = ENTITY_ROUTES[n.entityType];
  return build ? build(n.entityId) : null;
}

/**
 * The backend currently stores notification titles in English
 * ("Task Assigned", "Work Order Completed"...). For known types the
 * title is shown translated instead; anything unrecognized — and
 * 'automation_rule', whose title an admin writes themselves — falls
 * back to the stored text as-is.
 */
export function notificationTitle(t: TFunction, n: Pick<AppNotification, 'type' | 'title'>): string {
  if (n.type === 'automation_rule') return n.title;
  return t(`notifications:type.${n.type}`, { defaultValue: n.title });
}

/** "3 minutes ago" / "منذ 3 دقائق", using the browser's own Intl support — no extra library. */
export function relativeTime(iso: string, locale: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  return new Date(iso).toLocaleDateString(locale);
}
