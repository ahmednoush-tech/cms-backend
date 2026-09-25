#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Restore a PostgreSQL backup created by backup-database.sh.
#
# Usage:
#   ./scripts/restore-database.sh /var/backups/cms/cms_backup_2026-08-26_03-00-00.sql.gz
#
# WARNING: this REPLACES the current database contents with the
# backup's contents. There is no undo. The script requires you to
# type the database name to confirm, specifically so this can
# never be run by accident via a stray Enter keypress.
# ============================================================

cd "$(dirname "$0")/.."

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  echo "" >&2
  echo "Available local backups:" >&2
  ls -lh "${BACKUP_DIR:-/var/backups/cms}"/cms_backup_*.sql.gz 2>/dev/null || echo "  (none found)" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd) — cannot read DATABASE_URL." >&2
  exit 1
fi
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -n1 | cut -d'=' -f2- | tr -d '"')"
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set in .env." >&2
  exit 1
fi

DB_NAME="$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"

echo "!!! THIS WILL PERMANENTLY REPLACE ALL DATA in database: ${DB_NAME} !!!"
echo "Backup to restore: ${BACKUP_FILE}"
echo ""
read -rp "Type the database name (${DB_NAME}) exactly to confirm, or anything else to cancel: " CONFIRM
if [ "$CONFIRM" != "$DB_NAME" ]; then
  echo "Cancelled — no changes made."
  exit 1
fi

echo "=== Restoring ==="
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
echo "=== Restore complete: $(date) ==="
