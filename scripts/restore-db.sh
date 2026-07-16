#!/bin/sh
# Restores a gzipped dump produced by backup-db.sh. Destructive: this
# replaces data in the running `postgres` service. Usage:
#   ./scripts/restore-db.sh backups/psa-20260715-030000.sql.gz
set -eu

cd "$(dirname "$0")/.."

FILE="${1:?usage: restore-db.sh <path-to-dump.sql.gz>}"

gunzip -c "$FILE" | docker compose -f docker-compose.yml exec -T postgres \
	psql -U "${POSTGRES_USER:-psa}" "${POSTGRES_DB:-psa}"

echo "Restored from $FILE"
