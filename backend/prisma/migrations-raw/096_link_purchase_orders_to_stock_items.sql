-- ============================================================
-- 096_link_purchase_orders_to_stock_items.sql
--
-- Links purchase_order_items to the NEW multi-warehouse StockItem
-- catalog (migration 094) — a DIFFERENT, additional link from the
-- EXISTING inventory_item_id column on this same table, which
-- points to the OLD, accounting-integrated InventoryItem catalog.
-- A line item may reference neither, either, or (unusually) both;
-- this migration does not touch the existing column at all.
--
-- stock_item_id is nullable — a purchase order line for a service
-- or anything not tracked as multi-warehouse stock has no value
-- here, and receiving against that line never creates a stock
-- movement (see PurchaseOrderReceiptsService).
--
-- received_quantity is a CACHED running total (same pattern as
-- inventory_stock.quantity_on_hand and leave_balances.used_days):
-- how much of this line has actually been received so far, across
-- however many separate receiving events it takes. Deliberately
-- NOT constrained by a CHECK (received_quantity <= quantity) at
-- the database level — the application layer enforces this at
-- receive time, and a DB constraint here would also block a
-- legitimate future edit that reduces quantity below what was
-- already received.
-- ============================================================

ALTER TABLE purchase_order_items ADD COLUMN stock_item_id UUID REFERENCES stock_items(id);
ALTER TABLE purchase_order_items ADD COLUMN received_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0;
