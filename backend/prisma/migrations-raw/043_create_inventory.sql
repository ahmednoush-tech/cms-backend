-- ============================================================
-- 043_create_inventory.sql
--
-- Phase F14 — Inventory Foundation. Weighted Average Cost method.
-- Opening stock at item creation posts NO journal entry (there is
-- no "other side" to post against — the item didn't come from
-- anywhere the books can see). Any LATER manual adjustment always
-- requires an explicit offsetting account, never guessed.
-- ============================================================

CREATE TABLE inventory_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  sku                   VARCHAR(50) NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  unit_of_measure       VARCHAR(30) NOT NULL DEFAULT 'unit',
  quantity_on_hand      NUMERIC(14,3) NOT NULL DEFAULT 0,
  average_unit_cost     NUMERIC(14,4) NOT NULL DEFAULT 0,
  inventory_account_id  UUID REFERENCES chart_of_accounts(id),
  cogs_account_id       UUID REFERENCES chart_of_accounts(id),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  UNIQUE (company_id, sku)
);
CREATE INDEX idx_inventory_items_company_id ON inventory_items(company_id);

-- Full audit trail with running snapshots — every change in
-- quantity or cost is a row here, never a silent update.
-- journal_entry_id is nullable: opening stock has no journal
-- entry (see rationale above), but a purchase/sale/adjustment
-- always has one.
CREATE TABLE inventory_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  inventory_item_id   UUID NOT NULL REFERENCES inventory_items(id),
  type                VARCHAR(30) NOT NULL CHECK (type IN ('opening', 'purchase', 'sale', 'adjustment_increase', 'adjustment_decrease')),
  quantity             NUMERIC(14,3) NOT NULL,
  unit_cost            NUMERIC(14,4),
  quantity_after       NUMERIC(14,3) NOT NULL,
  average_cost_after   NUMERIC(14,4) NOT NULL,
  journal_entry_id     UUID REFERENCES journal_entries(id),
  reference_type       VARCHAR(20),
  reference_id         UUID,
  notes                TEXT,
  created_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_movements_company_id ON inventory_movements(company_id);
CREATE INDEX idx_inventory_movements_item_id ON inventory_movements(inventory_item_id);

ALTER TABLE invoice_items ADD COLUMN inventory_item_id UUID REFERENCES inventory_items(id);
ALTER TABLE bill_items ADD COLUMN inventory_item_id UUID REFERENCES inventory_items(id);
