-- ============================================================
-- 086_add_configurable_working_days.sql
--
-- Replaces the originally hardcoded "Sunday-Thursday" assumption
-- in leave day-counting with a configurable working-week pattern:
--
--   companies.default_working_days: the company-wide default,
--   an array of weekday numbers (0=Sunday .. 6=Saturday) that
--   count as working days. Defaults to {0,1,2,3,4} (Sun-Thu, the
--   common Saudi private-sector 5-day week) — but every company
--   can set its own (e.g. {0,1,2,3,4,5} for a 6-day week with only
--   Friday off, common in contracting/field work).
--
--   employees.working_days_override: NULLABLE per-employee
--   override of the same shape. NULL means "use the company
--   default". This also covers a DEPARTMENT-level need without a
--   third configuration layer: HR sets the same override on every
--   employee in that department.
-- ============================================================

ALTER TABLE companies ADD COLUMN default_working_days INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4}';
ALTER TABLE employees ADD COLUMN working_days_override INTEGER[] NOT NULL DEFAULT '{}';
-- An empty array means "no override — use the company default"
-- (see working-days.util.ts's resolveEffectiveWorkingDays). Prisma
-- does not support a nullable scalar list column, so this is the
-- sentinel value rather than NULL.
