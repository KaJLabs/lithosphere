#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
[[ -f "$BACKUP_FILE" ]] || { echo "backup does not exist: $BACKUP_FILE" >&2; exit 1; }
[[ "$RESTORE_DATABASE_URL" == *restore* ]] || {
  echo "refusing restore drill: target URL must identify a disposable restore database" >&2; exit 1;
}

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "$BACKUP_FILE").sha256")
fi
gzip -t "$BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --tuples-only --command \
  "SELECT 'blocks=' || COUNT(*) FROM blocks; SELECT 'transactions=' || COUNT(*) FROM transactions;"
echo "Disposable restore drill completed successfully"
