-- ============================================================
-- 040_add_zakat_category.sql
--
-- Phase F10 — Zakat Base ESTIMATE (not a Zakat return calculator).
-- Zakat in Saudi Arabia is a wealth-based levy (2.5% of the
-- "Zakat base"), not an income tax, and its real calculation
-- depends on ownership structure (Saudi/GCC vs foreign
-- shareholders — this system has no ownership-percentage data
-- model at all) and detailed adjustments under ZATCA's
-- Implementing Regulation for Zakat Collection that require a
-- qualified Zakat/tax advisor's judgment. This system builds only
-- the well-established CORE formula structure as a starting-point
-- estimate:
--
--   Zakat Base (estimate) = Total Equity
--                          + Long-term Liabilities
--                          - Fixed Assets (net)
--                          - Long-term Investments
--
-- This column tags which of those three non-equity categories an
-- account belongs to, so the estimate can be computed from
-- existing account balances. An account left untagged is treated
-- as already reflected within Equity/current items and is not
-- separately adjusted — exactly like cash_flow_category (migration
-- 039), this is a reporting tag, not part of double-entry
-- mechanics, and is safe to set or change at any time.
-- ============================================================

ALTER TABLE chart_of_accounts
  ADD COLUMN zakat_category VARCHAR(30)
  CHECK (zakat_category IN ('long_term_liability', 'fixed_asset', 'long_term_investment'));
