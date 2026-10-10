#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and runs the SQL tests
# in supabase/tests/. Needs Postgres server binaries (initdb/pg_ctl/psql) —
# e.g. `apt-get install postgresql` or `brew install postgresql@16`.
#
# Set DATABASE_URL to use an existing *empty scratch* database instead of
# spinning up a temporary cluster. Never point this at a real project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  if ! command -v initdb >/dev/null 2>&1; then
    for d in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
      [[ -x "$d/initdb" ]] && PATH="$d:$PATH" && break
    done
  fi
  command -v initdb >/dev/null 2>&1 || { echo "initdb not found — install Postgres or set DATABASE_URL" >&2; exit 1; }

  TMP="$(mktemp -d)"
  PORT="${PGTEST_PORT:-54329}"
  cleanup() { pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
  trap cleanup EXIT
  initdb -D "$TMP/data" -U postgres --auth=trust >/dev/null
  pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@/postgres?host=$TMP&port=$PORT"
fi

PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null 2>&1 || { echo "migration failed: $f" >&2; "${PSQL[@]}" -f "$f"; exit 1; }
done
echo "Applied $(ls "$ROOT"/supabase/migrations/*.sql | wc -l) migrations."

for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "== $(basename "$t")"
  "${PSQL[@]}" -f "$t" 2>&1 | sed -n 's/^psql:.*NOTICE:  //p; /FAIL\|ERROR/p; /passed/p'
  test "${PIPESTATUS[0]}" -eq 0
done
