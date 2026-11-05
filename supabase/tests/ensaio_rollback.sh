#!/bin/bash
# Ensaio de rollback e recuperação, do zero, no Postgres local de teste (container venddi-pg):
#  1. Aplica as migrations 001..025 (conjunto integrado) e roda as suítes de referência.
#  2. Aplica os rollbacks seguros em ordem reversa (025, 024, 023, 020, 019) e confere que
#     os objetos sumiram.
#  3. Reaplica as migrations 019, 020, 023, 024 e 025 e roda as suítes de novo.
# Não toca em nenhum projeto Supabase remoto. Requer Docker.
set -euo pipefail
cd "$(dirname "$0")/../.."
CONTAINER=venddi-pg
PSQL="docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -q"
OBJ="SELECT (SELECT count(*) FROM pg_views WHERE viewname='produtos_estoque_baixo') || ',' ||
            (SELECT count(*) FROM pg_indexes WHERE indexname='idx_sales_company_sale_date') || ',' ||
            (SELECT count(*) FROM pg_proc WHERE proname='metricas_dashboard') || ',' ||
            (SELECT count(*) FROM pg_trigger WHERE tgname='products_stock_nao_negativo') || ',' ||
            (SELECT count(*) FROM information_schema.tables WHERE table_name='inventory_counts')"

echo "== 1. Conjunto integrado (001..025) do zero"
bash supabase/tests/run_all_db_tests.sh > /dev/null 2>&1 || { echo "FALHA na reconstrução"; exit 1; }
echo "   objetos (view,índice,função,trigger,tabela) = $(docker exec -i $CONTAINER psql -U postgres -At -c "$OBJ")  (esperado 1,1,1,1,1)"

echo "== 2. Rollbacks seguros em ordem reversa"
for m in 025 024 023 020 019; do
  f=$(ls supabase/rollback/${m}_rollback*.sql | head -1)
  if [ "$m" = "024" ]; then
    # DROP INDEX CONCURRENTLY não roda dentro de transação: sem --single-transaction
    docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -q < "$f"
  else
    $PSQL < "$f"
  fi
  echo "   rollback $m aplicado"
done
echo "   objetos após rollback = $(docker exec -i $CONTAINER psql -U postgres -At -c "$OBJ")  (esperado 0,0,0,0,0)"

echo "== 3. Reaplicação (019, 020, 023, 024, 025) e suítes"
for m in 019 020 023 024 025; do
  f=$(ls supabase/migrations/${m}_*.sql | head -1)
  if [ "$m" = "024" ]; then
    # Caminho oficial para 024 com volume: índice criado com CONCURRENTLY fora da migration.
    docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 -q -c \
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_company_sale_date ON sales (company_id, sale_date DESC);"
  fi
  $PSQL < "$f"
  echo "   migration $m reaplicada"
done
echo "   objetos após reaplicação = $(docker exec -i $CONTAINER psql -U postgres -At -c "$OBJ")  (esperado 1,1,1,1,1)"
for f in supabase/tests/dashboard_metrics_check.sql supabase/tests/e2e_fluxo_integrado.sql supabase/tests/isolamento_permissoes_vendas.sql; do
  [ -f "$f" ] || continue
  out=$(docker exec -i $CONTAINER psql -U postgres -v ON_ERROR_STOP=1 < "$f" 2>&1) || { echo "FALHA $f"; echo "$out" | tail -2; exit 1; }
  echo "   ok $(basename "$f")"
done
echo "ENSAIO DE ROLLBACK OK"
