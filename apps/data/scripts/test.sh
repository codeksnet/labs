#!/usr/bin/env bash
# Scraper tests: pure tests always; DB tests against a throwaway Postgres in Docker.
set -euo pipefail
cd "$(dirname "$0")/../scraper"
NAME=data-scraper-test; PORT=${PORT:-54398}
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --rm --name $NAME -e POSTGRES_PASSWORD=pg -p $PORT:5432 postgres:16 >/dev/null
trap 'docker stop $NAME >/dev/null' EXIT
until docker exec $NAME pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2
docker exec -i $NAME psql -U postgres -v ON_ERROR_STOP=1 -q < ../supabase/migrations/0001_data.sql
export DATABASE_URL="postgresql://postgres:pg@localhost:$PORT/postgres"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -e ".[dev]"
[ -n "${SKIP_LINT:-}" ] || .venv/bin/ruff check .
.venv/bin/pytest -q "$@"
