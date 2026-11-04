#!/bin/bash
# Deadlock entre a numeração de venda (trava da empresa) e a entrada de estoque
# (trava do produto + checagem de chave estrangeira do movimento, que exige KEY SHARE na empresa).
#
# Uso: bash supabase/tests/concorrencia_chave_estrangeira.sh <FOR UPDATE | FOR NO KEY UPDATE>
#   - FOR UPDATE: esperado deadlock (uma das transações é abortada). Reproduz o achado do Codex.
#   - FOR NO KEY UPDATE: esperado nenhuma das duas transações falha.
# Requer o Postgres local de teste (container venddi-pg) com as migrations aplicadas.
set -u
MODE=${1:-"FOR NO KEY UPDATE"}
Q="docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 -At"
C=91111111-1111-1111-1111-111111111111
P=91100000-0000-4000-8000-000000000001
T=${TMPDIR:-/tmp}/fk_lock
mkdir -p "$T"

$Q -q <<SQL
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('$C', 'Lock FK', '91.111.111/0001-91', 'starter', 'active') ON CONFLICT (id) DO NOTHING;
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES ('$P', '$C', 'LK-1', 'Lock', 1, 2, 10, 1, true) ON CONFLICT (id) DO UPDATE SET stock_quantity = 10;
SQL

# Sessão da venda: trava a empresa (como a numeração de venda) e depois atualiza o produto
cat > "$T/venda.sql" <<SQL
BEGIN;
SELECT 1 FROM companies WHERE id = '$C' $MODE;
SELECT pg_sleep(1);
UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = '$P';
COMMIT;
SQL

# Sessão da entrada: atualiza o produto e depois insere o movimento (FK para a empresa)
cat > "$T/entrada.sql" <<SQL
BEGIN;
UPDATE products SET stock_quantity = stock_quantity + 1 WHERE id = '$P';
SELECT pg_sleep(0.3);
INSERT INTO stock_movements (company_id, product_id, type, quantity, balance_after, reference_type)
VALUES ('$C', '$P', 'in', 1, 1, 'entry');
COMMIT;
SQL

$Q < "$T/venda.sql" > "$T/venda.out" 2>&1 &
PV=$!
sleep 0.4
$Q < "$T/entrada.sql" > "$T/entrada.out" 2>&1 &
PE=$!
wait $PV; RV=$?
wait $PE; RE=$?

echo "modo: $MODE"
echo "venda:   exit=$RV $(grep -o 'deadlock detected' "$T/venda.out" | head -1)"
echo "entrada: exit=$RE $(grep -o 'deadlock detected' "$T/entrada.out" | head -1)"
if [ "$RV" -ne 0 ] || [ "$RE" -ne 0 ]; then
  echo "RESULTADO: uma transação falhou (deadlock)"
  exit 1
fi
echo "RESULTADO: ambas concluídas sem deadlock"
