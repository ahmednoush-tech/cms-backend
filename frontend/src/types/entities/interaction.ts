export type InteractionType = 'call' | 'meeting' | 'email' | 'note' | 'other';

export interface Interaction {
  id: string;
  companyId: string;
  customerId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  type: InteractionType;
  subject: string;
  notes: string | null;
  interactionDate: string;
  outcome: string | null;
  followUpDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser?: { id: string; email: string };
}

/**
 * Exactly one of customerId/leadId/opportunityId is supplied by
 * each calling context (a customer's own interaction log always
 * sends customerId, a lead's always sends leadId, etc.) — the
 * backend allows any combination, but the frontend never asks
 * the user to pick more than the one they're already looking at.
 */
export interface CreateInteractionInput {
  customerId?: string;
  leadId?: string;
  opportunityId?: string;
  type: InteractionType;
  subject: string;
  notes?: string;
  interactionDate: string;
  outcome?: string;
  followUpDate?: string;
}

export interface UpdateInteractionInput {
  type?: InteractionType;
  subject?: string;
  notes?: string;
  interactionDate?: string;
  outcome?: string;
  followUpDate?: string;
}
