#!/bin/bash
# Concorrência real (duas sessões psql) no Postgres local de teste (venddi-pg).
P="docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 -qAt"
AUTH=a0000000-0000-4000-8000-00000000000a
P1=d1000000-0000-4000-8000-000000000001
$P <<SQL
INSERT INTO companies (id,name,cnpj,plan,status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO company_subscriptions (company_id,plan,status,trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15);
INSERT INTO users (id,company_id,auth_id,email,full_name,role,is_active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','$AUTH','o@t.com','O','owner',true);
INSERT INTO products (id,company_id,sku,name,cost_price,sell_price,stock_quantity,min_stock) VALUES ('$P1','11111111-1111-1111-1111-111111111111','S1','P',1,2,10,1);
SQL
as_owner="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$AUTH',false);"

C1=$(echo "$as_owner SELECT (iniciar_inventario('C1')->>'count_id');" | $P | tail -1)
echo "$as_owner SELECT registrar_contagem_item('$C1','$P1',8);" | $P >/dev/null

# Cenário 1: venda (-3) segura a linha do produto enquanto a conclusão começa
echo "SELECT stock_quantity FROM products WHERE id='$P1';" >/dev/null
( $P <<SQL
BEGIN;
UPDATE products SET stock_quantity = stock_quantity - 3 WHERE id = '$P1';
SELECT pg_sleep(3);
COMMIT;
SQL
) >/dev/null 2>&1 &
sleep 1
echo "$as_owner SELECT concluir_inventario('$C1');" | $P | tail -1
wait
S1=$($P -c "SELECT stock_quantity FROM products WHERE id='$P1'")
echo "CENARIO 1 (venda concorrente): saldo final=$S1 (esperado 5 = 10 - 3 venda - 2 falta)"

# Cenário 2: duas conclusões simultâneas do mesmo inventário
C2=$(echo "$as_owner SELECT (iniciar_inventario('C2')->>'count_id');" | $P | tail -1)
echo "$as_owner SELECT registrar_contagem_item('$C2','$P1',4);" | $P >/dev/null
( echo "$as_owner SELECT concluir_inventario('$C2');" | $P ) > ${TMPDIR:-/tmp}/conc_a.out 2>&1 &
( echo "$as_owner SELECT concluir_inventario('$C2');" | $P ) > ${TMPDIR:-/tmp}/conc_b.out 2>&1 &
wait
S2=$($P -c "SELECT stock_quantity FROM products WHERE id='$P1'")
MOV=$($P -c "SELECT count(*) FROM stock_movements WHERE reference_id='$C2'")
echo "CENARIO 2 (conclusões simultâneas): saldo=$S2 (esperado 4 = 5 - 1), movimentos=$MOV (esperado 1)"
echo "  resultado A: $(tail -1 ${TMPDIR:-/tmp}/conc_a.out)"
echo "  resultado B: $(tail -1 ${TMPDIR:-/tmp}/conc_b.out)"
