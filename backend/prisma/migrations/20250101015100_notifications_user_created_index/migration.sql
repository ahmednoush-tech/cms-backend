-- ============================================================
-- 112_notifications_user_created_index.sql
--
-- Supports the two queries the real-time notifications engine
-- runs constantly:
--   1. The bell's list: WHERE user_id = ? ORDER BY created_at DESC
--   2. The cross-instance catch-up poller (NotificationBusService):
--      WHERE user_id IN (...) AND created_at > ?
-- The existing idx_notifications_user (user_id, is_read) and
-- idx_notifications_created_at (created_at) each cover only half
-- of either query; this composite index covers both fully, so they
-- stay fast as a user's notification history grows over months.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
