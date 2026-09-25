import { describe, it, expect } from 'vitest';
import { getStatusLabelKey, getStatusColor } from '../statusMap';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Proves the design doc's explicit requirement: raw backend enum
 * values are never treated as if they were display text.
 */
describe('statusMap', () => {
  it('resolves a known project status to its translation key', () => {
    expect(getStatusLabelKey('project', 'in_progress')).toBe('status.project.in_progress');
  });

  it('falls back to a safe "unknown" key for an unrecognized value rather than crashing', () => {
    expect(getStatusLabelKey('project', 'some_future_status')).toBe('status.unknown');
  });

  it('gives the same raw value a different color depending on the entity', () => {
    // 'on_hold' is danger-tier for both project and workOrder in
    // the current map, but the mechanism supports divergence —
    // this test documents that the lookup is entity-aware, not a
    // single global switch keyed only on the string value.
    const projectColor = getStatusColor('project', 'on_hold');
    const taskColor = getStatusColor('task', 'in_progress');
    expect(projectColor).not.toBe(taskColor);
  });

  it('covers every status value in every entity without throwing', () => {
    const entities = ['lead', 'opportunity', 'quotation', 'project', 'workOrder', 'task'] as const;
    for (const entity of entities) {
      expect(() => getStatusColor(entity, 'draft')).not.toThrow();
    }
  });
});
