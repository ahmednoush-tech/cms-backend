-- ============================================================
-- 039_add_cash_flow_category.sql
--
-- Phase F9 — Cash Flow Statement. This single column is the
-- reason an accurate cash flow statement is possible at all in
-- this system: account TYPE alone (asset/liability/equity/
-- revenue/expense) cannot distinguish, say, "Accounts Payable"
-- (operating) from "Bank Loan Payable" (financing) — both are
-- type='liability' with no further distinction. Nullable —
-- uncategorized accounts fall into an explicit "Uncategorized"
-- bucket on the report rather than being silently guessed into
-- the wrong section.
-- ============================================================

ALTER TABLE chart_of_accounts
  ADD COLUMN cash_flow_category VARCHAR(20)
  CHECK (cash_flow_category IN ('operating', 'investing', 'financing'));
