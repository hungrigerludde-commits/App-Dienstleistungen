#!/usr/bin/env bash
# Startet eine temporäre Postgres-Instanz, spielt die Migration ein und führt die Tests aus.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
DATA="$(mktemp -d)"
SOCK="$(mktemp -d)"
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA" "$SOCK"' EXIT
if [ "$(id -u)" = 0 ]; then RUN="runuser -u postgres --"; chown postgres "$DATA" "$SOCK"; else RUN=""; fi
$RUN "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DATA" -o "-k $SOCK -c listen_addresses=''" -l "$DATA/log" start >/dev/null
PSQL=(psql -h "$SOCK" -U postgres -v ON_ERROR_STOP=1 -q -t -A)
"${PSQL[@]}" -c "create database test"
"${PSQL[@]}" -d test -f "$HERE/supabase_stub.sql"
"${PSQL[@]}" -d test -f "$HERE/../migrations/20261118000000_init.sql"
"${PSQL[@]}" -d test -f "$HERE/rls_test.sql"
