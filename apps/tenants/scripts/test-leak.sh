#!/usr/bin/env bash
# Run the leak test locally: throwaway pgvector Postgres in Docker, migration applied, pytest.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=tenants-leak-test; PORT=${PORT:-54399}
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --rm --name $NAME -e POSTGRES_PASSWORD=pg -p $PORT:5432 pgvector/pgvector:pg16 >/dev/null
trap 'docker stop $NAME >/dev/null' EXIT
until docker exec $NAME pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2
for f in supabase/ci/00_auth_stub.sql supabase/migrations/*.sql; do
  docker exec -i $NAME psql -U postgres -v ON_ERROR_STOP=1 -q < "$f"
done
export TENANTS_TEST_DATABASE_URL="postgresql://postgres:pg@localhost:$PORT/postgres"
VENV=.venv-leak
[ -d $VENV ] || python3 -m venv $VENV
$VENV/bin/pip install -q -r tests/requirements.txt
$VENV/bin/pytest -q tests "$@"
