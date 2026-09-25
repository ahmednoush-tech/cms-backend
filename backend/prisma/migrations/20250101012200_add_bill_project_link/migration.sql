-- ============================================================
-- 083_add_bill_project_link.sql
--
-- Closes a gap disclosed when Project Progress/Budget tracking
-- was first built: "actualLaborCost from TimeEntry sum (LABOR
-- ONLY)". This migration adds the other half — a Bill (an actual
-- vendor cost already incurred) can now optionally be linked to
-- the Project it was purchased for, so budget-vs-actual can
-- finally include material/vendor costs, not labor alone.
--
-- DELIBERATELY NOT LINKING PurchaseOrder: a PO is a COMMITMENT
-- (money not yet spent, and possibly never billed if the order
-- changes), not an incurred cost. "Actual cost" should reflect
-- money genuinely spent — that's what a Bill represents. Someone
-- wanting to see committed-but-not-yet-billed spend against a
-- project is a legitimate, separate future feature ("budget vs
-- committed vs actual"), not built here.
--
-- Nullable and ON DELETE SET NULL: a bill is not required to be
-- tied to a project (most bills — office supplies, utilities —
-- never will be), and if a project is ever deleted, its bills
-- remain as valid financial records, just no longer categorized
-- under that project.
-- ============================================================

ALTER TABLE bills ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_bills_project_id ON bills(project_id) WHERE project_id IS NOT NULL;
