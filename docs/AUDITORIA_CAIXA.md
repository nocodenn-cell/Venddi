# Auditoria do caixa (Etapa 1 da sprint Caixa Transacional)

Base: `homologacao/rc-integrado` (`fed3c01`). Migrations 001..028.
Legenda: **Reproduzido** = confirmado com psql no Postgres local. **Pelo código** = lido em arquivo e ainda não reproduzido; cada item vira teste na Etapa 3.

## 1. Gravações diretas da interface (o que a tela faz hoje)

| Ação | Tela (`CashRegisterPage.tsx`) | Gravação em `src/lib/api/cashRegister.ts` |
|---|---|---|
| Abrir caixa | `openCashRegister` | `insert` em `cash_registers` com `operator_id` |
| Sangria | `registerWithdrawal` | `insert` em `cash_movements` (`balance_after: 0`) e `update` em `cash_registers` |
| Suprimento | `registerDeposit` | `insert` em `cash_movements` (`balance_after: 0`) e `update` em `cash_registers` |
| Fechar caixa | `closeCashRegister` | `update` direto de `status`, `closed_at`, `final_amount`, `closing_notes` |

Leitura: `getOpenCashRegister` (tela e PDV), `getCashMovements`, `getCashRegister`.
Vendas e estornos já são RPCs (`create_atomic_sale`, `cancel_sale_with_reversal`) e continuam a atualizar `cash_registers.total_sales`.

## 2. Achados

| # | Achado | Evidência | Gravidade |
|---|---|---|---|
| A1 | **Abertura de caixa falha.** O cliente grava `operator_id`, que não existe em `cash_registers` (existe `user_id NOT NULL`). | Reproduzido: `ERROR: column "operator_id" of relation "cash_registers" does not exist` | Crítica |
| A2 | **Consulta do caixa aberto falha.** `getOpenCashRegister` filtra por `operator_id`. Com erro, a tela mostra "Caixa fechado" e o PDV bloqueia a venda. | Pelo código (`cashRegister.ts:425`) e dependência de PDV (`PDVPage.tsx:86`) | Crítica |
| A3 | **Sangria e suprimento não alteram o saldo.** `supabase.rpc(...)` dentro de `update({...})` não é executado, e `balance_after` fica em 0. Os totais do caixa nunca mudam. | Pelo código (`cashRegister.ts:211-213`, `298-300`) | Crítica |
| A4 | **Sangria em caixa fechado não é bloqueada.** A política de INSERT só checa empresa e papel, não o status do caixa. | Pela política de 027 (`cash_movements`, "Caixa registra movimento") | Alta (confirmar em teste) |
| A5 | **Fechamento não confere saldo.** Não calcula o saldo esperado, não grava divergência, não exige justificativa, não registra quem fechou. | Pelo código (`cashRegister.ts:116`) | Alta |
| A6 | **Dois caixas abertos para o mesmo operador são possíveis.** Só há índice único na chave primária. | Reproduzido: `pg_indexes` de `cash_registers` tem apenas `cash_registers_pkey` | Alta |
| A7 | **Sem idempotência.** Duplo clique ou nova tentativa após falha de rede gera duas sangrias. O botão não é desabilitado durante o envio. | Pelo código (`CashRegisterPage.tsx:114-141`) | Alta |
| A8 | **Corrida venda × fechamento.** A venda lê o status do caixa antes de travar a empresa (028, linha 69 contra 164). Um fechamento entre as duas etapas deixa a venda gravada em caixa fechado. | Pela ordem de leitura em 028 (não reproduzido ainda) | Alta |
| A9 | **Estorno altera caixa fechado.** `cancel_sale_with_reversal` atualiza `total_sales` sem checar o status do caixa. | Pelo código (028, bloco de estorno) | Alta |
| A10 | **Cashier altera qualquer caixa da empresa.** A política "Caixa atualiza caixa" não restringe ao dono do caixa; permite mudar `status` diretamente. | Pela política de 027 | Alta |
| A11 | **Totais por RPC inexistentes.** `increment_total_withdrawals` e `increment_total_deposits` não são chamadas de fato no código. | Pelo código e ausência de funções nas migrations | Média (resolvido pela RPC nova) |
| A12 | **Vendedor não grava no caixa.** Migration 027 bloqueia o vendedor (sangria, zerar valor inicial, fechar). | `supabase/tests/permissoes_caixa.sql` passa | Coberto |
| A13 | **Razão imutável.** `cash_movements` não aceita UPDATE nem DELETE. | 027 e `permissoes_caixa.sql` | Coberto |
| A14 | **Sangria e suprimento enviam `category`, coluna que não existe em `cash_movements`.** Com a gravação direta, o insert falharia. | Pelo código (`cashRegister.ts`, versão do RC) e pela lista de colunas do schema | Alta (removido na RPC nova) |

## 3. Regras de negócio propostas (decisão desta sprint)

- Um operador tem no máximo um caixa aberto por empresa.
- Abertura: owner, admin, manager ou cashier. Vendedor não abre.
- Sangria e suprimento: só em caixa aberto, por quem é dono do caixa ou por owner, admin ou manager. O valor deve ser positivo, a descrição é obrigatória, e a sangria não pode levar o saldo esperado abaixo de zero.
- Fechamento: só caixa aberto, pelo dono ou gerência. Se houver divergência entre o valor contado e o saldo esperado, a observação é obrigatória.
- Venda e estorno só alteram caixa aberto. Estorno de venda de caixa já fechado é recusado (o fechamento é registro final).
- Toda operação financeira tem chave de idempotência. Repetir a mesma chave com os mesmos dados devolve o resultado original, sem gravar de novo. Repetir a chave com outros dados é recusado.
- Toda operação grava uma linha em `cash_operation_log`, que não aceita UPDATE nem DELETE.

## 4. Ordem de travas (atualizada)

Venda: empresa (`FOR NO KEY UPDATE`) → caixa (`FOR NO KEY UPDATE`, com revalidação do status) → produtos por `product_id`.
Estorno: venda → caixa (`FOR NO KEY UPDATE`) → produtos por `product_id`.
Sangria, suprimento, fechamento e abertura: caixa (`FOR NO KEY UPDATE`), mais a trava consultiva da chave de idempotência.

Como não há ciclo: o fechamento só trava o caixa; a venda e o estorno travam o caixa antes dos produtos, então nenhuma operação espera por produto segurando o caixa.

## 5. Fora do escopo desta sprint

- Conciliação com meios de pagamento (cartão, PIX).
- Caixa compartilhado entre operadores.
- Reabertura de caixa fechado.
