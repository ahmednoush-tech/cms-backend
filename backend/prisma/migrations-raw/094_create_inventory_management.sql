-- ============================================================
-- 094_create_inventory_management.sql
--
-- MULTI-WAREHOUSE INVENTORY
--
-- warehouses: physical/logical storage locations per company.
--
-- stock_items: the company's catalog of trackable stock
-- items — this is also, incidentally, the first real "product
-- catalog" in this system (existing quotation/invoice line items
-- are free-text, not linked to a real item record). Deliberately
-- scoped here to inventory tracking only; linking quotations/
-- invoices to real items is a separate, larger integration not
-- built in this pass.
--
-- inventory_stock: the CURRENT quantity of one item at one
-- warehouse. This is a CACHED value, not something recomputed by
-- summing stock_movements on every read — same pattern as
-- leave_balances (migration 084): a cached balance updated
-- ATOMICALLY alongside each ledger entry, inside the same
-- transaction, never as a separate step that could drift out of
-- sync. UNIQUE(warehouse_id, item_id): exactly one stock row per
-- item per warehouse.
--
-- stock_movements: the full audit ledger — every receipt,
-- issue, transfer, and manual adjustment, immutable once written
-- (no update/delete path exposed). A transfer between two
-- warehouses is recorded as TWO rows (transfer_out at the source,
-- transfer_in at the destination), linked via related_movement_id,
-- so the ledger always shows a movement affecting exactly one
-- warehouse each, never an ambiguous "moved from A to B" single row.
--
-- Quantity can never go negative — enforced in the application
-- layer (InventoryMovementsService), inside the same transaction
-- that writes the movement and updates the cached stock, not by a
-- database CHECK constraint (a constraint on inventory_stock alone
-- can't see the movement being written in the same transaction
-- cleanly with Prisma's increment/decrement operators).
-- ============================================================

CREATE TABLE warehouses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  name        VARCHAR(150) NOT NULL,
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE stock_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  sku             VARCHAR(100) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'unit',
  reorder_point   DECIMAL(14, 2),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (company_id, sku)
);

CREATE TABLE inventory_stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
  item_id           UUID NOT NULL REFERENCES stock_items(id),
  quantity_on_hand  DECIMAL(14, 2) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, item_id),
  CHECK (quantity_on_hand >= 0)
);

CREATE TABLE stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  item_id             UUID NOT NULL REFERENCES stock_items(id),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
  movement_type       VARCHAR(20) NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'transfer_out', 'transfer_in', 'adjustment')),
  quantity            DECIMAL(14, 2) NOT NULL CHECK (quantity > 0),
  related_movement_id UUID REFERENCES stock_movements(id),
  reason              TEXT,
  performed_by        UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_levels_item ON inventory_stock(item_id);
CREATE INDEX idx_stock_movements_item_warehouse ON stock_movements(item_id, warehouse_id);
CREATE INDEX idx_stock_movements_company_created ON stock_movements(company_id, created_at);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_warehouses ON warehouses
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_stock_items ON stock_items
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inventory_stock ON inventory_stock
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_stock_movements ON stock_movements
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');
