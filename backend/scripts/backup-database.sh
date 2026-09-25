#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Automated PostgreSQL backup with rotation.
#
# What it does:
#   1. Dumps the full database (schema + data) to a compressed,
#      timestamped file.
#   2. Deletes local backups older than RETENTION_DAYS.
#   3. (Optional) Copies the fresh backup to an offsite
#      destination, so a local disk/server failure can't destroy
#      both the database AND its backups at once.
#
# Usage (manual test run):
#   ./scripts/backup-database.sh
#
# Usage (automated, recommended — runs daily at 3:00 AM):
#   crontab -e
#   0 3 * * * /var/www/cms-backend/backend/scripts/backup-database.sh >> /var/log/cms-backup.log 2>&1
#
# Requires: pg_dump (from the postgresql-client package),
# reads DATABASE_URL from this project's .env file — no
# credentials are hardcoded here.
# ============================================================

cd "$(dirname "$0")/.."

# ---- Configuration ----
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cms}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="${BACKUP_DIR}/cms_backup_${TIMESTAMP}.sql.gz"

# ---- Offsite copy (optional — fill in ONE of these, or leave both
# blank to skip offsite copying entirely and rely on local backups
# only, which is NOT recommended for production) ----
# Option A: rclone to any cloud storage rclone supports (S3, Google
# Drive, Backblaze B2, etc.) — install via `curl https://rclone.org/install.sh | sudo bash`,
# then `rclone config` once to set up a remote named e.g. "cms-offsite".
OFFSITE_RCLONE_REMOTE="${OFFSITE_RCLONE_REMOTE:-}"   # e.g. "cms-offsite:backups/database"

# Option B: scp to a second server you control.
OFFSITE_SSH_TARGET="${OFFSITE_SSH_TARGET:-}"          # e.g. "user@backup-host:/backups/cms"

# ---- Load DATABASE_URL from .env without executing the whole file ----
if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd) — cannot read DATABASE_URL." >&2
  exit 1
fi
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -n1 | cut -d'=' -f2- | tr -d '"')"
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set in .env." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "=== [1/3] Dumping database to ${BACKUP_FILE} ==="
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"

echo "=== [2/3] Removing local backups older than ${RETENTION_DAYS} days ==="
find "$BACKUP_DIR" -name "cms_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete

echo "=== [3/3] Offsite copy ==="
if [ -n "$OFFSITE_RCLONE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "WARNING: rclone not installed — skipping offsite copy. Install with: curl https://rclone.org/install.sh | sudo bash" >&2
  else
    rclone copy "$BACKUP_FILE" "$OFFSITE_RCLONE_REMOTE" && echo "Copied to $OFFSITE_RCLONE_REMOTE"
  fi
elif [ -n "$OFFSITE_SSH_TARGET" ]; then
  scp "$BACKUP_FILE" "$OFFSITE_SSH_TARGET" && echo "Copied to $OFFSITE_SSH_TARGET"
else
  echo "No offsite destination configured (OFFSITE_RCLONE_REMOTE / OFFSITE_SSH_TARGET are both empty)."
  echo "Backups are LOCAL ONLY right now — a lost/corrupted server would lose the backups too."
  echo "Set one of these two variables (see comments in this script) to fix that."
fi

echo "=== Done: $(date) ==="
