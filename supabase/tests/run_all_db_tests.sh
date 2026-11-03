#!/bin/bash
# Reprodução do zero dos testes de banco deste branch.
#  1. Sobe um Postgres 16 descartável (container venddi-pg, sem porta publicada).
#  2. Cria o schema auth mínimo (auth.uid, auth.users) e as grants padrão do Supabase.
#  3. Aplica as migrations de supabase/migrations em ordem, parando no primeiro erro.
#  4. Roda cada suíte de supabase/tests/*.sql, parando na primeira falha.
# Não toca em nenhum projeto Supabase remoto. Requer Docker.
set -euo pipefail
cd "$(dirname "$0")/../.."

CONTAINER=venddi-pg
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

PSQL="docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -q"

$PSQL <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;
SQL

for f in supabase/migrations/*.sql; do
  echo "== migration $(basename "$f")"
  $PSQL < "$f" > /dev/null
done
echo "MIGRATIONS OK"

for f in supabase/tests/*.sql; do
  out=$(docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 < "$f" 2>&1) || true
  if echo "$out" | grep -q ERROR; then
    echo "FAIL $(basename "$f"): $(echo "$out" | grep ERROR | head -1)"
    exit 1
  fi
  echo "ok   $(basename "$f")"
done
echo "ALL DB TESTS OK"
