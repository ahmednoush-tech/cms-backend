/**
 * Every value list below is transcribed exactly from
 * backend/src/common/services/workflow-transition.validator.ts
 * (LEAD_TRANSITIONS / OPPORTUNITY_TRANSITIONS / QUOTATION_TRANSITIONS /
 * PROJECT_TRANSITIONS / WORK_ORDER_TRANSITIONS / TASK_TRANSITIONS keys),
 * verified this session. This file is the ONLY place a raw backend
 * status/stage/priority string is mapped to a translation key or a
 * color — StatusBadge/PriorityBadge never do this inline, and no
 * other component should either, so the backend's exact vocabulary
 * can never silently drift from what's displayed.
 */

export type StatusEntity = 'lead' | 'opportunity' | 'quotation' | 'project' | 'workOrder' | 'task' | 'journalEntry' | 'invoice' | 'bill' | 'invoiceNote' | 'payrollRun' | 'purchaseOrder' | 'fixedAsset';

const VALID_VALUES: Record<StatusEntity, string[]> = {
  lead: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
  opportunity: ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'],
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
  project: ['planning', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'],
  workOrder: ['new', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'],
  task: ['pending', 'in_progress', 'completed', 'cancelled'],
  journalEntry: ['draft', 'posted', 'void'],
  invoice: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
  bill: ['draft', 'received', 'partially_paid', 'paid', 'overdue', 'cancelled'],
  invoiceNote: ['draft', 'issued', 'cancelled'],
  payrollRun: ['draft', 'processed', 'paid', 'cancelled'],
  purchaseOrder: ['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'closed', 'cancelled'],
  fixedAsset: ['active', 'fully_depreciated', 'disposed'],
};

/** Returns an i18next key under the "common" namespace, e.g. "status.project.in_progress". */
export function getStatusLabelKey(entity: StatusEntity, value: string): string {
  if (!VALID_VALUES[entity].includes(value)) {
    // Defensive: an unrecognized value from the backend (e.g. a
    // future status this frontend hasn't been updated for yet)
    // still renders something, rather than crashing the page.
    return `status.unknown`;
  }
  return `status.${entity}.${value}`;
}

/** Semantic color tier per status value — deliberately entity-aware, not one global switch. */
type ColorTier = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const COLOR_TIERS: Record<StatusEntity, Record<string, ColorTier>> = {
  lead: { new: 'neutral', contacted: 'info', qualified: 'info', proposal: 'warning', won: 'success', lost: 'danger' },
  opportunity: {
    prospecting: 'neutral',
    qualification: 'info',
    proposal: 'info',
    negotiation: 'warning',
    won: 'success',
    lost: 'danger',
  },
  quotation: { draft: 'neutral', sent: 'info', accepted: 'success', rejected: 'danger', expired: 'danger' },
  project: {
    planning: 'neutral',
    approved: 'info',
    in_progress: 'warning',
    on_hold: 'danger',
    completed: 'success',
    cancelled: 'danger',
  },
  workOrder: {
    new: 'neutral',
    assigned: 'info',
    in_progress: 'warning',
    on_hold: 'danger',
    completed: 'success',
    cancelled: 'danger',
  },
  task: { pending: 'neutral', in_progress: 'warning', completed: 'success', cancelled: 'danger' },
  journalEntry: { draft: 'neutral', posted: 'success', void: 'danger' },
  invoice: { draft: 'neutral', sent: 'warning', partially_paid: 'warning', paid: 'success', overdue: 'danger', cancelled: 'danger' },
  bill: { draft: 'neutral', received: 'warning', partially_paid: 'warning', paid: 'success', overdue: 'danger', cancelled: 'danger' },
  invoiceNote: { draft: 'neutral', issued: 'success', cancelled: 'danger' },
  payrollRun: { draft: 'neutral', processed: 'warning', paid: 'success', cancelled: 'danger' },
  purchaseOrder: {
    draft: 'neutral',
    pending_approval: 'warning',
    approved: 'info',
    rejected: 'danger',
    sent: 'info',
    closed: 'success',
    cancelled: 'danger',
  },
  fixedAsset: {
    active: 'success',
    fully_depreciated: 'neutral',
    disposed: 'danger',
  },
};

const TIER_CLASSES: Record<ColorTier, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  info: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
};

export function getStatusColor(entity: StatusEntity, value: string): string {
  const tier = COLOR_TIERS[entity][value] ?? 'neutral';
  return TIER_CLASSES[tier];
}

/**
 * Priority is a shared enum used identically by Work Orders and
 * Tasks (confirmed identical in both WorkOrderFiltersDto and
 * TaskFiltersDto this session) — one map, not two.
 */
export const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;

const PRIORITY_TIERS: Record<string, ColorTier> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

export function getPriorityLabelKey(value: string): string {
  return PRIORITY_VALUES.includes(value as (typeof PRIORITY_VALUES)[number]) ? `priority.${value}` : 'priority.unknown';
}

export function getPriorityColor(value: string): string {
  return TIER_CLASSES[PRIORITY_TIERS[value] ?? 'neutral'];
}
