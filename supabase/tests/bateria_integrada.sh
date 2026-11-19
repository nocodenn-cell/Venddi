#!/bin/bash
# Bateria integrada do release candidate. Para na primeira falha. Requer Docker e Node.
# Ordem: banco do zero (001..028) com todas as suítes, concorrências (inventário, guarda de venda,
# deadlock com entrada, estresse venda x conclusão), rollback, e unitários/tipos/build.
set -uo pipefail
cd "$(dirname "$0")/../.."
falha() { echo "FALHA: $1"; exit 1; }

echo "== 1. Reconstrução do zero e suítes SQL (run_local_db_tests)"
bash supabase/tests/run_local_db_tests.sh > /tmp/bateria_1.out 2>&1 || falha "run_local_db_tests"
grep -E "^ok|INVENTORY CONCURRENCY" /tmp/bateria_1.out | tail -3

echo "== 2. Guarda de saldo (concorrência de vendas no último estoque)"
bash supabase/tests/sale_stock_guard_check.sh > /tmp/bateria_2.out 2>&1 || falha "sale_stock_guard_check"
tail -1 /tmp/bateria_2.out

echo "== 3. Deadlock venda x entrada: FOR UPDATE deve falhar, FOR NO KEY UPDATE deve passar"
bash supabase/tests/concorrencia_chave_estrangeira.sh "FOR UPDATE" > /tmp/bateria_3a.out 2>&1
[ $? -eq 1 ] || falha "FOR UPDATE deveria dar deadlock e não deu"
bash supabase/tests/concorrencia_chave_estrangeira.sh "FOR NO KEY UPDATE" > /tmp/bateria_3b.out 2>&1 || falha "FOR NO KEY UPDATE deu deadlock"
tail -1 /tmp/bateria_3b.out

echo "== 4. Estresse venda x conclusão de inventário (40 rodadas)"
bash supabase/tests/stress_venda_inventario.sh 40 > /tmp/bateria_4.out 2>&1 || falha "estresse venda x inventário"
tail -2 /tmp/bateria_4.out

echo "== 5. Ensaio de rollback e reaplicação"
bash supabase/tests/ensaio_rollback.sh > /tmp/bateria_5.out 2>&1 || falha "ensaio_rollback"
tail -1 /tmp/bateria_5.out

echo "== 6. Unitários, tipos e build"
npx tsc --noEmit || falha "tsc"
npx vitest run > /tmp/bateria_6.out 2>&1 || falha "vitest"
grep -E "Tests " /tmp/bateria_6.out
npm run build > /tmp/bateria_6b.out 2>&1 || falha "build"
echo "BATERIA INTEGRADA OK"
