import { describe, it, expect } from 'vitest';
import { applyDirection } from '../index';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */
describe('applyDirection', () => {
  it('sets dir="rtl" and lang="ar" for Arabic', () => {
    applyDirection('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('sets dir="ltr" and lang="en" for English', () => {
    applyDirection('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });
});
