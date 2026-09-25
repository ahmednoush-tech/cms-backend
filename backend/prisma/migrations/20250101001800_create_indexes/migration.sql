-- ============================================================
-- 019_create_indexes.sql
-- Consolidated index strategy for all tables created in
-- 001-018. Tenant-safe indexes (company_id-leading or
-- company_id-inclusive) are called out where the access
-- pattern is tenant/customer isolation critical.
-- ============================================================

-- companies
CREATE INDEX idx_companies_status ON companies(status);

-- departments
CREATE INDEX idx_departments_company ON departments(company_id);
CREATE INDEX idx_departments_manager ON departments(manager_id);
CREATE INDEX idx_departments_status ON departments(status);

-- users
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- employees
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_user ON employees(user_id);

-- roles / permissions
CREATE INDEX idx_roles_company ON roles(company_id);
CREATE INDEX idx_permissions_module_resource ON permissions(module, resource);

-- customers
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_owner ON customers(owner_id);
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_email ON customers(email);

-- customer_contacts
CREATE INDEX idx_contacts_customer ON customer_contacts(customer_id);

-- customer_users — tenant/customer isolation is checked on
-- nearly every customer-portal request, so both company_id
-- and customer_id are indexed, plus the lookup-by-user path
-- used to resolve isolation context at login/request time.
CREATE INDEX idx_customer_users_company ON customer_users(company_id);
CREATE INDEX idx_customer_users_customer ON customer_users(customer_id);
CREATE INDEX idx_customer_users_user ON customer_users(user_id);
CREATE INDEX idx_customer_users_contact ON customer_users(contact_id);
CREATE INDEX idx_customer_users_status ON customer_users(status);
CREATE INDEX idx_customer_users_company_customer ON customer_users(company_id, customer_id);

-- leads
CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_customer ON leads(customer_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_converted_at ON leads(converted_at);

-- opportunities
CREATE INDEX idx_opportunities_company ON opportunities(company_id);
CREATE INDEX idx_opportunities_customer ON opportunities(customer_id);
CREATE INDEX idx_opportunities_lead ON opportunities(lead_id);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);

-- quotations
CREATE INDEX idx_quotations_company ON quotations(company_id);
CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_quotations_opportunity ON quotations(opportunity_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_number ON quotations(quotation_number);

-- quotation_items
CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);

-- projects
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_opportunity ON projects(opportunity_id);
CREATE INDEX idx_projects_quotation ON projects(quotation_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_manager ON projects(project_manager_id);
CREATE INDEX idx_projects_number ON projects(project_number);

-- work_orders
CREATE INDEX idx_wo_company ON work_orders(company_id);
CREATE INDEX idx_wo_project ON work_orders(project_id);
CREATE INDEX idx_wo_customer ON work_orders(customer_id);
CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_assigned_employee ON work_orders(assigned_to_employee_id);
CREATE INDEX idx_wo_due_date ON work_orders(due_date);
CREATE INDEX idx_wo_number ON work_orders(work_order_number);

-- tasks
CREATE INDEX idx_tasks_company ON tasks(company_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_work_order ON tasks(work_order_id);
CREATE INDEX idx_tasks_assigned_employee ON tasks(assigned_to_employee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- comments (polymorphic lookups)
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_company ON comments(company_id);
-- attachments indexes deliberately NOT here — the attachments
-- table doesn't exist yet at this point in the sequence (it's
-- created much later, in migration 057, which already includes
-- its own idx_attachments_entity and idx_attachments_company_id).
-- A real Docker deploy caught this: this migration used to try to
-- index a table that didn't exist yet, failing with "relation
-- attachments does not exist" and leaving the migration history
-- in a failed state (Prisma error P3009) that blocks all further
-- migrations until manually resolved.

-- activity_logs
CREATE INDEX idx_activity_company ON activity_logs(company_id);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_created_at ON activity_logs(created_at);

-- notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_company ON notifications(company_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
