# Inventário físico — diagnóstico, decisões, evidências e homologação

Issue: [nocodenn-cell/Venddi#16](https://github.com/nocodenn-cell/Venddi/issues/16)
Migration: `supabase/migrations/019_physical_inventory.sql`

Este documento registra a auditoria do módulo de estoque, o plano técnico, o que foi
implementado, como foi verificado e o que ainda precisa de homologação. Nada foi aplicado
em produção: não há merge, deploy nem alteração no Supabase de produção.

---

## 1. Diagnóstico do módulo atual

| Item | Situação |
|---|---|
| Saldo | `products.stock_quantity` (contador mutável, sem trilha própria). |
| Movimentos | `stock_movements` (`type` in `in`/`out`/`adjustment`, com `balance_after`). Já existe o tipo `adjustment`, mas nenhuma RPC o usava. |
| Venda | RPC `finalizar_venda` (migrations 006/008): valida estoque com `SELECT`, depois faz `UPDATE stock_quantity - qty` e grava movimento `out`. |
| Entrada | RPC `registrar_entrada_estoque` (017): `UPDATE ... + qty` atômico, grava movimento `in`, só owner/admin/manager. |
| Cancelamento de venda | Reverte estoque e grava movimento (007/008). |
| RLS | Leitura por empresa (005); escrita de produtos restrita a owner/admin/manager (014). |
| Permissões de tela | `stock.read` (caixa também), `stock.adjust` (owner/admin/manager). Inventário usa `stock.adjust`. |
| Tela Estoque | Era `PlaceholderPage`. Entrada de estoque fica em Produtos. |
| Inventário físico | Não existia. |

### Riscos encontrados

1. **Race condition na venda (pré-existente, P0).** A RPC de venda valida o saldo com
   `SELECT` sem lock e depois faz `UPDATE` sem condição de saldo (`WHERE stock_quantity >= qty`).
   Duas vendas simultâneas do mesmo produto podem passar na validação e levar o saldo
   abaixo de zero. Identificado por leitura do código; **não reproduzido** neste PR.
   Fora do escopo desta issue por mexer em RPC de venda, mas é bloqueante para confiança no estoque.
2. **Contagem ingênua sobrescreve vendas.** Se o ajuste fosse `estoque = contado`, qualquer
   venda ou entrada feita durante a contagem seria perdida. Tratado no modelo abaixo.
3. **Ajuste silencioso.** Nada no módulo atual registra motivo nem autor de correção de saldo.
4. **Risco de deadlock.** A conclusão trava vários produtos em ordem (`ORDER BY product_id`),
   mas uma venda trava os produtos na ordem do carrinho. Um deadlock aborta uma das
   transações (o Postgres detecta e reverte), sem corromper dados.

---

## 2. Plano técnico e decisões

### Modelo de dados (migration 019)

- `inventory_counts`: cabeçalho (`status`: `counting` | `completed` | `cancelled`, autor e datas).
  Índice único parcial garante **um inventário em andamento por empresa** no banco.
- `inventory_count_items`: um item por produto ativo no início. Guarda
  `expected_quantity` (saldo no início, informativo), `system_quantity` (saldo do sistema no
  momento da contagem), `counted_quantity`, `counted_by/at` e `applied_difference` (ajuste
  aplicado na conclusão).

### Decisões de concorrência e integridade

| Decisão | Motivo |
|---|---|
| **Contagem não bloqueia vendas nem entradas.** | Pedido da issue: a loja não pode parar. |
| **Ajuste = contado − saldo do sistema no momento da contagem, aplicado sobre o saldo atual** (`stock = stock + (contado − sistema_na_contagem)`). | Preserva vendas e entradas feitas depois da contagem. Substituir por `stock = contado` apagaria essas movimentações. |
| **Captura do saldo ao registrar a contagem, com `FOR UPDATE` no produto.** | O saldo gravado é consistente com vendas concorrentes. |
| **Conclusão com `FOR UPDATE` no inventário.** | Conclusões simultâneas são serializadas. |
| **Conclusão idempotente.** | Concluir de novo devolve `already_completed = true` e não grava movimento. |
| **Pendências bloqueiam a conclusão.** | Um produto sem contagem não pode ser ajustado silenciosamente. |
| **Saldo negativo bloqueia a conclusão.** | Se a diferença deixaria o saldo abaixo de zero (venda depois da contagem), a transação falha e o produto deve ser recontado. |
| **Cancelamento não altera estoque e é idempotente.** | Caminho seguro para desistir. |
| **Escrita só por RPC.** | Tabelas têm RLS de leitura e `REVOKE INSERT/UPDATE/DELETE`. Escrita direta é recusada. |
| **Papel verificado no banco.** | `iniciar`, `registrar`, `concluir`, `cancelar` exigem owner/admin/manager. A UI só esconde botões (UX). |
| **Isolamento multiempresa por `get_user_company_id()`.** | Nenhuma RPC aceita `company_id` como parâmetro. |
| **Motivo e auditoria.** | Cada ajuste gera um movimento `adjustment` com `reference_type = inventory_count`, `reference_id`, texto "Inventário: <nome> (contado X, sistema Y)", autor e `balance_after`. |

### Experiência

- Tela **Estoque** (`/app/estoque`): lista de inventários com status e datas; botão
  "Iniciar inventário" com nome opcional.
- Detalhe: resumo (produtos, contados, pendentes, divergências com falta/sobra), busca por
  nome, SKU ou código de barras (sem acento), campo "Contado" salvo ao sair do campo ou com Enter.
  Cada linha mostra "Pendente", "Sem divergência", "Falta N" ou "Sobra N".
- "Concluir e ajustar estoque" fica desabilitado enquanto houver pendências. Abre um
  resumo das divergências e exige checkbox de confirmação explícita.
- Textos em pt-BR. Estados claros: em conferência, concluído, cancelado.

### Fora de escopo (mantido)

BI, previsão de demanda, compras automáticas, fiscal, ERP amplo. Sem mudança no fluxo de venda.

---

## 3. Implementação

| Arquivo | Papel |
|---|---|
| `supabase/migrations/019_physical_inventory.sql` | Tabelas, RLS, 4 RPCs (`iniciar_inventario`, `registrar_contagem_item`, `concluir_inventario`, `cancelar_inventario`). |
| `src/lib/inventory/countMath.ts` | Regras puras: diferença, classificação, validação da entrada, resumo, busca. |
| `src/lib/api/inventory.ts` | Chamadas às RPCs e leitura das tabelas. |
| `src/pages/InventoryPage.tsx` | Tela de inventário (lista, detalhe, conclusão com confirmação). |
| `src/lib/router.tsx` | `/app/estoque` passa a usar `InventoryPage`, protegida por `stock.adjust` (owner/admin/manager). |
| `src/components/layout/Sidebar.tsx` | Item "Estoque" visível apenas com `stock.adjust`. |
| `src/lib/__tests__/inventory.test.ts` | 15 testes unitários das regras. |
| `supabase/tests/inventory_count_check.sql` | 17 blocos de teste de banco (permissões, isolamento, RLS, idempotência, escrita direta). |
| `supabase/tests/inventory_concurrency_check.sh` | Concorrência real com duas sessões psql. |
| `supabase/tests/run_local_db_tests.sh` | Sobe Postgres 16 local (Docker), aplica 001–019, roda tudo. |

---

## 4. Evidências

Ambiente: Postgres 16 local em Docker (descartável, sem Supabase de produção). Como o Supabase
não roda aqui, `auth.uid()` e o schema `auth` foram simulados com o mesmo mecanismo de claim JWT, e
as grants padrão do Supabase para `authenticated` foram replicadas.

| Verificação | Resultado |
|---|---|
| Migrations 001–019 em ordem, do zero | OK |
| `inventory_count_check.sql` (permissões, isolamento, falta, sobra, zero, sem divergência, venda/entrada durante a contagem, idempotência, cancelamento, RLS, escrita direta) | OK |
| Regressão: `commission_discount_check`, `register_tenant_check`, `rls_financial_read_check`, `rls_homolog_check`, `rls_integration_tests`, `rls_isolation_test`, `rls_role_write_check`, `rls_status_check`, `rls_stock_entry_check`, `rls_trial_expiry_check` | 10/10 OK |
| Concorrência 1: venda (−3) segura a linha; conclusão começa antes do COMMIT | Espera o lock; saldo final 5 (10 − 3 − 2). Venda preservada. |
| Concorrência 2: duas conclusões simultâneas do mesmo inventário | Uma aplica (`already_completed = false`), outra é idempotente (`true`). 1 movimento. Saldo 4 (5 − 1). |
| `npm run typecheck` | OK |
| `npx vitest run` | 62/62 testes OK (6 arquivos) |
| `npm run build` | OK |

Reproduzir: `bash supabase/tests/run_local_db_tests.sh` (requer Docker).

### Lacunas explícitas

- **E2E de navegador não foi executado.** O app depende de login Supabase com usuários
  reais; não há stack Supabase local aqui e não se adicionou Playwright, para não criar
  custo nem dependência nova. O roteiro abaixo cobre isso na homologação.
- A concorrência com a RPC de venda não foi reproduzida (ver risco 1).
- Não foi testado com volume grande (milhares de produtos). A tela lista todos os itens do inventário
  sem paginação.

---

## 5. Roteiro de homologação (E2E manual)

Pré-requisito: projeto Supabase de **homologação** com migrations 001–019 aplicadas, um
owner, um manager, um caixa e pelo menos 5 produtos ativos com saldo.

1. Logar como **caixa**: o item "Estoque" não deve aparecer no menu e `/app/estoque` deve ser bloqueado (`stock.adjust`).
2. Logar como **manager**: abrir Estoque → "Iniciar inventário" → criar. Confirmar que os produtos ativos aparecem.
3. Informar 0 em um produto (falta total) e um valor a mais em outro (sobra). Confirmar os rótulos "Falta"/"Sobra".
4. Fechar a tela e reabrir o inventário: os valores digitados devem continuar lá (rascunho persistido).
5. Em outra aba, registrar uma venda de um produto contado. Concluir o inventário: o saldo final deve refletir a venda **e** o ajuste.
6. Tentar concluir com um produto sem contagem: o botão deve ficar desabilitado.
7. Concluir: o modal lista as divergências e exige o checkbox. Depois de concluir, reabrir: nenhum novo ajuste.
8. Conferir em Produtos/histórico de movimentos: um movimento `adjustment` por produto divergente, com a nota "Inventário: …".
9. Iniciar um segundo inventário e cancelar: o estoque não muda.
10. Com uma segunda empresa, confirmar que o inventário não aparece lá.

---

## 6. Próximos passos recomendados

- **P0:** corrigir a race condition da venda (lock `FOR UPDATE` e condição `stock_quantity >= qty` no `UPDATE`).
- **P1:** paginação/busca no servidor para catálogos grandes; permissões de histórico com exibição de autor.
- **P1:** E2E automatizado com Playwright e usuários de teste em homologação.
