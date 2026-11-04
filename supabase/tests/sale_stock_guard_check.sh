#!/bin/bash
# Teste de concorrência da baixa de estoque (migration 020).
# Duas baixas simultâneas de 5 unidades sobre saldo 9: exatamente uma pode ser confirmada.
# Requer o Postgres local de teste (container venddi-pg) com migrations 001..020 aplicadas.
Q="docker exec -i venddi-pg psql -U postgres -qAt"
P=d1000000-0000-4000-8000-000000000099
T=${TMPDIR:-/tmp}/sale_guard
mkdir -p "$T"

$Q <<SQL
INSERT INTO companies (id,name,cnpj,plan,status) VALUES ('11111111-1111-1111-1111-111111111199','Guard','11.111.111/1199-99','starter','active') ON CONFLICT DO NOTHING;
INSERT INTO products (id,company_id,sku,name,cost_price,sell_price,stock_quantity,min_stock) VALUES ('$P','11111111-1111-1111-1111-111111111199','G1','Guard',1,2,9,1) ON CONFLICT (id) DO UPDATE SET stock_quantity = 9;
SQL

printf "BEGIN;\nUPDATE products SET stock_quantity = stock_quantity - 5 WHERE id='$P';\nSELECT pg_sleep(2);\nCOMMIT;\n" > "$T/a.sql"
printf "BEGIN;\nUPDATE products SET stock_quantity = stock_quantity - 5 WHERE id='$P';\nCOMMIT;\n" > "$T/b.sql"

$Q < "$T/a.sql" > "$T/a.out" 2>&1 &
sleep 0.5
$Q < "$T/b.sql" > "$T/b.out" 2>&1
wait

FINAL=$($Q -c "SELECT stock_quantity FROM products WHERE id='$P'")
ERRS_A=$(grep -c "Estoque insuficiente para o produto" "$T/a.out")
ERRS_B=$(grep -c "Estoque insuficiente para o produto" "$T/b.out")
echo "baixa A: $( [ "$ERRS_A" -gt 0 ] && echo recusada || echo confirmada )"
echo "baixa B: $( [ "$ERRS_B" -gt 0 ] && echo recusada || echo confirmada )"
echo "saldo final: $FINAL (esperado 4 = 9 - 5; nunca negativo)"
if [ "$FINAL" = "4" ] && [ $((ERRS_A + ERRS_B)) -eq 1 ]; then echo "SALE STOCK GUARD OK"; else echo "SALE STOCK GUARD FALHOU"; exit 1; fi
