-- ============================================================
-- 104_add_document_versioning.sql
--
-- Adds versioning directly onto the EXISTING attachments table,
-- rather than a new table — a version IS an attachment, just one
-- that knows which document lineage it belongs to and where it
-- sits in that lineage.
--
-- document_group_id: shared by every version of the same
-- document. Self-references attachments(id) — set to the
-- attachment's OWN id for a brand-new document (via a two-step
-- create-then-update at the application layer, since a row can't
-- reference its own id within the same INSERT), or to the
-- ORIGINAL version's id when a new version is uploaded. This
-- makes "all versions of this document" and "the current version"
-- both simple, indexed queries — no separate version-tracking
-- table, no recursive lookups.
--
-- version_number: 1 for the first upload, incremented for each
-- subsequent version. Immutable once written.
--
-- is_current_version: a CACHED flag so "what am I looking at
-- right now" is a plain WHERE clause, not a MAX(version_number)
-- subquery on every attachment list render. Exactly one row per
-- document_group_id has this true — enforced at the application
-- layer (AttachmentsService), not by a DB constraint, since
-- Postgres has no simple way to express "exactly one true per
-- group" as a CHECK.
-- ============================================================

ALTER TABLE attachments ADD COLUMN document_group_id UUID REFERENCES attachments(id);
ALTER TABLE attachments ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE attachments ADD COLUMN is_current_version BOOLEAN NOT NULL DEFAULT true;

-- Backfill: every EXISTING attachment becomes the first (and
-- currently only) version of its own document group.
UPDATE attachments SET document_group_id = id WHERE document_group_id IS NULL;

ALTER TABLE attachments ALTER COLUMN document_group_id SET NOT NULL;

CREATE INDEX idx_attachments_document_group ON attachments(document_group_id);
