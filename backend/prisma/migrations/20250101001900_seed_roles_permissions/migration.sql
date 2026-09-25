-- ============================================================
-- 020_seed_roles_permissions.sql
-- Seeds one demo company plus its Super Admin / Manager /
-- Sales / Operations / Employee roles, a representative
-- permission set, and role->permission mappings.
-- ============================================================

INSERT INTO companies (id, name, legal_name, email, phone, website, city, country, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Company Ltd.', 'Demo Company Ltd.',
        'info@demo-company.com', '+966500000000', 'https://demo-company.com', 'Riyadh', 'Saudi Arabia', 'active');

INSERT INTO roles (id, company_id, name, description) VALUES
('31111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Super Admin', 'Full system access'),
('32222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Manager', 'Department/team oversight'),
('33333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Sales', 'CRM: leads, opportunities, quotations'),
('34444444-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Operations', 'Projects, work orders, tasks'),
('35555555-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Employee', 'Baseline access to assigned work');

INSERT INTO permissions (id, module, resource, action) VALUES
('41000000-0000-0000-0000-000000000001','CRM','customers','view'),
('41000000-0000-0000-0000-000000000002','CRM','customers','create'),
('41000000-0000-0000-0000-000000000003','CRM','customers','edit'),
('41000000-0000-0000-0000-000000000004','CRM','customers','delete'),
('41000000-0000-0000-0000-000000000005','CRM','leads','view'),
('41000000-0000-0000-0000-000000000006','CRM','leads','create'),
('41000000-0000-0000-0000-000000000007','CRM','opportunities','view'),
('41000000-0000-0000-0000-000000000008','CRM','opportunities','create'),
('41000000-0000-0000-0000-000000000009','CRM','quotations','view'),
('41000000-0000-0000-0000-000000000010','CRM','quotations','create'),
('41000000-0000-0000-0000-000000000011','Operations','projects','view'),
('41000000-0000-0000-0000-000000000012','Operations','projects','create'),
('41000000-0000-0000-0000-000000000013','Operations','projects','edit'),
('41000000-0000-0000-0000-000000000014','Operations','projects','assign'),
('41000000-0000-0000-0000-000000000015','Operations','work_orders','view'),
('41000000-0000-0000-0000-000000000016','Operations','work_orders','assign'),
('41000000-0000-0000-0000-000000000017','Operations','tasks','view'),
('41000000-0000-0000-0000-000000000018','Operations','tasks','edit'),
('41000000-0000-0000-0000-000000000019','Administration','users','manage'),
('41000000-0000-0000-0000-000000000020','Administration','roles','manage');

-- Super Admin gets every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions;

-- Sales role -> CRM module
INSERT INTO role_permissions (role_id, permission_id)
SELECT '33333333-1111-1111-1111-111111111111', id FROM permissions WHERE module = 'CRM';

-- Operations role -> Operations module
INSERT INTO role_permissions (role_id, permission_id)
SELECT '34444444-1111-1111-1111-111111111111', id FROM permissions WHERE module = 'Operations';
