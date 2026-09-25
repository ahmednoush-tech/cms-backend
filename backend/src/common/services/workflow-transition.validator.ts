import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Generic state-machine validator. Each entity with a workflow
 * (leads, opportunities, and later quotations/projects/work
 * orders/tasks) defines an allowed-transitions map and calls
 * `assertValidTransition` before persisting a status/stage
 * change. Invalid transitions raise 422, per the approved error
 * code mapping — this is a business-rule violation, not a
 * validation or not-found error.
 */
export class WorkflowTransitionValidator {
  static assertValidTransition(
    entityLabel: string,
    allowedTransitions: Record<string, string[]>,
    from: string,
    to: string,
  ): void {
    // Deliberately no "from === to is always a harmless no-op" shortcut
    // here (one existed previously and was removed as a real bug, caught
    // by real test execution): Quotations' send/expire/accept/reject
    // actions each call this with a fixed target status determined by
    // the action itself, so from === to for those specifically means
    // "repeating an already-completed action" (e.g. sending an
    // already-sent quotation) — which must be rejected, not silently
    // tolerated. None of the six approved transition maps list any
    // status as a valid next-state from itself, so this change has no
    // effect on the client-supplied-status endpoints (leads/
    // opportunities/projects/tasks/work-orders) either — a same-status
    // PATCH from those was never actually reachable as an allowed
    // transition regardless of this shortcut's presence.
    const allowed = allowedTransitions[from] ?? [];
    if (!allowed.includes(to)) {
      throw new UnprocessableEntityException(
        `Invalid ${entityLabel} transition: '${from}' -> '${to}'. ` +
          `Allowed from '${from}': ${allowed.length ? allowed.join(', ') : '(none — terminal state)'}.`,
      );
    }
  }
}

/** Lead: New -> Contacted -> Qualified -> Proposal -> Won/Lost */
export const LEAD_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal: ['won', 'lost'],
  won: [],
  lost: [],
};

/** Opportunity: Prospecting -> Qualification -> Proposal -> Negotiation -> Won/Lost */
export const OPPORTUNITY_TRANSITIONS: Record<string, string[]> = {
  prospecting: ['qualification', 'lost'],
  qualification: ['proposal', 'lost'],
  proposal: ['negotiation', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: [],
};

/**
 * Quotation: Draft -> Sent -> Accepted/Rejected/Expired.
 * accepted/rejected/expired are terminal — no transitions out of
 * them at all, enforced by the empty arrays below combined with
 * WorkflowTransitionValidator throwing on any 'from' not present
 * with the target in its allowed list.
 */
export const QUOTATION_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: [],
};

export const QUOTATION_TERMINAL_STATES = ['accepted', 'rejected', 'expired'];

/**
 * Project: Planning -> Approved -> In Progress -> On Hold -> Completed/Cancelled.
 * on_hold is only reachable from in_progress (not planning/approved
 * directly) — approved per Phase 2D design review.
 */
export const PROJECT_TRANSITIONS: Record<string, string[]> = {
  planning: ['approved', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const PROJECT_TERMINAL_STATES = ['completed', 'cancelled'];

/** Work Order: New -> Assigned -> In Progress -> On Hold -> Completed/Cancelled. */
export const WORK_ORDER_TRANSITIONS: Record<string, string[]> = {
  new: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const WORK_ORDER_TERMINAL_STATES = ['completed', 'cancelled'];

/**
 * Task: Pending -> In Progress -> Completed/Cancelled.
 * No 'on_hold' state exists for tasks in the approved schema,
 * unlike projects/work orders.
 */
export const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const TASK_TERMINAL_STATES = ['completed', 'cancelled'];
