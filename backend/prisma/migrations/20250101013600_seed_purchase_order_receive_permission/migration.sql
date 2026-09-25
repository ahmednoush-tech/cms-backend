-- ============================================================
-- 097_seed_purchase_order_receive_permission.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('97000000-0000-0000-0000-000000000001','Finance','purchase_orders','receive')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'purchase_orders' AND action = 'receive'
ON CONFLICT (role_id, permission_id) DO NOTHING;
