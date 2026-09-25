-- ============================================================
-- 084_create_leave_management.sql
--
-- LEAVE MANAGEMENT
--
-- leave_types: company-defined categories (Annual, Sick, Unpaid,
-- etc.). requires_balance distinguishes types with a finite yearly
-- pool (Annual, Sick — need a leave_balances row) from types that
-- don't (Unpaid — always requestable, no balance to track or run
-- out of).
--
-- leave_balances: one row per (employee, leave_type, year) for
-- balance-tracked types only. allocated_days is set by HR/admin
-- when the balance is created; used_days is incremented ONLY when
-- a request against it is APPROVED (see LeaveRequestsService) —
-- never at request time, since a pending or rejected request must
-- never touch the balance.
--
-- leave_requests: the actual request + approval workflow.
-- days_requested is computed server-side from start/end date,
-- counting Sunday-Thursday as working days and excluding
-- Friday/Saturday (the standard Saudi weekend) — this is a
-- deliberate, disclosed scope decision: it does NOT account for
-- company-specific public holidays, since no holiday-calendar
-- feature exists in this system yet. A request spanning a public
-- holiday will currently count that holiday as a working day.
-- ============================================================

CREATE TABLE leave_types (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  name              VARCHAR(100) NOT NULL,
  requires_balance  BOOLEAN NOT NULL DEFAULT true,
  is_paid           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (company_id, name)
);

CREATE TABLE leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  leave_type_id   UUID NOT NULL REFERENCES leave_types(id),
  year            INTEGER NOT NULL,
  allocated_days  DECIMAL(6,2) NOT NULL,
  used_days       DECIMAL(6,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  leave_type_id     UUID NOT NULL REFERENCES leave_types(id),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  days_requested    DECIMAL(6,2) NOT NULL,
  reason            TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by       UUID REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(company_id, status);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_leave_types ON leave_types
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_leave_balances ON leave_balances
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_leave_requests ON leave_requests
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');
