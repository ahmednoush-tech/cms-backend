-- ============================================================
-- 073_create_email_integration.sql
--
-- Outlook email integration for automatic CRM interaction
-- logging. DELIBERATELY SCOPED:
--
--   - MICROSOFT OUTLOOK ONLY (via Microsoft Graph API's OAuth2 +
--     /me/messages endpoint). Gmail and WhatsApp are NOT covered.
--   - PER-USER connection, not one shared company mailbox — each
--     salesperson connects THEIR OWN Outlook account. One user has
--     at most one active connection (enforced by the UNIQUE on
--     user_id).
--   - READ-ONLY (Mail.Read scope only) — this system never sends
--     email on a user's behalf through this integration.
--   - ON-DEMAND sync (a "sync now" action), NOT real-time push —
--     real-time would require Microsoft Graph's webhook/
--     subscription feature, separate infrastructure not set up here.
--   - Only messages to/from an address matching an EXISTING
--     Customer or Lead are turned into an Interaction.
-- ============================================================

CREATE TABLE email_integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id),
  provider         VARCHAR(20) NOT NULL DEFAULT 'outlook' CHECK (provider = 'outlook'),
  connected_email  VARCHAR(255) NOT NULL,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected')),
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at   TIMESTAMPTZ
);
CREATE INDEX idx_email_integrations_company_id ON email_integrations(company_id);

CREATE TABLE email_synced_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  provider_message_id VARCHAR(300) NOT NULL,
  interaction_id      UUID UNIQUE REFERENCES interactions(id),
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_message_id)
);
CREATE INDEX idx_email_synced_messages_user_id ON email_synced_messages(user_id);

-- ---- Row-Level Security (same pattern as migrations 064/066/068/071) ----
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON email_integrations
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE email_synced_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON email_synced_messages
  USING (
    user_id IN (
      SELECT id FROM users WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );
