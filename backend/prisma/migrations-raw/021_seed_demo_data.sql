-- ============================================================
-- 021_seed_demo_data.sql
-- Dev/staging only. Demonstrates:
--   - internal users/employees (User -> Employee -> Roles path)
--   - a customer-portal user (User -> Customer User -> Customer path)
--   - a lead with a full conversion trail
--   - the full Lead -> ... -> Task pipeline
--
-- NOT WIRED INTO prisma/migrations/ (the folder `prisma migrate
-- deploy` actually uses) — deliberately excluded from real
-- deployment. The password_hash values below (e.g.
-- '$2b$12$hash_super_admin') are PLACEHOLDER STRINGS, not real
-- bcrypt hashes of anything; no one could ever log in as these
-- users even if this ran successfully. Use `npx prisma db seed`
-- (prisma/seed.ts) instead to get a REAL, working admin login —
-- it hashes a real password with the real bcrypt package at run
-- time. This file is kept only as a reference for what a fuller
-- demo dataset (leads, pipeline, portal user) could look like if
-- rebuilt properly on top of seed.ts's approach.
-- ============================================================

-- Internal users (5, one per seeded role)
INSERT INTO users (id, company_id, name, email, password_hash, status) VALUES
('51111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Mohamed Awad', 'mohamed.awad@demo-company.com', '$2b$12$hash_super_admin', 'active'),
('52222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Sara Al-Qahtani', 'sara.q@demo-company.com', '$2b$12$hash_manager', 'active'),
('53333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Omar Fathi', 'omar.f@demo-company.com', '$2b$12$hash_sales', 'active'),
('54444444-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Ahmed Nasser', 'ahmed.n@demo-company.com', '$2b$12$hash_ops', 'active'),
('55555555-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Khalid Youssef', 'khalid.y@demo-company.com', '$2b$12$hash_employee', 'active');

-- Departments
INSERT INTO departments (id, company_id, name, status) VALUES
('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Sales', 'active'),
('22222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Operations', 'active'),
('23333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'IT & Admin', 'active');

-- Employees (each links back to a users row via employees.user_id — the
-- only direction this relationship is expressed, per the approved model)
INSERT INTO employees (id, company_id, department_id, user_id, employee_number, first_name, last_name, job_title, hire_date, status) VALUES
('61111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '23333333-1111-1111-1111-111111111111', '51111111-1111-1111-1111-111111111111', 'EMP-001', 'Mohamed', 'Awad', 'General Manager', '2020-01-15', 'active'),
('62222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '52222222-1111-1111-1111-111111111111', 'EMP-002', 'Sara', 'Al-Qahtani', 'Sales Manager', '2021-03-01', 'active'),
('63333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '53333333-1111-1111-1111-111111111111', 'EMP-003', 'Omar', 'Fathi', 'Sales Executive', '2022-06-10', 'active'),
('64444444-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', '54444444-1111-1111-1111-111111111111', 'EMP-004', 'Ahmed', 'Nasser', 'Operations Manager', '2021-09-20', 'active'),
('65555555-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', '55555555-1111-1111-1111-111111111111', 'EMP-005', 'Khalid', 'Youssef', 'Field Technician', '2023-02-01', 'active');

UPDATE departments SET manager_id = '62222222-1111-1111-1111-111111111111' WHERE id = '21111111-1111-1111-1111-111111111111';
UPDATE departments SET manager_id = '64444444-1111-1111-1111-111111111111' WHERE id = '22222222-1111-1111-1111-111111111111';

INSERT INTO user_roles (user_id, role_id) VALUES
('51111111-1111-1111-1111-111111111111', '31111111-1111-1111-1111-111111111111'),
('52222222-1111-1111-1111-111111111111', '32222222-1111-1111-1111-111111111111'),
('53333333-1111-1111-1111-111111111111', '33333333-1111-1111-1111-111111111111'),
('54444444-1111-1111-1111-111111111111', '34444444-1111-1111-1111-111111111111'),
('55555555-1111-1111-1111-111111111111', '35555555-1111-1111-1111-111111111111');

-- Customer + contact
INSERT INTO customers (id, company_id, customer_type, company_name, customer_code, email, phone, city, country, owner_id, status) VALUES
('71111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'company', 'Nour Trading Est.', 'CUST-0001', 'contact@nourtrading.com', '+966511111111', 'Jeddah', 'Saudi Arabia', '53333333-1111-1111-1111-111111111111', 'active');

INSERT INTO customer_contacts (id, customer_id, name, job_title, email, phone, is_primary) VALUES
('72222222-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', 'Faisal Al-Harbi', 'Procurement Lead', 'faisal@nourtrading.com', '+966522222222', true);

-- Customer portal user: a SEPARATE users row (never an employee),
-- linked only through customer_users. This demonstrates
-- User -> Customer User -> Customer with no users.customer_id anywhere.
INSERT INTO users (id, company_id, name, email, password_hash, status) VALUES
('56666666-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Faisal Al-Harbi', 'faisal@nourtrading.com', '$2b$12$hash_customer_portal', 'active');

INSERT INTO customer_users (id, company_id, customer_id, user_id, contact_id, status) VALUES
('73333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', '56666666-1111-1111-1111-111111111111', '72222222-1111-1111-1111-111111111111', 'active');

-- Lead with a full conversion trail
INSERT INTO leads (id, company_id, customer_id, name, company_name, email, phone, source, status, owner_id, converted_at, converted_by) VALUES
('81111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', 'Faisal Al-Harbi', 'Nour Trading Est.', 'faisal@nourtrading.com', '+966522222222', 'Referral', 'won', '53333333-1111-1111-1111-111111111111', '2026-05-20T10:00:00Z', '53333333-1111-1111-1111-111111111111');

-- Opportunity (stage-only state; won here)
INSERT INTO opportunities (id, company_id, customer_id, lead_id, name, value, currency, stage, probability, expected_close_date, owner_id) VALUES
('91111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', '81111111-1111-1111-1111-111111111111', 'Network Infrastructure Upgrade', 85000.00, 'SAR', 'won', 100, '2026-06-01', '53333333-1111-1111-1111-111111111111');

-- Quotation + items
INSERT INTO quotations (id, company_id, customer_id, opportunity_id, quotation_number, status, subtotal, discount, tax, total, valid_until, created_by) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', '91111111-1111-1111-1111-111111111111', 'QTN-2026-0001', 'accepted', 80000.00, 2000.00, 6700.00, 84700.00, '2026-05-15', '53333333-1111-1111-1111-111111111111');

INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, discount, tax, total) VALUES
('a1111111-1111-1111-1111-111111111111', 'Cat6 cable installation (per point)', 100, 150.00, 500, 2085, 17085),
('a1111111-1111-1111-1111-111111111111', 'Network switch 48-port', 4, 3500.00, 0, 1470, 15470),
('a1111111-1111-1111-1111-111111111111', 'Access point configuration', 20, 1200.00, 1500, 3145, 25645);

-- Project
INSERT INTO projects (id, company_id, customer_id, opportunity_id, quotation_id, project_number, name, status, start_date, end_date, project_manager_id, created_by) VALUES
('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', '91111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'PRJ-2026-0001', 'Nour Trading — Network Upgrade', 'in_progress', '2026-06-05', '2026-07-20', '64444444-1111-1111-1111-111111111111', '52222222-1111-1111-1111-111111111111');

INSERT INTO project_members (project_id, employee_id, role) VALUES
('b1111111-1111-1111-1111-111111111111', '64444444-1111-1111-1111-111111111111', 'Project Manager'),
('b1111111-1111-1111-1111-111111111111', '65555555-1111-1111-1111-111111111111', 'Technician');

-- Work order (assigned_to_employee_id)
INSERT INTO work_orders (id, company_id, project_id, customer_id, work_order_number, title, priority, status, assigned_to_employee_id, due_date, created_by) VALUES
('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', 'WO-2026-0001', 'Install Cat6 cabling — Floor 2', 'high', 'in_progress', '65555555-1111-1111-1111-111111111111', '2026-06-25', '54444444-1111-1111-1111-111111111111');

-- Tasks (assigned_to_employee_id)
INSERT INTO tasks (company_id, project_id, work_order_id, title, assigned_to_employee_id, priority, status, start_date, due_date, created_by) VALUES
('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Terminate RJ45 connectors — Floor 2', '65555555-1111-1111-1111-111111111111', 'medium', 'in_progress', '2026-06-06', '2026-06-10', '54444444-1111-1111-1111-111111111111'),
('11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Label and test all runs', '65555555-1111-1111-1111-111111111111', 'medium', 'pending', '2026-06-11', '2026-06-14', '54444444-1111-1111-1111-111111111111');

-- Comment / attachment / activity log / notification
INSERT INTO comments (company_id, user_id, entity_type, entity_id, comment) VALUES
('11111111-1111-1111-1111-111111111111', '54444444-1111-1111-1111-111111111111', 'work_order', 'c1111111-1111-1111-1111-111111111111', 'Floor 2 cabling on schedule, switch delivery expected Thursday.');

INSERT INTO attachments (company_id, uploaded_by, entity_type, entity_id, file_name, file_path, file_type, file_size) VALUES
('11111111-1111-1111-1111-111111111111', '54444444-1111-1111-1111-111111111111', 'project', 'b1111111-1111-1111-1111-111111111111', 'network_layout_floor2.pdf', '/uploads/projects/b1111111/network_layout_floor2.pdf', 'application/pdf', 452000);

INSERT INTO activity_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values) VALUES
('11111111-1111-1111-1111-111111111111', '55555555-1111-1111-1111-111111111111', 'status_changed', 'work_order', 'c1111111-1111-1111-1111-111111111111',
 '{"status":"assigned"}', '{"status":"in_progress"}');

INSERT INTO notifications (company_id, user_id, type, title, message, entity_type, entity_id, is_read) VALUES
('11111111-1111-1111-1111-111111111111', '54444444-1111-1111-1111-111111111111', 'work_order_status_changed', 'Work Order In Progress', 'WO-2026-0001 was moved to In Progress by Khalid Youssef.', 'work_order', 'c1111111-1111-1111-1111-111111111111', false);
