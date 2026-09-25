-- ============================================================
-- 098_link_sales_documents_to_stock_items.sql
--
-- INVOICES: adds warehouse_id (nullable — the warehouse a sale's
-- goods ship FROM) and invoice_items.stock_item_id (nullable — a
-- line's link into the NEW multi-warehouse StockItem catalog,
-- separate from the EXISTING inventory_item_id column, which
-- points to the OLD, accounting-integrated InventoryItem catalog
-- and already drives that system's own COGS/GL posting on issue).
--
-- When an invoice with at least one stock_item_id line is issued
-- (InvoicesService.issue()), those lines create real StockMovement
-- 'issue' movements via the EXISTING, already-tested
-- InventoryMovementsService — a PHYSICAL stock deduction only, with
-- NO accounting/GL entries of its own (the new inventory system
-- has no costing model; see StockItem's schema comment). This is
-- entirely separate from, and additional to, whatever the OLD
-- system's inventory_item_id lines already do on the same invoice.
--
-- QUOTATIONS: adds quotation_items.stock_item_id as a catalog
-- reference ONLY — a quotation is a proposal, not a committed
-- sale, and issuing/accepting one never creates a stock movement.
-- The link exists so a quotation can be converted into an invoice
-- (or a future feature) carrying the same catalog identity through
-- without the user re-picking the item.
-- ============================================================

ALTER TABLE invoices ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE invoice_items ADD COLUMN stock_item_id UUID REFERENCES stock_items(id);
ALTER TABLE quotation_items ADD COLUMN stock_item_id UUID REFERENCES stock_items(id);
