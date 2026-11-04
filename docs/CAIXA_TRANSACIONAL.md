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
| CX-31 | Venda pela grade de produtos do PDV | A grade passou a carregar produtos reais (`getProducts`). E2E: venda pela grade, em dinheiro, gravada com item e produto reais | PASSOU (corrigido nesta branch) |
| CX-32 | Aplicação das migrations 026–029 no ambiente remoto de homologação | Não executado (só a stack local) | NÃO TESTADO |
| CX-33 | Rollback da 029 (`supabase/rollback/029_rollback.sql`), reaplicação da 028 e regressão de venda | Ensaio no Postgres local: rollback sem erro, 0 objetos da 029 restantes, 028 reaplicada, `sale_rpc_regression_check`, `isolamento_permissoes_vendas` e `e2e_fluxo_integrado` passam | PASSOU (ensaio local; não executado em homologação remota) |

## 7.1 Validação operacional (PDV, caixa, integridade e segurança)

Ambiente: stack Supabase local isolada (migrations 001 a 030), app em `localhost` e base de teste do runner. Nada foi aplicado em remoto ou produção.

**Etapa 1 — PDV**

| ID | Cenário | Resultado | Evidência / observação |
|---|---|---|---|
| PDV-01 | Busca por nome e SKU | PASSOU | Busca rápida e grade |
| PDV-02 | Código de barras | PASSOU | `7891234500002` localizou "Chá E2E" |
| PDV-03 | Alteração de quantidade | PASSOU (+) / lido (−) | "+" levou 1 para 2 e o total foi recalculado. O "−" usa a mesma função, lida no código e não executada |
| PDV-04 | Produtos fracionados | NÃO SUPORTADO | `sale_items.quantity` e `products.stock_quantity` são inteiros, e a tela só soma ou subtrai 1 |
| PDV-05 | Preços e descontos (5% em dinheiro) | PASSOU após correção | Antes: botão Confirmar desabilitado e "Faltam R$ 0,78" com pagamento completo (FALHOU). Depois: venda 3 gravou R$ 14,72 |
| PDV-06 | Múltiplos itens | PASSOU | Venda 5: Chá x2 + Pão = R$ 15,50 |
| PDV-07 | Pagamento dividido | PASSOU após correção | Antes: impossível, cada forma lançava o restante inteiro. Depois: venda 4 com dinheiro R$ 4,00 + PIX R$ 6,00; caixa recebeu só R$ 4,00 |
| PDV-08 | Troco | PASSOU após correção | Antes: não havia valor recebido (FALHOU). Depois: troco de R$ 5,28, R$ 1,00 e R$ 0,50. O valor recebido não é gravado (ver seção 8) |
| PDV-09 | Cancelamento pela tela de Vendas | PASSOU | Dono cancelou a Venda #9 (caixa aberto, R$ 10,00): venda `cancelled` com motivo, estorno de R$ 10,00 no caixa, total de vendas voltou a zero, auditoria `sale.cancel`. Venda #8 de caixa fechado foi recusada com a mensagem do banco. Caixa não vê o botão (sem `sales.cancel`). Antes, a API mandava um operador fixo (`usr_001`) e escondia a mensagem do banco |
| PDV-10 | Duplo envio da mesma venda | PASSOU | Chave por tentativa (antes, uma chave nova por clique). Testes de integridade 2 e cenário F da concorrência |

**Etapa 2 — Caixa (jornada completa pela interface)**

| ID | Passo | Resultado | Conferido no banco |
|---|---|---|---|
| CX-J1 | Abrir com R$ 100,00 | PASSOU | `initial_amount = 100` |
| CX-J2 | Suprimento de R$ 15,00 | PASSOU | `total_deposits = 15` |
| CX-J3 | Sangria de R$ 10,00 | PASSOU | `total_withdrawals = 10` |
| CX-J4 | Vendas em quatro meios: dinheiro R$ 15,50 (troco R$ 0,50), crédito R$ 10,00, débito R$ 6,00, PIX R$ 3,50 | PASSOU | Cada venda com o meio certo. A tela mostra o detalhamento e "Vendas em dinheiro" = R$ 15,50 |
| CX-J5 | Saldo esperado | PASSOU | R$ 120,50 = 100 + 15,50 + 15 − 10, igual ao banco |
| CX-J6 | Fechar contando R$ 120,00 sem observação | PASSOU (recusado) | Mensagem: "Fechamento com divergência de R$ -0.50 exige observação" |
| CX-J7 | Fechar com observação | PASSOU | `status = closed`, `final_amount = 120`, `closing_difference = -0.50` |
| CX-J8 | Bloqueio após fechamento | PASSOU | Sangria e venda em caixa fechado recusadas pela API. A tela mostra "Caixa Fechado" |
| CX-J9 | Reabrir caixa após fechar | PASSOU | Mesmo operador abre outro caixa |
| CX-J10 | Auditoria | PASSOU | `cash_operation_log`: abertura, suprimento, sangria e fechamento. `audit_logs`: 8 `sale.create` para 8 vendas, 1 `sale.cancel` |

**Etapa 3 — Integridade**

- Interface × banco: cada operação da jornada foi conferida no banco (valores acima).
- Duplicidade: venda com a mesma chave repetida não duplica (integridade 2). Duas tentativas simultâneas geram uma venda, um movimento e um total (concorrência F, 5 rodadas).
- Concorrência: abertura dupla, chave repetida, venda, sangria e estorno contra fechamento, com invariante, e duplo envio de venda com a mesma chave (cenário F). Execução limpa com 15 rodadas por cenário: 0 violações, 0 falhas. Execuções sobrepostas no mesmo banco geram falsos negativos; rodar uma de cada vez.
- Multiempresa: dono de outra empresa não cancela venda nem opera caixa (integridade 8, caixa 20 e 21).
- Falhas parciais: venda sem estoque, pagamento incompleto e sangria acima do saldo não deixam venda, pagamento, movimento nem estoque alterados (integridade 4 e 5, caixa 7).

**Etapa 4 — Segurança**

- Gravações diretas de caixa identificadas: `cashRegister.ts` (abrir, fechar, sangria e suprimento por `insert` e `update`) e, no banco, as políticas de INSERT e UPDATE em `cash_registers` e `cash_movements` (migration 027). Hoje a API só lê essas tabelas.
- Gravações diretas de venda: as políticas genéricas de INSERT, UPDATE e DELETE em `sales`, `payments`, `sale_items` e `audit_logs` (migration 005) permitiam qualquer usuário da empresa alterar venda e apagar auditoria pela API. A migration 030 removeu essas políticas (P0 corrigido).
- Operações financeiras: todas pelas RPCs `SECURITY DEFINER` com permissões verificadas dentro da função. A RLS fica só com leitura, exceto a gerência, que mantém UPDATE de valor inicial, e o trigger recusa status, fechamento e totais.
- Empresa bloqueada: as RPCs de caixa exigem `get_user_company_id()` igual à empresa do operador (corrigido após revisão do Codex).

**Problemas encontrados e corrigidos nesta etapa**

1. Venda com desconto nunca podia ser confirmada (botão comparava com o total sem desconto).
2. "Faltam" e "Troco" usavam o total sem desconto.
3. Forma de pagamento lançava sempre o restante; sem pagamento dividido nem troco.
4. Chave de idempotência da venda era nova a cada clique.
5. Estorno aparecia como entrada na lista de movimentos do caixa.
6. Painel do caixa mostrava "Vendas" sem separar os meios de pagamento; agora mostra o detalhamento e chama o total de "Vendas em dinheiro".
7. Políticas de escrita direta em vendas, pagamentos, itens e auditoria (P0).
8. Políticas de INSERT e UPDATE direto no caixa (migration 027) substituídas por RPCs (migration 030).
9. Script de concorrência reusava chaves entre execuções, o que dava falso negativo.

## 8. Limites e pendências

- Vendas não entram em `cash_operation_log`. A auditoria de venda continua em `sales` e nos movimentos `sale` de `cash_movements`.
- O rollback de 029 remove o log e as colunas de fechamento. Fazer backup antes.
- Um operador tem um caixa aberto por vez. Caixa compartilhado não é suportado.
- A conciliação com cartão e PIX não faz parte desta entrega.
- Produtos fracionados não são suportados: quantidade é inteira no banco e na tela (PDV-04).
- O valor recebido e o troco são calculados na tela e não são gravados. O caixa registra só o valor da venda em dinheiro, que é o que afeta o saldo. Se o troco precisar de auditoria, a tabela `payments` precisa de colunas próprias.
- A migration 030 ainda não foi aplicada no remoto de homologação. A stack local está com 001 a 030. Na stack local, a 029 foi reaplicada manualmente após a correção de empresa ativa, porque `migration up` não reexecuta migrations já registradas.
