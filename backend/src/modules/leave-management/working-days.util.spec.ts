import { countWorkingDays, resolveEffectiveWorkingDays } from './working-days.util';

describe('countWorkingDays', () => {
  const sunToThu = [0, 1, 2, 3, 4];
  const sunToFri = [0, 1, 2, 3, 4, 5];

  it('counts a single Sunday as 1 working day', () => {
    expect(countWorkingDays(new Date('2026-09-13'), new Date('2026-09-13'), sunToThu)).toBe(1);
  });

  it('counts a single Friday as 0 working days under a Sun-Thu week', () => {
    expect(countWorkingDays(new Date('2026-09-11'), new Date('2026-09-11'), sunToThu)).toBe(0);
  });

  it('counts a full Sun-Sat week as 5 working days under a Sun-Thu pattern', () => {
    expect(countWorkingDays(new Date('2026-09-13'), new Date('2026-09-19'), sunToThu)).toBe(5);
  });

  it('counts a full Sun-Sat week as 6 working days under a Sun-Fri pattern', () => {
    expect(countWorkingDays(new Date('2026-09-13'), new Date('2026-09-19'), sunToFri)).toBe(6);
  });

  it('counts two full weeks as 10 working days under a Sun-Thu pattern', () => {
    expect(countWorkingDays(new Date('2026-09-13'), new Date('2026-09-26'), sunToThu)).toBe(10);
  });

  it('counts a range spanning the weekend correctly (Thu through Sun)', () => {
    expect(countWorkingDays(new Date('2026-09-17'), new Date('2026-09-20'), sunToThu)).toBe(2);
  });

  it('throws if endDate is before startDate', () => {
    expect(() => countWorkingDays(new Date('2026-09-15'), new Date('2026-09-10'), sunToThu)).toThrow();
  });

  it('throws if the working-days set is empty (would count every day as non-working)', () => {
    expect(() => countWorkingDays(new Date('2026-09-13'), new Date('2026-09-13'), [])).toThrow();
  });
});

describe('resolveEffectiveWorkingDays', () => {
  const companyDefault = [0, 1, 2, 3, 4];

  it('uses the employee override when it is non-empty', () => {
    const override = [0, 1, 2, 3, 4, 5];
    expect(resolveEffectiveWorkingDays(override, companyDefault)).toBe(override);
  });

  it('falls back to the company default when the override is an empty array (no override)', () => {
    expect(resolveEffectiveWorkingDays([], companyDefault)).toBe(companyDefault);
  });
});
