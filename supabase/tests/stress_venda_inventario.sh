#!/bin/bash
# Estresse: venda (carrinho na ordem P2,P1) e conclusão de inventário (P1,P2 por product_id)
# disputando os mesmos produtos, em N rodadas, com as duas transações simultâneas.
# Uso: bash supabase/tests/stress_venda_inventario.sh [N]   (padrão 40). Requer o container venddi-pg
# com as migrations 001..028 (ou sem 028 para comparar). Mede deadlocks e outras falhas.
set -u
N=${1:-40}
Q="docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 -At"
T=${TMPDIR:-/tmp}/stress_vi
mkdir -p "$T"
CO=93000000-0000-4000-8000-000000000001
OWN_AUTH=93000000-0000-4000-8000-0000000000a1
CX_AUTH=93000000-0000-4000-8000-0000000000a2
OWN=93000000-0000-4000-8000-000000000001
CX=93000000-0000-4000-8000-000000000002
CR=93000000-0000-4000-8000-000000000003
P1=93100000-0000-4000-8000-000000000001
P2=93100000-0000-4000-8000-000000000002

$Q -q <<SQL
INSERT INTO companies (id,name,cnpj,plan,status) VALUES ('$CO','Stress','93.000.000/0001-93','starter','active') ON CONFLICT (id) DO NOTHING;
INSERT INTO company_subscriptions (company_id,plan,status,trial_days) VALUES ('$CO','starter','active',15) ON CONFLICT DO NOTHING;
INSERT INTO users (id,company_id,auth_id,email,full_name,role,is_active) VALUES
 ('$OWN','$CO','$OWN_AUTH','own@stress.test','Owner','owner',true),
 ('$CX','$CO','$CX_AUTH','cx@stress.test','Caixa','cashier',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO products (id,company_id,sku,name,cost_price,sell_price,stock_quantity,min_stock,is_active) VALUES
 ('$P1','$CO','ST-1','P1',1,2,100,1,true),
 ('$P2','$CO','ST-2','P2',1,2,100,1,true) ON CONFLICT (id) DO NOTHING;
INSERT INTO cash_registers (id,company_id,user_id,status,initial_amount) VALUES ('$CR','$CO','$CX','open',0) ON CONFLICT (id) DO NOTHING;
SQL

deadlocks=0; falhas=0
for i in $(seq 1 "$N"); do
  $Q -q -c "UPDATE products SET stock_quantity = 100 WHERE company_id='$CO'" >/dev/null
  CID=$(printf "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$OWN_AUTH',false);\nSELECT iniciar_inventario('stress')->>'count_id';\n" | $Q | tail -1)
  printf "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$OWN_AUTH',false);\nSELECT registrar_contagem_item('$CID','$P1',90);\nSELECT registrar_contagem_item('$CID','$P2',90);\n" | $Q >/dev/null

  printf "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$CX_AUTH',false);\nSELECT create_atomic_sale('$CO','$CX','$CR','[{\"productId\":\"$P2\",\"quantity\":1,\"unitPrice\":2,\"discount\":0},{\"productId\":\"$P1\",\"quantity\":1,\"unitPrice\":2,\"discount\":0}]'::jsonb,'[{\"method\":\"cash\",\"amount\":4}]'::jsonb);\n" > "$T/venda.sql"
  printf "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$OWN_AUTH',false);\nSELECT concluir_inventario('$CID');\n" > "$T/conc.sql"

  $Q < "$T/venda.sql" > "$T/venda.out" 2>&1 &
  PV=$!
  $Q < "$T/conc.sql" > "$T/conc.out" 2>&1 &
  PC=$!
  wait $PV; RV=$?
  wait $PC; RC=$?

  if grep -q "deadlock detected" "$T/venda.out" "$T/conc.out"; then deadlocks=$((deadlocks+1))
  elif [ "$RV" -ne 0 ] || [ "$RC" -ne 0 ]; then falhas=$((falhas+1)); echo "rodada $i: falha inesperada venda=$RV conc=$RC $(cat "$T/venda.out" "$T/conc.out" | grep -m1 ERROR)"
  fi
done
echo "rodadas=$N deadlocks=$deadlocks falhas_inesperadas=$falhas"
if [ "$deadlocks" -eq 0 ] && [ "$falhas" -eq 0 ]; then echo "STRESS VENDA x INVENTARIO OK"; exit 0; fi
echo "STRESS VENDA x INVENTARIO COM FALHAS"; exit 1
