#!/bin/sh
# Nightly Postgres dump for a self-hosted VM deployment — run this from a
# host cron job (see plan.md's Deployment section for the crontab line).
# Not wired into docker-compose itself: backups are an operator action with
# their own retention/off-box-copy concerns, not something that should
# start/stop with the app stack.
set -eu

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.yml exec -T postgres \
	pg_dump -U "${POSTGRES_USER:-psa}" "${POSTGRES_DB:-psa}" \
	| gzip > "$BACKUP_DIR/psa-$STAMP.sql.gz"

find "$BACKUP_DIR" -name 'psa-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backed up to $BACKUP_DIR/psa-$STAMP.sql.gz"
