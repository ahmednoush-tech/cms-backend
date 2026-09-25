import { describe, it, expect } from 'vitest';
import { ApiError } from '../client';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Covers the normalization logic in api/client.ts's response
 * interceptor conceptually via the ApiError class itself; a full
 * interceptor test (mocking axios) is left for Phase 3B when a
 * real endpoint's request/response shape is exercised end to end.
 */
describe('ApiError', () => {
  it('carries status, code, and message', () => {
    const err = new ApiError(409, 'CONFLICT', 'This quotation is already linked to project PRJ-2026-0001.');
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('This quotation is already linked to project PRJ-2026-0001.');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
  });

  it('supports the NETWORK_ERROR case for a failed request with no response', () => {
    const err = new ApiError(0, 'NETWORK_ERROR', 'Network error — check your connection.');
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
