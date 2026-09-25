-- ============================================================
-- 055_create_fixed_assets.sql
--
-- Fixed Assets & Depreciation. STRAIGHT-LINE method ONLY,
-- deliberately: declining-balance and units-of-production are
-- legitimate alternatives that require a judgment call about
-- which fits a given asset, exactly like Zakat and GOSI needed
-- explicit per-record configuration rather than a guessed
-- default. Straight-line is the simplest to implement correctly
-- and the most common default method at this scale.
--
-- Each asset carries its OWN three GL account links (asset,
-- accumulated depreciation, depreciation expense) — mirroring
-- InventoryItem's own inventoryAccountId/cogsAccountId pattern —
-- rather than one company-wide default, since a "Vehicles"
-- depreciation expense line and an "IT Equipment" one are usually
-- meant to stay separate in the income statement.
--
-- Disposal is intentionally NOT built here beyond a status flag:
-- correctly accounting for a disposal (gain/loss vs proceeds,
-- writing off remaining net book value) is a distinct, real piece
-- of work not bundled into this foundation.
-- ============================================================

CREATE TABLE fixed_assets (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                      UUID NOT NULL REFERENCES companies(id),
  asset_number                    VARCHAR(50) NOT NULL,
  name                            VARCHAR(200) NOT NULL,
  category                        VARCHAR(100),
  description                     TEXT,
  purchase_date                   DATE NOT NULL,
  purchase_cost                   NUMERIC(14,2) NOT NULL CHECK (purchase_cost > 0),
  salvage_value                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  useful_life_months              INTEGER NOT NULL CHECK (useful_life_months > 0),
  accumulated_depreciation        NUMERIC(14,2) NOT NULL DEFAULT 0,
  fixed_asset_account_id          UUID REFERENCES chart_of_accounts(id),
  accumulated_depreciation_account_id UUID REFERENCES chart_of_accounts(id),
  depreciation_expense_account_id UUID REFERENCES chart_of_accounts(id),
  status                          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fully_depreciated', 'disposed')),
  disposed_at                     TIMESTAMPTZ,
  created_by                      UUID REFERENCES users(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                      TIMESTAMPTZ,
  UNIQUE (company_id, asset_number),
  CHECK (salvage_value >= 0 AND salvage_value < purchase_cost)
);
CREATE INDEX idx_fixed_assets_company_id ON fixed_assets(company_id);

CREATE TABLE depreciation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  month             SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year              SMALLINT NOT NULL,
  total_depreciation NUMERIC(14,2) NOT NULL DEFAULT 0,
  journal_entry_id  UUID REFERENCES journal_entries(id),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, month, year)
);
CREATE INDEX idx_depreciation_runs_company_id ON depreciation_runs(company_id);

CREATE TABLE depreciation_entries (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  depreciation_run_id         UUID NOT NULL REFERENCES depreciation_runs(id) ON DELETE CASCADE,
  fixed_asset_id              UUID NOT NULL REFERENCES fixed_assets(id),
  depreciation_amount         NUMERIC(14,2) NOT NULL,
  accumulated_depreciation_after NUMERIC(14,2) NOT NULL,
  net_book_value_after        NUMERIC(14,2) NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (depreciation_run_id, fixed_asset_id)
);
CREATE INDEX idx_depreciation_entries_run_id ON depreciation_entries(depreciation_run_id);
CREATE INDEX idx_depreciation_entries_asset_id ON depreciation_entries(fixed_asset_id);
