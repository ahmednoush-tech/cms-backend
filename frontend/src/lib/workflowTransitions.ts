/**
 * Transcribed exactly from
 * backend/src/common/services/workflow-transition.validator.ts
 * this session — LEAD_TRANSITIONS, OPPORTUNITY_TRANSITIONS,
 * QUOTATION_TRANSITIONS. Used ONLY to decide which status-change
 * buttons/actions to SHOW — the backend independently re-validates
 * every transition server-side regardless (this is UX, not a
 * security boundary, same philosophy as rbac/PermissionGate.tsx).
 * If a transition is attempted that the backend rejects anyway
 * (e.g. this map ever drifts out of sync), the centralized error
 * handler still surfaces the real 422 message.
 */

export const LEAD_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal: ['won', 'lost'],
  won: [],
  lost: [],
};

export const OPPORTUNITY_TRANSITIONS: Record<string, string[]> = {
  prospecting: ['qualification', 'lost'],
  qualification: ['proposal', 'lost'],
  proposal: ['negotiation', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: [],
};

export const QUOTATION_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: [],
};

/**
 * Phase 3D additions — PROJECT_TRANSITIONS, WORK_ORDER_TRANSITIONS,
 * TASK_TRANSITIONS, transcribed exactly from the same backend
 * file this session. Kept in this same shared module rather than
 * a new file, per instruction: "Use the existing workflow
 * transition definitions. Do not duplicate transition logic
 * unnecessarily."
 *
 * IMPORTANT — completion gating is NOT expressible as a transition
 * map: a Project's 'in_progress' -> 'completed' edge exists here
 * (it IS a structurally valid transition), but the backend
 * additionally rejects it with 422 if any child Work Order isn't
 * completed/cancelled yet (same for a Work Order with open Tasks)
 * — confirmed this session, no override exists. This map cannot
 * predict that business-rule outcome without an extra query the
 * scope of this phase doesn't call for, so the "Complete" action
 * is offered whenever the map allows it, and the real 422 message
 * is surfaced verbatim if the backend rejects it — never hidden,
 * never guessed at client-side.
 */
export const PROJECT_TRANSITIONS: Record<string, string[]> = {
  planning: ['approved', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const WORK_ORDER_TRANSITIONS: Record<string, string[]> = {
  new: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Soft-delete eligibility per entity — status-gated (Phase 2D), not a transition. */
export const PROJECT_DELETABLE_STATUSES = ['planning'];
export const WORK_ORDER_DELETABLE_STATUSES = ['new'];
export const TASK_DELETABLE_STATUSES = ['pending'];

/**
 * Finance F1 addition — mirrors JournalEntriesService exactly.
 * `posted` is deliberately NOT reachable from itself and has no
 * "back to draft" edge: a posted entry is immutable by design (the
 * backend's assertDraft() rejects any edit/delete once posted),
 * and the only way to reverse its effect is a new, separate
 * reversing entry — never editing history. `void` is a terminal
 * state reachable only from `posted`.
 */
export const JOURNAL_ENTRY_TRANSITIONS: Record<string, string[]> = {
  draft: ['posted'],
  posted: ['void'],
  void: [],
};

/** Lead conversion eligibility — confirmed against LeadsService.convert() this session; NOT the same as the transition map above. */
export const LEAD_CONVERTIBLE_STATUSES = ['qualified', 'proposal', 'won'];

export function getNextStates(transitions: Record<string, string[]>, current: string): string[] {
  return transitions[current] ?? [];
}
