#!/bin/bash
# Sobe Postgres 16 local (Docker), aplica todas as migrations (0*.sql em ordem) com stub do schema
# auth do Supabase e executa todos os testes SQL + concorrência. Não toca em produção.
# Uso: bash supabase/tests/run_local_db_tests.sh   (requer Docker)
# Recria o Postgres local e aplica as migrations em ordem, parando no primeiro erro.
set -e
cd "$(dirname "$0")/../.."
docker rm -f venddi-pg >/dev/null 2>&1 || true
docker run -d --name venddi-pg -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
for i in $(seq 1 30); do docker exec venddi-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
PSQL="docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;
SQL
for f in supabase/migrations/0*.sql; do
  echo "== $f"
  $PSQL < "$f" > /dev/null
done
echo "MIGRATIONS OK"
for f in supabase/tests/*.sql; do

  rc=0
  out=$(docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 < "$f" 2>&1) || rc=$?
  if [ "$rc" -ne 0 ] || echo "$out" | grep -q ERROR; then
    echo "FAIL $f (rc=$rc): $(echo "$out" | grep -m1 ERROR)"
    exit 1
  fi
  echo "ok   $f"
done
bash "$(dirname "$0")/inventory_concurrency_check.sh"
bash "$(dirname "$0")/concorrencia_caixa.sh" 15
