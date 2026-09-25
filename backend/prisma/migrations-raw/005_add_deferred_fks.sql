-- ============================================================
-- 005_add_deferred_fks.sql
--
-- Only one deferred FK remains under the approved model:
-- departments.manager_id -> employees.id
-- (deferred because departments is created before employees).
--
-- NOTE: there is no deferred FK for users, since users no
-- longer carries employee_id. The User<->Employee link is
-- fully expressed by employees.user_id alone (migration 004).
-- ============================================================

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
