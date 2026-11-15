#!/bin/bash
# Reenvio concorrente de venda (queda de rede + duplo clique): duas sessões criam a MESMA venda
# (mesma chave de idempotência) ao mesmo tempo. Esperado: uma venda, uma baixa de estoque, um pagamento.
# Usa commits reais (não BEGIN/ROLLBACK) porque a concorrência só existe entre transações commitadas.
# Requer o container venddi-pg com as migrations 001..031 aplicadas (run_local_db_tests.sh).
set -e
C=venddi-pg
K=83bb0000-0000-4000-8000-0000000000c1
CO=84111111-1111-1111-1111-111111111111
OWNER_AUTH=84000000-0000-4000-8000-0000000000a1
CAIXA_AUTH=84000000-0000-4000-8000-0000000000a2
CAIXA_USER=84000000-0000-4000-8000-000000000002
CR=84200000-0000-4000-8000-000000000001
P=84100000-0000-4000-8000-000000000001

docker exec -i $C psql -U postgres -v ON_ERROR_STOP=1 -q <<SQL
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('$CO', 'Reenvio Concorrente', '84.111.111/0001-84', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('$CO', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('84000000-0000-4000-8000-000000000001', '$CO', '$OWNER_AUTH', 'o@reenvio.test', 'Dono', 'owner', true),
  ('$CAIXA_USER', '$CO', '$CAIXA_AUTH', 'c@reenvio.test', 'Caixa', 'cashier', true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active)
  VALUES ('$P', '$CO', 'RC-1', 'Produto RC', 4, 10, 10, 1, true);
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES ('$CR', '$CO', '$CAIXA_USER', 'open', 50);
SQL

venda() {
  docker exec -i $C psql -U postgres -At -v ON_ERROR_STOP=1 <<SQL 2>&1
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$CAIXA_AUTH', false);
SELECT create_atomic_sale('$CO', '$CAIXA_USER', '$CR',
  '[{"productId":"$P","quantity":3,"unitPrice":10,"discount":0}]'::jsonb,
  '[{"method":"cash","amount":30}]'::jsonb, NULL, 0, 0, NULL, '$K');
SQL
}

# Três tentativas simultâneas com a mesma chave (duplo clique + dois reenvios)
venda > /tmp/rc1.out & venda > /tmp/rc2.out & venda > /tmp/rc3.out &
wait

ok=1
N=$(docker exec -i $C psql -U postgres -At -c "SELECT COUNT(*) FROM sales WHERE idempotency_key='$K'")
S=$(docker exec -i $C psql -U postgres -At -c "SELECT stock_quantity FROM products WHERE id='$P'")
PG=$(docker exec -i $C psql -U postgres -At -c "SELECT COUNT(*) FROM payments p JOIN sales s ON s.id=p.sale_id WHERE s.idempotency_key='$K'")
SALES_IDS=$(docker exec -i $C psql -U postgres -At -c "SELECT DISTINCT id FROM sales WHERE idempotency_key='$K'" | wc -l)
echo "vendas com a chave=$N (esperado 1) | ids distintos=$SALES_IDS | pagamentos=$PG (esperado 1) | estoque=$S (esperado 7)"
[ "$N" = "1" ] || ok=0
[ "$SALES_IDS" = "1" ] || ok=0
[ "$PG" = "1" ] || ok=0
[ "$S" = "7" ] || ok=0
for f in /tmp/rc1.out /tmp/rc2.out /tmp/rc3.out; do
  grep -q "ERROR" "$f" && { echo "tentativa falhou: $(grep -m1 ERROR "$f")"; }
done
if [ "$ok" = "1" ]; then echo "REENVIO CONCORRENTE OK"; else echo "REENVIO CONCORRENTE FALHOU"; exit 1; fi
