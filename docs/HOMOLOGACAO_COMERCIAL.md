# Roteiro E2E integrado — homologação comercial do Venddi

Escopo: PDV, vendas, pagamentos, caixa, estoque, inventário e painel, com isolamento multiempresa e
permissões. Base: branch `homologacao/rc-integrado` (PRs #17, #18 e #19 integrados, migrations 001–027).

Legenda de status: **PASSOU** (executado e conferido), **FALHOU**, **NÃO TESTADO** (pendente de execução manual).

## 1. Automatizado (reproduzível do zero, sem projeto remoto)

Pré-requisito: Docker. Comandos a partir da raiz do repositório:

| Comando | O que cobre | Marca de sucesso |
|---|---|---|
| `bash supabase/tests/run_local_db_tests.sh` | Reconstrói o banco com 001–027, roda todas as suítes SQL e a concorrência de inventário | `INVENTORY CONCURRENCY OK` e exit 0 |
| `bash supabase/tests/sale_stock_guard_check.sh` | Duas vendas concorrentes no mesmo estoque: uma confirmada, uma recusada, saldo nunca negativo | `SALE STOCK GUARD OK` |
| `bash supabase/tests/concorrencia_chave_estrangeira.sh "FOR NO KEY UPDATE"` | Venda × entrada no mesmo produto sem deadlock | `ambas concluídas sem deadlock` |
| `bash supabase/tests/ensaio_rollback.sh` | Rollback seguro e reaplicação de 019–025 | `ENSAIO DE ROLLBACK OK` |
| `npx vitest run` | Regras de apresentação e cálculos (69 testes) | 69 passed |
| `npx tsc --noEmit && npm run build` | Tipos e build | sem erro |

Suítes SQL incluídas (cada uma imprime a marca indicada ao passar):

| Suíte | Cobre | Marca |
|---|---|---|
| `e2e_fluxo_integrado.sql` | Jornada completa: entrada, vendas dinheiro e cartão, desconto válido e inválido, suprimento e sangria, estorno, inventário com venda e entrada durante a contagem, conclusão idempotente, painel, permissões e isolamento | `E2E INTEGRADO OK` |
| `isolamento_permissoes_vendas.sql` | Venda e cancelamento entre empresas recusados; caixa não cancela; operador tem que ser o logado; trial só da própria empresa | `ISOLAMENTO E PERMISSOES OK` |
| `permissoes_caixa.sql` | Vendedor não grava caixa; razão imutável; valor inicial só gerência | `PERMISSOES CAIXA OK` |
| `dashboard_metrics_check.sql` | Painel: vendas, pedidos, estoque baixo, saldo do caixa, recentes, isolamento, sem usuário | `DASHBOARD METRICS OK` |
| `sale_rpc_regression_check.sql` | Venda com dinheiro e estorno: saldo antes/depois, movimento de caixa com `user_id` | `SALE RPC REGRESSION OK` |
| `inventory_count_check.sql` | Inventário: permissões, falta, sobra, zero, idempotência, cancelamento, RLS | `INVENTORY COUNT CHECKS OK` |
| `rls_*.sql`, `commission_discount_check.sql`, `register_tenant_check.sql` | Políticas RLS, cadastro de empresa, comissão e desconto | `ok` (sem ERROR) |

## 2. Execução na interface (navegador, ambiente local com usuários fictícios)

Ambiente: stack Supabase local, usuários `owner.a`, `gerente.a`, `operador.a` (caixa) e `owner.b`, todos
da senha de teste local. Executado em 3 de novembro de 2026.

| # | Fluxo | Status | Evidência |
|---|---|---|---|
| U1 | Login de owner (empresa A) | PASSOU | Entra em `/app/inicio` |
| U2 | Login de gerente | PASSOU | Vê Estoque e o histórico de inventários |
| U3 | Login de caixa (operador) | PASSOU | Item "Estoque" some do menu; `/app/estoque` redireciona para `/app/inicio` |
| U4 | Login de owner (empresa B) | PASSOU | Vê só "Produto Outra Loja" e o próprio inventário |
| U5 | Iniciar inventário (só produtos ativos) | PASSOU | 3 produtos; o inativo fica de fora |
| U6 | Contagem, zero, falta e sobra | PASSOU | Boné zero → "Falta 1"; Camiseta → "Falta 2" e depois "Falta 3"; sobra de 1 em duas linhas |
| U7 | Salvar e retomar; atualizar contagem | PASSOU | Recarregou; Camiseta 8 → 7 |
| U8 | Cancelar com rascunho inválido pendente, depois Voltar | PASSOU | Voltou à lista; inventário cancelado (correção do PR #17 confirmada) |
| U9 | Concluir com confirmação e auditoria | PASSOU | Movimentos `adjustment` com "Inventário: …" |
| U10 | Painel conferido com o banco | PASSOU | R$ 400,00 e 5 pedidos; estoque baixo 1 (Boné); caixa R$ 500,00; recentes |
| U11 | Filtro "Estoque baixo" em Produtos | PASSOU | Mostra só o Boné; desligado volta a lista completa |
| U12 | Permissão do caixa no menu e na rota | PASSOU | Ver U3 |
| U13 | Isolamento na listagem (owner B) | PASSOU | Ver U4 |
| U14 | Venda pela tela do PDV (dinheiro) | NÃO TESTADO | Executada pela RPC, não pela tela |
| U15 | Venda com cartão e pagamento misto pela tela | NÃO TESTADO | — |
| U16 | Desconto pela tela (válido, acima de 5%, no cartão) | NÃO TESTADO | Regras validadas pelo banco (E2E) |
| U17 | Mensagem de estoque insuficiente no PDV | NÃO TESTADO | Mapeamento validado por teste unitário e pela RPC |
| U18 | Abrir caixa, sangria e suprimento pela tela | NÃO TESTADO | A tela grava direto nas tabelas (ver GO/NO-GO) |
| U19 | Fechar caixa pela tela | NÃO TESTADO | Idem |
| U20 | Estorno e entrada de estoque pela tela | NÃO TESTADO | Executados pelas RPCs |

## 3. Roteiro manual a executar em homologação remota

Pré-requisito: migrations e app aplicados conforme `docs/PROCEDIMENTO_MIGRATIONS_HOMOLOGACAO.md`.

1. **PDV (dinheiro):** abrir caixa, vender 2 itens pagando em dinheiro. Esperado: venda concluída;
   estoque baixa; painel mostra a venda; saldo do caixa sobe pelo valor em dinheiro.
2. **PDV (cartão e misto):** venda só no cartão; venda com parte em dinheiro e parte no cartão.
   Esperado: total fechado; caixa recebe só o dinheiro.
3. **Desconto:** 5% em dinheiro (aceito); 10% (recusado com "Desconto acima de 5%"); 5% no cartão
   (recusado com "só pode ser paga em dinheiro"). Esperado: nada é gravado nas recusas.
4. **Estoque insuficiente:** tentar vender mais do que o saldo. Esperado: mensagem
   "Estoque insuficiente para o produto <SKU>" e nenhuma baixa.
5. **Suprimento e sangria:** registrar os dois. Esperado: saldo do caixa e painel refletem; não há
   como editar ou apagar o movimento depois.
6. **Estorno de venda pelo gerente:** cancelar uma venda. Esperado: estoque volta; caixa devolve o
   valor em dinheiro; venda aparece como cancelada. O caixa não consegue cancelar.
7. **Inventário completo:** contagem com zero, falta, sobra; venda durante a contagem; entrada
   durante a contagem; concluir. Esperado: saldos = contado + movimentos concorrentes; conclusão
   idempotente.
8. **Painel:** valores batem com os movimentos das etapas 1–7.
9. **Isolamento:** logar com owner de outra empresa e tentar ler/cancelar vendas e produtos da
   primeira. Esperado: nada aparece; ações são recusadas com "Acesso negado".
10. **Fechar caixa:** fechar o caixa do dia. Esperado: status fechado; o vendedor não consegue.

## 4. Matriz resumo

| Área | Automatizado | Interface | Conclusão |
|---|---|---|---|
| Vendas e pagamentos (RPC) | PASSOU | U14–U17 NÃO TESTADO | Regras de negócio OK; tela não validada |
| Caixa (permissões) | PASSOU | U18–U19 NÃO TESTADO | Permissões OK no banco; tela de caixa é o ponto fraco |
| Estoque e entrada | PASSOU | U20 NÃO TESTADO (RPC) | OK |
| Inventário | PASSOU | U5–U9 PASSOU | OK |
| Painel | PASSOU | U10 PASSOU | OK |
| Isolamento e permissões | PASSOU | U3, U4, U13 PASSOU | OK no banco e na tela |
| Migrations e rollback | PASSOU (ensaio) | — | Procedimento ensaiado |
