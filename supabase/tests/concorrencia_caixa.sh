#!/bin/bash
# Concorrência do caixa (migration 029). Duas sessões simultâneas por rodada:
#   A. abertura dupla do mesmo operador com chaves diferentes: exatamente um caixa;
#   B. mesma chave de abertura em paralelo: um cria, o outro recebe replay; um caixa só;
#   C. venda x fechamento; D. sangria x fechamento; E. cancelamento x fechamento.
# Invariante após cada rodada de fechamento: total de vendas em dinheiro, total de sangrias e
# diferença gravada batem com os lançamentos. Violação = race que deixou dado inconsistente.
# Uso: bash supabase/tests/concorrencia_caixa.sh [N]   (padrão 15). Requer o container venddi-pg
# com as migrations 001..029. Sai com código 1 se houver violação ou falha inesperada.
set -u
N=${1:-15}
Q="docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 -At"
T=${TMPDIR:-/tmp}/conc_caixa
mkdir -p "$T"
CO=94000000-0000-4000-8000-000000000001
OWN_AUTH=94000000-0000-4000-8000-0000000000a1
OWN=94000000-0000-4000-8000-000000000001
CX_AUTH=94000000-0000-4000-8000-0000000000a2
CX=94000000-0000-4000-8000-000000000002
P1=94100000-0000-4000-8000-000000000001

$Q -q <<SQL >/dev/null
INSERT INTO companies (id,name,cnpj,plan,status) VALUES ('$CO','Conc Caixa','94.000.000/0001-94','starter','active') ON CONFLICT (id) DO NOTHING;
INSERT INTO company_subscriptions (company_id,plan,status,trial_days) VALUES ('$CO','starter','active',15) ON CONFLICT DO NOTHING;
INSERT INTO users (id,company_id,auth_id,email,full_name,role,is_active) VALUES
 ('$OWN','$CO','$OWN_AUTH','own@conc.test','Owner','owner',true),
 ('$CX','$CO','$CX_AUTH','cx@conc.test','Caixa','cashier',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO products (id,company_id,sku,name,cost_price,sell_price,stock_quantity,min_stock,is_active) VALUES
 ('$P1','$CO','CC-1','P1',1,5,1000,1,true) ON CONFLICT (id) DO NOTHING;
SQL

# Executa SQL como um usuário autenticado (RLS e auth.uid() como na API).
run() {
  printf "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','%s',false);\n%s\n" "$1" "$2" | $Q > "$3" 2>&1
}
# Executa SQL como superusuário (preparação e leitura do estado).
sqlq() { echo "$1" | $Q; }
# Fecha caixas abertos entre rodadas (UPDATE como superusuário; o guarda só recusa authenticated).
limpa() { sqlq "UPDATE cash_registers SET status='closed', closed_at=COALESCE(closed_at,NOW()) WHERE company_id='$CO' AND status='open';" >/dev/null; sqlq "UPDATE products SET stock_quantity=1000 WHERE company_id='$CO';" >/dev/null; }
# Invariante do caixa fechado: vendas em dinheiro, sangrias e diferença batem com os lançamentos.
invariante() {
  sqlq "SELECT CASE WHEN
    (SELECT status FROM cash_registers WHERE id='$1')='closed'
    AND (SELECT total_sales FROM cash_registers WHERE id='$1') = (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN sales s ON s.id=p.sale_id WHERE s.cash_register_id='$1' AND s.status<>'cancelled' AND p.method='cash')
    AND (SELECT total_withdrawals FROM cash_registers WHERE id='$1') = (SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE cash_register_id='$1' AND type='withdrawal')
    AND (SELECT closing_difference FROM cash_registers WHERE id='$1') = (SELECT final_amount FROM cash_registers WHERE id='$1') - (SELECT initial_amount + total_sales + total_deposits - total_withdrawals FROM cash_registers WHERE id='$1')
  THEN 'OK' ELSE 'VIOLACAO' END;"
}
abre() { # $1 = chave, $2 = valor inicial
  run "$CX_AUTH" "SELECT abrir_caixa('$CO', $2, '$1');" "$T/abre_$1.out"
  sqlq "SELECT id FROM cash_registers WHERE company_id='$CO' AND status='open' AND user_id='$CX';"
}
VIOL=0; FALHAS=0
ITEM="[{\"productId\":\"$P1\",\"quantity\":1,\"unitPrice\":5,\"discount\":0}]"
PAG='[{"method":"cash","amount":5}]'

for i in $(seq 1 "$N"); do
  # A. Abertura dupla, chaves diferentes
  limpa
  run "$CX_AUTH" "SELECT abrir_caixa('$CO', 10, 'A-$i-1');" "$T/a1.out" & P1P=$!
  run "$CX_AUTH" "SELECT abrir_caixa('$CO', 10, 'A-$i-2');" "$T/a2.out" & P2P=$!
  wait $P1P; wait $P2P
  ok=$(grep -l '"success": true' "$T"/a1.out "$T"/a2.out 2>/dev/null | wc -l)
  err=$(grep -l 'Já existe caixa aberto' "$T"/a1.out "$T"/a2.out 2>/dev/null | wc -l)
  abertos=$(sqlq "SELECT COUNT(*) FROM cash_registers WHERE company_id='$CO' AND status='open' AND user_id='$CX';")
  if [ "$ok" -ne 1 ] || [ "$err" -ne 1 ] || [ "$abertos" -ne 1 ]; then VIOL=$((VIOL+1)); echo "rodada $i A: ok=$ok recusado=$err abertos=$abertos"; fi

  # B. Mesma chave em paralelo: um cria, o outro recebe replay
  limpa
  run "$CX_AUTH" "SELECT abrir_caixa('$CO', 10, 'B-$i');" "$T/b1.out" & P1P=$!
  run "$CX_AUTH" "SELECT abrir_caixa('$CO', 10, 'B-$i');" "$T/b2.out" & P2P=$!
  wait $P1P; wait $P2P
  ok=$(grep -l '"success": true' "$T"/b1.out "$T"/b2.out 2>/dev/null | wc -l)
  replay=$(grep -h '"replay": true' "$T"/b1.out "$T"/b2.out 2>/dev/null | wc -l)
  abertos=$(sqlq "SELECT COUNT(*) FROM cash_registers WHERE company_id='$CO' AND status='open' AND user_id='$CX';")
  if [ "$ok" -ne 2 ] || [ "$replay" -ne 1 ] || [ "$abertos" -ne 1 ]; then VIOL=$((VIOL+1)); echo "rodada $i B: ok=$ok replay=$replay abertos=$abertos"; fi

  # C. Venda x fechamento: o fechamento sempre conclui; a venda entra antes ou é recusada
  limpa
  R=$(abre "C-$i-open" 0)
  run "$CX_AUTH" "SELECT create_atomic_sale('$CO', '$CX', '$R', '$ITEM'::jsonb, '$PAG'::jsonb);" "$T/c1.out" & P1P=$!
  run "$CX_AUTH" "SELECT fechar_caixa('$R', 5, 'C-$i-close', 'fechamento de teste');" "$T/c2.out" & P2P=$!
  wait $P1P; wait $P2P
  if ! grep -q '"success": true' "$T/c2.out"; then FALHAS=$((FALHAS+1)); echo "rodada $i C: fechamento falhou: $(grep -m1 ERROR "$T/c2.out")"; fi
  inv=$(invariante "$R")
  if [ "$inv" != "OK" ]; then VIOL=$((VIOL+1)); echo "rodada $i C: invariante $inv"; fi

  # D. Sangria x fechamento
  limpa
  R=$(abre "D-$i-open" 20)
  run "$CX_AUTH" "SELECT registrar_movimento_caixa('$R', 'withdrawal', 5, 'Sangria concorrente', 'D-$i-w');" "$T/d1.out" & P1P=$!
  run "$CX_AUTH" "SELECT fechar_caixa('$R', 15, 'D-$i-close', 'fechamento de teste');" "$T/d2.out" & P2P=$!
  wait $P1P; wait $P2P
  if ! grep -q '"success": true' "$T/d2.out"; then FALHAS=$((FALHAS+1)); echo "rodada $i D: fechamento falhou: $(grep -m1 ERROR "$T/d2.out")"; fi
  inv=$(invariante "$R")
  if [ "$inv" != "OK" ]; then VIOL=$((VIOL+1)); echo "rodada $i D: invariante $inv"; fi

  # E. Cancelamento de venda x fechamento
  limpa
  R=$(abre "E-$i-open" 0)
  run "$CX_AUTH" "SELECT create_atomic_sale('$CO', '$CX', '$R', '$ITEM'::jsonb, '$PAG'::jsonb);" "$T/e0.out"
  S=$(sqlq "SELECT id FROM sales WHERE company_id='$CO' AND cash_register_id='$R' AND status<>'cancelled' LIMIT 1;")
  run "$OWN_AUTH" "SELECT cancel_sale_with_reversal('$S', '$CO', '$OWN', 'teste concorrente');" "$T/e1.out" & P1P=$!
  run "$CX_AUTH" "SELECT fechar_caixa('$R', 5, 'E-$i-close', 'fechamento de teste');" "$T/e2.out" & P2P=$!
  wait $P1P; wait $P2P
  if ! grep -q '"success": true' "$T/e2.out"; then FALHAS=$((FALHAS+1)); echo "rodada $i E: fechamento falhou: $(grep -m1 ERROR "$T/e2.out")"; fi
  inv=$(invariante "$R")
  if [ "$inv" != "OK" ]; then VIOL=$((VIOL+1)); echo "rodada $i E: invariante $inv"; fi
done

limpa
echo "rodadas=$N violacoes=$VIOL falhas_inesperadas=$FALHAS"
if [ "$VIOL" -eq 0 ] && [ "$FALHAS" -eq 0 ]; then echo "CONCORRENCIA CAIXA OK"; exit 0; fi
echo "CONCORRENCIA CAIXA COM FALHAS"; exit 1
