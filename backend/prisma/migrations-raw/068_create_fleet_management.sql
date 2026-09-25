-- ============================================================
-- 068_create_fleet_management.sql
--
-- Fleet/vehicle tracking, DELIBERATELY SCOPED:
--   - Vehicle registry (plate, make/model, status, odometer)
--   - Assignment history (which employee currently has which
--     vehicle, and who had it before)
--   - Maintenance/service log
--   - Registration and insurance EXPIRY DATE tracking
--
-- NOT INCLUDED: real-time GPS location tracking. That requires
-- actual GPS hardware installed in each vehicle and an integration
-- with a telematics provider's API (e.g. Samsara, Geotab) — a
-- genuinely separate piece of infrastructure this system has no
-- part of. "Fleet tracking" here means administrative record-
-- keeping, not live location.
--
-- At most ONE active assignment per vehicle at a time is enforced
-- by POSTGRES ITSELF via a partial unique index on
-- (vehicle_id) WHERE returned_date IS NULL — not just application
-- logic, so even a bug elsewhere can't silently double-assign a
-- vehicle.
-- ============================================================

CREATE TABLE vehicles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  plate_number           VARCHAR(20) NOT NULL,
  make                   VARCHAR(50) NOT NULL,
  model                  VARCHAR(50) NOT NULL,
  year                   INTEGER,
  vin                    VARCHAR(50),
  status                 VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  odometer_reading       INTEGER NOT NULL DEFAULT 0 CHECK (odometer_reading >= 0),
  registration_expiry_date DATE,
  insurance_expiry_date  DATE,
  notes                  TEXT,
  created_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, plate_number)
);
CREATE INDEX idx_vehicles_company_id ON vehicles(company_id);

CREATE TABLE vehicle_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  assigned_date DATE NOT NULL,
  returned_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_assignments_vehicle_id ON vehicle_assignments(vehicle_id);
CREATE INDEX idx_vehicle_assignments_employee_id ON vehicle_assignments(employee_id);
CREATE UNIQUE INDEX idx_vehicle_assignments_one_active_per_vehicle ON vehicle_assignments(vehicle_id) WHERE returned_date IS NULL;

CREATE TABLE vehicle_maintenance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        UUID NOT NULL REFERENCES vehicles(id),
  service_date      DATE NOT NULL,
  service_type      VARCHAR(100) NOT NULL,
  description       TEXT,
  cost              NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  odometer_at_service INTEGER NOT NULL CHECK (odometer_at_service >= 0),
  performed_by      VARCHAR(200),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_maintenance_records_vehicle_id ON vehicle_maintenance_records(vehicle_id);

-- ---- Row-Level Security (same pattern as migrations 064/066) ----
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicles
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicle_assignments
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE company_id = current_setting('app.current_company_id', true)::uuid)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE vehicle_maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicle_maintenance_records
  USING (
    vehicle_id IN (SELECT id FROM vehicles WHERE company_id = current_setting('app.current_company_id', true)::uuid)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
