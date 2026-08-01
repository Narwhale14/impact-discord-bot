#!/bin/bash
set -euo pipefail

DB_PATH="${DATABASE_PATH:-$HOME/impact-data/bot.db}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/impact-backups}"
KEEP_DAYS="${KEEP_DAYS:-90}"

if [ ! -f "$DB_PATH" ]; then
    echo "$(date -Is) ERROR: no database at $DB_PATH" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
TARGET="$BACKUP_DIR/bot-$(date +%F_%H%M).db"

sqlite3 "$DB_PATH" "VACUUM INTO '$TARGET'"

if ! sqlite3 "$TARGET" "PRAGMA integrity_check" | grep -q '^ok$'; then
    echo "$(date -Is) ERROR: integrity check failed for $TARGET" >&2
    exit 1
fi

find "$BACKUP_DIR" -name 'bot-*.db' -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) ok $TARGET ($(du -h "$TARGET" | cut -f1))"
