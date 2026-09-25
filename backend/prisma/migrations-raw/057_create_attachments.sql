-- ============================================================
-- 057_create_attachments.sql
--
-- File attachments, polymorphic across every record type that
-- plausibly needs one (a contract on a customer, an installation
-- photo on a task, a scanned vendor invoice on a bill, etc.).
-- entity_type is constrained to a fixed, known list rather than
-- an open string — an attachment pointing at an entity type this
-- system doesn't know how to validate ownership for would be a
-- real security gap (see AttachmentsService for the per-type
-- ownership check performed on every upload).
--
-- STORAGE IS LOCAL DISK, NOT CLOUD OBJECT STORAGE. This is a
-- deliberate MVP scope decision: the file itself lives under an
-- uploads/ directory on the API server's own filesystem, with
-- only metadata + a randomized stored filename in this table. It
-- works correctly for a single-server deployment but does NOT
-- scale to multiple API instances or survive a server rebuild
-- without a persistent volume — wiring up S3-compatible storage
-- is a distinct, real piece of follow-up work, not something this
-- migration or its service silently pretends to solve.
--
-- Hard delete (no deleted_at): an attachment is either present or
-- it and its underlying file are gone — there is no "soft-deleted
-- but the file still sits on disk forever" state, unlike financial
-- records elsewhere in this system which are retained for audit.
-- ============================================================

CREATE TABLE attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  entity_type       VARCHAR(30) NOT NULL CHECK (entity_type IN (
                      'customer', 'lead', 'opportunity', 'quotation', 'project',
                      'work_order', 'task', 'invoice', 'bill', 'purchase_order',
                      'fixed_asset', 'vendor', 'employee', 'interaction'
                    )),
  entity_id         UUID NOT NULL,
  file_name         VARCHAR(255) NOT NULL,
  stored_file_name  VARCHAR(255) NOT NULL,
  mime_type         VARCHAR(100) NOT NULL,
  file_size_bytes   INTEGER NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_company_id ON attachments(company_id);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
