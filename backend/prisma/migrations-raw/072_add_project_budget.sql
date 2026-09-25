-- ============================================================
-- 072_add_project_budget.sql
--
-- Adds a planned budget to Project, for budget-vs-actual tracking
-- (see ProjectsService.getProgressAndBudget()).
--
-- IMPORTANT SCOPE DISCLOSURE: "actual cost" in this feature is
-- LABOR COST ONLY — the sum of TimeEntry.laborCost for every task
-- belonging to the project. Neither Bill nor PurchaseOrder has a
-- project_id column in this schema, so material/vendor/equipment
-- costs incurred FOR a project cannot be attributed to it today.
-- A project that spends heavily on materials but little on logged
-- labor hours will show as "under budget" here even if its true
-- total cost is far higher — this is a real, disclosed limitation
-- of the underlying data model, not something fixed by this
-- migration alone (that would require linking Bills/POs to
-- projects too, a separate, larger change not made here).
-- ============================================================

ALTER TABLE projects ADD COLUMN budget NUMERIC(14,2);
