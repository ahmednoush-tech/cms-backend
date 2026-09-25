-- ============================================================
-- 037_create_invoice_notes.sql
--
-- Phase F8 — Credit/Debit Notes against Invoices (sales side).
-- Solves the real gap that an ISSUED invoice can never be edited
-- or reversed once posted (correct — that's the whole point of
-- posted-entry immutability), but the business still needs a
-- legal way to correct one: a returned item, a pricing error, a
-- post-invoice discount, or an intentional additional charge.
--
-- Credit Note: REDUCES what the customer owes. Posts the mirror
-- image of the original issue() entry (debit Revenue + Tax
-- Payable, credit Accounts Receivable) for the credited amount.
--
-- Debit Note: INCREASES what the customer owes — economically
-- identical to a small additional invoice tied to the original.
-- Posts the SAME direction as issue() (debit AR, credit Revenue
-- + Tax Payable).
--
-- One table with a noteType discriminator, not two tables — the
-- two note types share 100% of their structure (header, items,
-- totals) and differ only in which side of the journal entry they
-- post to; a Payment/BillPayment-style full table split isn't
-- warranted here since both note types apply to the SAME target
-- (an invoice), not two conceptually different real-world facts.
-- ============================================================

CREATE TABLE invoice_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  invoice_id     UUID NOT NULL REFERENCES invoices(id),
  note_type      VARCHAR(10) NOT NULL CHECK (note_type IN ('credit', 'debit')),
  note_number    VARCHAR(50) NOT NULL,
  note_date      DATE NOT NULL,
  reason         TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, note_number)
);
CREATE INDEX idx_invoice_notes_company_id ON invoice_notes(company_id);
CREATE INDEX idx_invoice_notes_invoice_id ON invoice_notes(invoice_id);

CREATE TABLE invoice_note_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID NOT NULL REFERENCES invoice_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL,
  unit_price  NUMERIC(14,2) NOT NULL,
  discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total       NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_note_items_note_id ON invoice_note_items(note_id);
