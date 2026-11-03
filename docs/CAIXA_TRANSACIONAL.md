# Caixa transacional (sprint Caixa Transacional, migration 029)

Diagnóstico completo: [AUDITORIA_CAIXA.md](AUDITORIA_CAIXA.md). Este documento descreve o que foi entregue, como validar e o que ainda não foi testado.

## 1. O que mudou

- Abertura, sangria, suprimento e fechamento deixaram de gravar direto nas tabelas. Agora são RPCs (`abrir_caixa`, `registrar_movimento_caixa`, `fechar_caixa`), todas `SECURITY DEFINER` com permissões verificadas dentro da função.
- Cada operação recebe uma chave de idempotência. A tela gera a chave e a reaproveita em nova tentativa com os mesmos dados.
- Cada operação grava uma linha em `cash_operation_log` (imutável: sem UPDATE nem DELETE).
- Um operador tem no máximo um caixa aberto por empresa (índice único parcial).
- `status`, `closed_at`, `closed_by`, `final_amount`, `closing_difference` e os totais de `cash_registers` só mudam pelas funções do sistema. Um `UPDATE` direto pela API (role `authenticated`) é recusado por trigger.
- Venda e estorno travam o caixa antes dos produtos. Estorno de venda de caixa fechado é recusado, para o fechamento ser registro final.
- Fechamento compara o valor contado com o saldo esperado e grava a diferença. Divergência exige observação.

## 2. Regras de negócio

| Operação | Quem pode | Condição |
|---|---|---|
| Abrir caixa | owner, admin, manager, cashier | Empresa da sessão; operador é o usuário logado; sem outro caixa aberto para ele |
| Sangria / suprimento | owner, admin, manager, cashier | Caixa aberto; dono do caixa ou gerência; valor > 0; descrição obrigatória; sangria não pode passar do saldo esperado |
| Fechar caixa | owner, admin, manager, cashier | Caixa aberto; dono do caixa ou gerência; divergência exige observação |
| Venda em caixa | quem vende (regra de 028) | Caixa aberto; trava do caixa antes dos produtos |
| Estorno de venda | owner, admin, manager | Caixa da venda aberto |

Vendedor (`salesperson`) não abre, não movimenta e não fecha caixa. Valor inicial só muda por gerência (migration 027).

Chave de idempotência: repetir a mesma chave com os mesmos dados devolve o resultado original com `replay: true` e não grava de novo. Repetir a chave com dados diferentes é recusado.

## 3. Ordem de travas

- Venda: empresa (`FOR NO KEY UPDATE`) → caixa (`FOR NO KEY UPDATE`, com revalidação do status) → produtos por `product_id`.
- Estorno: venda → caixa (`FOR NO KEY UPDATE`) → produtos por `product_id`.
- Sangria, suprimento, fechamento e abertura: caixa (`FOR NO KEY UPDATE`), com trava consultiva da chave de idempotência.

Não há ciclo: o fechamento só trava o caixa, e a venda e o estorno travam o caixa antes dos produtos. Ver [ORDEM_TRAVAS_E_DEADLOCK.md](ORDEM_TRAVAS_E_DEADLOCK.md).

## 4. Como validar

```bash
# Banco do zero (migrations 001..029), todos os testes SQL e concorrência do caixa
bash supabase/tests/run_local_db_tests.sh

# Só concorrência do caixa, com 15 rodadas por cenário, sobre o banco já aplicado
bash supabase/tests/concorrencia_caixa.sh 15

# Só o teste de regras do caixa
docker exec -i venddi-pg psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/caixa_transacional.sql
```

## 5. Roteiro de homologação (manual, pela interface)

Pré-requisito: migrations até 029 aplicadas no ambiente de homologação, um dono, um caixa (cashier) e um produto com estoque. Nunca executar em produção sem backup.

1. Entrar como caixa. Abrir **Caixas** → **Abrir Caixa** com valor inicial 100. Esperado: "Caixa Aberto", saldo esperado R$ 100,00.
2. Tentar abrir outro caixa para o mesmo operador. Esperado: recusado ("Já existe caixa aberto para este operador").
3. Registrar suprimento de 20 ("Reforço de troco"). Esperado: saldo R$ 120,00 e movimento na lista.
4. Registrar sangria de 30 ("Troco retirado"). Esperado: saldo R$ 90,00.
5. Tentar sangria acima do saldo (ex.: 1000). Esperado: recusada, saldo inalterado.
6. No **PDV**, pesquisar o produto pelo nome, selecionar, pagar em **Dinheiro** e confirmar. Esperado: venda registrada; na tela de caixa, "Venda #n" na lista e saldo R$ 100,00.
7. Em **Fechar Caixa**, informar 95,00 sem observação. Esperado: recusado ("Fechamento com divergência de R$ -5.00 exige observação"); caixa continua aberto.
8. Informar observação e confirmar. Esperado: "Caixa fechado com diferença de R$ -5.00"; caixa em "Caixa Fechado".
9. Conferir no banco (ver seção 6): `cash_registers` com `status = closed`, `final_amount = 95`, `closing_difference = -5`, `closed_by` = caixa; `cash_operation_log` com abertura, suprimento, sangria e fechamento.

## 6. Conferência no banco (homologação)

```sql
SELECT status, initial_amount, total_sales, total_deposits, total_withdrawals,
       final_amount, closing_difference, closed_by
FROM cash_registers WHERE company_id = '<empresa>' ORDER BY opened_at DESC LIMIT 5;

SELECT operation, idempotency_key, result->>'difference' AS diferenca, created_at
FROM cash_operation_log WHERE company_id = '<empresa>' ORDER BY created_at;
```

## 7. Matriz de testes

Legenda: PASSOU = executado e verde; FALHOU = executado e vermelho; NÃO TESTADO = sem execução nesta entrega.

| ID | Cenário | Como foi testado | Resultado |
|---|---|---|---|
| CX-01 | Abrir caixa pela RPC | `caixa_transacional.sql` (1); E2E passo 1 | PASSOU |
| CX-02 | Dois caixas abertos para o mesmo operador, em sequência | `caixa_transacional.sql` (2) | PASSOU |
| CX-03 | Dois caixas abertos ao mesmo tempo | `concorrencia_caixa.sh` cenário A, 15 rodadas | PASSOU |
| CX-04 | Repetição de abertura com a mesma chave (sequencial) | `caixa_transacional.sql` (3) | PASSOU |
| CX-05 | Mesma chave de abertura em paralelo | `concorrencia_caixa.sh` cenário B, 15 rodadas | PASSOU |
| CX-06 | Chave reutilizada com outros dados | `caixa_transacional.sql` (4) | PASSOU |
| CX-07 | Vendedor tenta abrir caixa | `caixa_transacional.sql` (5) | PASSOU |
| CX-08 | Dono de outra empresa abre caixa na empresa A | `caixa_transacional.sql` (5b) | PASSOU |
| CX-09 | Sangria dentro do saldo | `caixa_transacional.sql` (6); E2E passo 4 | PASSOU |
| CX-10 | Sangria acima do saldo, e a recusa não grava nada (razão e totais inalterados) | `caixa_transacional.sql` (7); E2E passo 5 | PASSOU |
| CX-34 | Fração de centavo (0,005) recusada em vez de arredondada | `caixa_transacional.sql` (9) | PASSOU |
| CX-35 | Empresa suspensa com usuário ativo não opera caixa | `caixa_transacional.sql` (21) | PASSOU |
| CX-11 | Suprimento sem duplicar com repetição | `caixa_transacional.sql` (8) | PASSOU |
| CX-12 | Descrição vazia e valor zero | `caixa_transacional.sql` (9) | PASSOU |
| CX-13 | Vendedor movimenta caixa; caixa 2 movimenta caixa do caixa 1 | `caixa_transacional.sql` (10) | PASSOU |
| CX-14 | Gerente movimenta caixa de outro operador | `caixa_transacional.sql` (10) | PASSOU |
| CX-15 | Venda em caixa aberto entra no saldo | `caixa_transacional.sql` (11); E2E passo 6 | PASSOU |
| CX-16 | Fechamento com divergência sem observação | `caixa_transacional.sql` (12); E2E passo 7 | PASSOU |
| CX-17 | Fechamento com divergência e observação | `caixa_transacional.sql` (13); E2E passo 8 | PASSOU |
| CX-18 | Repetição do fechamento com a mesma chave | `caixa_transacional.sql` (14) | PASSOU |
| CX-19 | Movimento em caixa fechado | `caixa_transacional.sql` (15) | PASSOU |
| CX-20 | Venda em caixa fechado | `caixa_transacional.sql` (16) | PASSOU |
| CX-21 | Estorno de venda de caixa fechado | `caixa_transacional.sql` (17) | PASSOU |
| CX-22 | UPDATE direto de status e totais pela API | `caixa_transacional.sql` (18) | PASSOU |
| CX-23 | Log imutável; RLS do log entre empresas | `caixa_transacional.sql` (19, 20) | PASSOU |
| CX-24 | Permissões da migration 027 (vendedor, razão, valor inicial) | `permissoes_caixa.sql` | PASSOU |
| CX-25 | Venda × fechamento: invariante do caixa fechado | `concorrencia_caixa.sh` cenário C, 15 rodadas | PASSOU |
| CX-26 | Sangria × fechamento: invariante | `concorrencia_caixa.sh` cenário D, 15 rodadas | PASSOU |
| CX-27 | Cancelamento de venda × fechamento: invariante | `concorrencia_caixa.sh` cenário E, 15 rodadas | PASSOU |
| CX-28 | Fluxo completo pela interface, com conferência no banco | E2E manual (seção 5), 9 passos | PASSOU |
| CX-29 | Duplo clique em "Registrar Sangria" pela interface | Não automatizado. Coberto pela chave de idempotência (CX-04/CX-05) e pelo botão desabilitado | NÃO TESTADO (UI) |
| CX-30 | Dois caixas abertos ao mesmo tempo pela interface | Não automatizado. Coberto por CX-03 no banco | NÃO TESTADO (UI) |
| CX-31 | Venda pela grade de produtos do PDV | Não executado. Por leitura do código, a grade é uma lista fixa com ids `'1'`..`'5'` (não são UUID de produto), e a venda usa esses ids | NÃO TESTADO (defeito confirmado por leitura, fora do caixa) |
| CX-32 | Aplicação das migrations 026–029 no ambiente remoto de homologação | Não executado (só a stack local) | NÃO TESTADO |
| CX-33 | Rollback da 029 (`supabase/rollback/029_rollback.sql`), reaplicação da 028 e regressão de venda | Ensaio no Postgres local: rollback sem erro, 0 objetos da 029 restantes, 028 reaplicada, `sale_rpc_regression_check`, `isolamento_permissoes_vendas` e `e2e_fluxo_integrado` passam | PASSOU (ensaio local; não executado em homologação remota) |

## 8. Limites e pendências

- A grade de produtos do PDV é mock (CX-31): ids `'1'`..`'5'`, não produtos do banco. Não foi executada uma venda por ela. Corrigir antes de homologar venda pela grade. A busca rápida já usa produtos reais, e foi o caminho usado no E2E.
- Vendas não entram em `cash_operation_log`. A auditoria de venda continua em `sales` e nos movimentos `sale` de `cash_movements`.
- O rollback de 029 remove o log e as colunas de fechamento. Fazer backup antes.
- Um operador tem um caixa aberto por vez. Caixa compartilhado não é suportado.
- A conciliação com cartão e PIX não faz parte desta entrega.
