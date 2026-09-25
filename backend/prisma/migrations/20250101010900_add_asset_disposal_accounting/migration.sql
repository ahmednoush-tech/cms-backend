-- ============================================================
-- 070_add_asset_disposal_accounting.sql
--
-- Closes a previously DISCLOSED gap: disposing a fixed asset used
-- to just flip its status to 'disposed' with ZERO accounting
-- entry — no write-off of the asset or its accumulated
-- depreciation, no recognition of the gain or loss on disposal.
--
-- THE ACCOUNTING TREATMENT (implemented in
-- FixedAssetsService.dispose()):
--   Net Book Value (NBV) = purchase_cost - accumulated_depreciation
--   Gain/Loss            = disposal_proceeds - NBV
--
--   Journal entry:
--     DEBIT  accumulated_depreciation account  (writes it off)
--     DEBIT  cash (defaultCashAccountId)        (if there are proceeds)
--     CREDIT the asset's own fixed-asset account (at full purchase cost)
--     CREDIT the gain/loss account               (if a GAIN)
--     DEBIT  the gain/loss account               (if a LOSS)
--
-- default_asset_disposal_gain_loss_account_id is required ONLY
-- when disposal_proceeds actually differs from the asset's net
-- book value — the same "configure the account only when you
-- actually need it" pattern already used for the FX gain/loss
-- account and the tax payable account elsewhere in this system.
-- ============================================================

ALTER TABLE finance_settings ADD COLUMN default_asset_disposal_gain_loss_account_id UUID REFERENCES chart_of_accounts(id);
ALTER TABLE fixed_assets ADD COLUMN disposal_journal_entry_id UUID UNIQUE REFERENCES journal_entries(id);
ALTER TABLE fixed_assets ADD COLUMN disposal_proceeds NUMERIC(14,2);
