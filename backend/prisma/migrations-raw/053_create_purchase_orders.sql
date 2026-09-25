-- ============================================================
-- 053_create_purchase_orders.sql
--
-- Purchase Orders — the formal "we intend to buy this" document
-- that should exist BEFORE a Bill, with its own approval step.
-- Deliberately posts NO journal entry at any stage: a PO is a
-- commitment, not yet a liability — that only happens when
-- BillsService.receive() runs, which already exists and is
-- untouched by this migration. Converting an approved/sent PO
-- into an actual Bill is a separate, later action (see
-- PurchaseOrdersService.convertToBill()).
--
-- Approval is single-level and permission-based
-- (Finance:purchase_orders:approve) — there is no multi-step
-- approval chain, threshold-based routing, or self-approval
-- prevention here. A company needing "orders over 50,000 SAR
-- need two approvers" would need that built as a distinct,
-- later feature; this is the foundation it would sit on top of.
-- ============================================================

CREATE TABLE purchase_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  vendor_id             UUID NOT NULL REFERENCES vendors(id),
  po_number             VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'sent', 'closed', 'cancelled')),
  expected_delivery_date DATE,
  notes                 TEXT,
  rejection_reason      TEXT,
  subtotal              NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount              NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  bill_id               UUID REFERENCES bills(id),
  submitted_at          TIMESTAMPTZ,
  approved_by           UUID REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  UNIQUE (company_id, po_number)
);
CREATE INDEX idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

CREATE TABLE purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax               NUMERIC(14,2) NOT NULL DEFAULT 0,
  total             NUMERIC(14,2) NOT NULL DEFAULT 0,
  inventory_item_id UUID REFERENCES inventory_items(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_items_purchase_order_id ON purchase_order_items(purchase_order_id);
