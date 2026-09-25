import { describe, it, expect } from 'vitest';
import {
  LEAD_TRANSITIONS,
  OPPORTUNITY_TRANSITIONS,
  QUOTATION_TRANSITIONS,
  PROJECT_TRANSITIONS,
  WORK_ORDER_TRANSITIONS,
  TASK_TRANSITIONS,
  PROJECT_DELETABLE_STATUSES,
  WORK_ORDER_DELETABLE_STATUSES,
  TASK_DELETABLE_STATUSES,
  LEAD_CONVERTIBLE_STATUSES,
  getNextStates,
} from '../workflowTransitions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Proves these maps match the backend's actual
 * WorkflowTransitionValidator maps exactly (transcribed this
 * session), since any drift here would show a UI action that the
 * backend would then reject with 422.
 */
describe('workflowTransitions', () => {
  it('LEAD_TRANSITIONS matches the backend exactly', () => {
    expect(LEAD_TRANSITIONS).toEqual({
      new: ['contacted', 'lost'],
      contacted: ['qualified', 'lost'],
      qualified: ['proposal', 'lost'],
      proposal: ['won', 'lost'],
      won: [],
      lost: [],
    });
  });

  it('OPPORTUNITY_TRANSITIONS matches the backend exactly', () => {
    expect(OPPORTUNITY_TRANSITIONS).toEqual({
      prospecting: ['qualification', 'lost'],
      qualification: ['proposal', 'lost'],
      proposal: ['negotiation', 'lost'],
      negotiation: ['won', 'lost'],
      won: [],
      lost: [],
    });
  });

  it('QUOTATION_TRANSITIONS matches the backend exactly, with three terminal states reachable only from sent', () => {
    expect(QUOTATION_TRANSITIONS.draft).toEqual(['sent']);
    expect(QUOTATION_TRANSITIONS.sent).toEqual(['accepted', 'rejected', 'expired']);
    expect(QUOTATION_TRANSITIONS.accepted).toEqual([]);
    expect(QUOTATION_TRANSITIONS.rejected).toEqual([]);
    expect(QUOTATION_TRANSITIONS.expired).toEqual([]);
  });

  it('getNextStates returns an empty array for a terminal state, never undefined', () => {
    expect(getNextStates(LEAD_TRANSITIONS, 'won')).toEqual([]);
    expect(getNextStates(QUOTATION_TRANSITIONS, 'accepted')).toEqual([]);
  });

  it('getNextStates returns an empty array for an unrecognized status rather than throwing', () => {
    expect(getNextStates(LEAD_TRANSITIONS, 'not_a_real_status')).toEqual([]);
  });

  it('LEAD_CONVERTIBLE_STATUSES matches the backend eligibility check exactly (qualified, proposal, won)', () => {
    expect(LEAD_CONVERTIBLE_STATUSES).toEqual(['qualified', 'proposal', 'won']);
    expect(LEAD_CONVERTIBLE_STATUSES).not.toContain('new');
    expect(LEAD_CONVERTIBLE_STATUSES).not.toContain('contacted');
    expect(LEAD_CONVERTIBLE_STATUSES).not.toContain('lost');
  });

  // ----------------------------------------------------------
  // Phase 3D additions
  // ----------------------------------------------------------
  it('PROJECT_TRANSITIONS matches the backend exactly, including on_hold reachable only from in_progress', () => {
    expect(PROJECT_TRANSITIONS).toEqual({
      planning: ['approved', 'cancelled'],
      approved: ['in_progress', 'cancelled'],
      in_progress: ['on_hold', 'completed', 'cancelled'],
      on_hold: ['in_progress', 'cancelled'],
      completed: [],
      cancelled: [],
    });
    // on_hold must NOT be reachable directly from planning/approved
    expect(PROJECT_TRANSITIONS.planning).not.toContain('on_hold');
    expect(PROJECT_TRANSITIONS.approved).not.toContain('on_hold');
  });

  it('WORK_ORDER_TRANSITIONS matches the backend exactly', () => {
    expect(WORK_ORDER_TRANSITIONS).toEqual({
      new: ['assigned', 'cancelled'],
      assigned: ['in_progress', 'cancelled'],
      in_progress: ['on_hold', 'completed', 'cancelled'],
      on_hold: ['in_progress', 'cancelled'],
      completed: [],
      cancelled: [],
    });
  });

  it('TASK_TRANSITIONS matches the backend exactly (no on_hold state exists for tasks)', () => {
    expect(TASK_TRANSITIONS).toEqual({
      pending: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    });
    expect(Object.keys(TASK_TRANSITIONS)).not.toContain('on_hold');
  });

  it('getNextStates works identically for the three Phase 3D maps as for the Phase 3C maps', () => {
    expect(getNextStates(PROJECT_TRANSITIONS, 'completed')).toEqual([]);
    expect(getNextStates(WORK_ORDER_TRANSITIONS, 'new')).toEqual(['assigned', 'cancelled']);
    expect(getNextStates(TASK_TRANSITIONS, 'pending')).toEqual(['in_progress', 'cancelled']);
  });

  it('deletable-status lists match the Phase 2D approved design exactly (status-gated soft delete, not a transition)', () => {
    expect(PROJECT_DELETABLE_STATUSES).toEqual(['planning']);
    expect(WORK_ORDER_DELETABLE_STATUSES).toEqual(['new']);
    expect(TASK_DELETABLE_STATUSES).toEqual(['pending']);
  });
});
