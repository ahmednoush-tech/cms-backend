-- ============================================================
-- 095_seed_inventory_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('95000000-0000-0000-0000-000000000001','Operations','warehouses','view'),
('95000000-0000-0000-0000-000000000002','Operations','warehouses','manage'),
('95000000-0000-0000-0000-000000000003','Operations','stock_items','view'),
('95000000-0000-0000-0000-000000000004','Operations','stock_items','manage'),
('95000000-0000-0000-0000-000000000005','Operations','inventory_stock','view'),
('95000000-0000-0000-0000-000000000006','Operations','stock_movements','create')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Operations' AND resource IN ('warehouses', 'stock_items', 'inventory_stock', 'stock_movements')
ON CONFLICT (role_id, permission_id) DO NOTHING;
