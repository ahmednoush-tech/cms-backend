/**
 * Counts working days between two dates, INCLUSIVE of both
 * endpoints, against a given set of working weekdays (0=Sunday ..
 * 6=Saturday) — NOT hardcoded, since working-week patterns vary
 * per company and even per employee (see migration 086:
 * companies.default_working_days / employees.working_days_override).
 * Resolve the effective set for the employee BEFORE calling this
 * (see resolveEffectiveWorkingDays in this same file).
 *
 * DOES NOT account for public holidays — see migration 084's
 * comment. A request spanning a public holiday currently counts
 * that day as a working day if it falls on a configured working
 * weekday. This is a disclosed, deliberate scope limitation, not
 * an oversight.
 */
export function countWorkingDays(startDate: Date, endDate: Date, workingDays: number[]): number {
  if (endDate < startDate) {
    throw new Error('countWorkingDays: endDate must not be before startDate.');
  }
  if (workingDays.length === 0) {
    throw new Error('countWorkingDays: workingDays must not be empty — every day would count as non-working.');
  }

  const workingDaySet = new Set(workingDays);
  let count = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    if (workingDaySet.has(cursor.getDay())) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * An employee's own override always wins when set (a non-empty
 * array); otherwise the company-wide default applies. An empty
 * array means "no override" — Prisma does not support a nullable
 * scalar list column, so this is the sentinel value rather than
 * null (see migration 086's comment). Both values are already
 * correctly scoped per-company; this function just picks between
 * two ALREADY-tenant-scoped values, it never reads or assumes any
 * global/shared default.
 */
export function resolveEffectiveWorkingDays(employeeWorkingDaysOverride: number[], companyDefaultWorkingDays: number[]): number[] {
  return employeeWorkingDaysOverride.length > 0 ? employeeWorkingDaysOverride : companyDefaultWorkingDays;
}
