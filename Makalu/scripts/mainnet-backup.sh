#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lithoscan-mainnet}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/lithoscan-mainnet-$timestamp.sql.gz"

umask 077
mkdir -p "$BACKUP_DIR"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
gzip -t "$backup_file"

find "$BACKUP_DIR" -type f -name 'lithoscan-mainnet-*.sql.gz*' -mtime "+$BACKUP_RETENTION_DAYS" -delete
echo "Backup completed: $backup_file"
