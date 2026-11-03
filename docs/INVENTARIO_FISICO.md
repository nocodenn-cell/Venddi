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

## 6. Revisão complementar (pré-merge)

### 6.1 Revisão do Codex (commit `67ccb43`) — 5 achados, todos corrigidos

| # | Achado | Correção (commit `1047a8f` e seguintes) |
|---|---|---|
| 1 | Itens além da primeira página da API ficavam invisíveis e a conclusão nunca liberava. | `getInventoryCountItems` pagina em blocos de 1000 com ordem estável. Teste unitário com 2005 itens (`inventoryApi.test.ts`). |
| 2 | Edição feita durante um salvamento em voo era apagada ao fim do salvamento anterior. | O rascunho só é limpo se o valor não mudou. Campo desabilitado enquanto o próprio item é salvo. |
| 3 | Concluir podia usar o valor antigo quando a correção falhava ao salvar. | Concluir fica bloqueado com rascunho pendente ou salvamento em andamento, na UI e em `handleComplete`. |
| 4 | Resposta atrasada de um inventário aparecia no outro (troca rápida de inventário). | Referência ao inventário ativo; respostas de outro inventário são descartadas. |
| 5 | O script de concorrência não verificava resultado e ignorava falhas das sessões. | Asserções de saldo (5 e 4), de movimentos (1), de uma aplicação e uma idempotente, e código de saída das sessões. Sai com erro se qualquer invariante falhar. |

Evidência: `bash supabase/tests/run_local_db_tests.sh` termina com `INVENTORY CONCURRENCY OK`.

### 6.2 Exclusão de produto durante inventário

- **Antes:** a FK `inventory_count_items.product_id` era `ON DELETE CASCADE`. Uma exclusão física de produto (permitida a managers pela RLS de DELETE) apagaria o item do inventário em silêncio, sem aviso.
- **Depois:** `ON DELETE RESTRICT`. A exclusão é recusada, e o teste 17 do banco verifica que o item permanece.
- A exclusão no app é lógica (`is_active = false`). Produto inativo que já está num inventário continua contável e entra no ajuste, de forma intencional, para não perder a contagem física.

### 6.3 Deadlock entre venda, entrada e conclusão (medido)

- **Entrada** (`registrar_entrada_estoque`) trava um único produto: não há ciclo.
- **Registrar contagem** trava o inventário `FOR SHARE` e depois um produto. **Concluir** trava o inventário `FOR UPDATE`. Como registrar espera o inventário antes de travar produto, não há ciclo entre eles.
- **Venda × conclusão**: a venda trava os produtos na ordem do carrinho, a conclusão na ordem de `product_id`. Experimento com P2→P1 (venda) contra P1→P2 (conclusão): **`deadlock detected` na conclusão**. A venda foi confirmada, saldos consistentes (P1=3, P2=9), nenhum ajuste parcial, inventário ainda em `counting`. O dano é um erro para o operador, que deve repetir a conclusão.
- Correção de raiz: ordenar os itens da venda por `product_id` (descrito em `docs/PROPOSTA_BAIXA_CONCORRENTE.md`, PR #18).

### 6.4 Race condition na baixa de venda (medido, PR separado)

- Duas vendas de 5 unidades sobre saldo 9, sem guarda: **saldo final −1**.
- Correção mínima no PR #18 (`020_stock_non_negative_guard.sql`, `CHECK (stock_quantity >= 0)`): uma venda confirmada, uma recusada, saldo final 4. Regressão: 10 suites SQL existentes passam com a constraint.
- Limite: a RPC ainda devolve mensagem genérica de CHECK. A correção completa (`FOR UPDATE` e mensagem "Estoque insuficiente") está na proposta.
- Este PR (#17) **não** altera `create_atomic_sale`.

### 6.5 Interface com contagens não salvas

Comportamentos após a correção:
- Campo com rascunho é salvo ao sair do campo ou com Enter. Erro de validação ou de rede mantém o rascunho e mostra a mensagem na linha.
- **Voltar** salva os rascunhos antes de sair. Se algum falhar, permanece na tela.
- Aviso do navegador ao fechar a aba com rascunho pendente.
- **Concluir** fica desabilitado com rascunho pendente ou salvamento em andamento.

## 7. Roteiro E2E de homologação real

Pré-requisitos: projeto Supabase de **homologação** com migrations 001–019 (e 020 se a PR #18 estiver aplicada). Usuários: owner, manager, caixa. Pelo menos 5 produtos ativos com saldo, um deles com saldo ≥ 10 para o teste de venda concorrente.

Passos, com o resultado esperado em cada um:

1. **Permissão do caixa.** Logar como caixa. "Estoque" não aparece no menu. Acessar `/app/estoque` pela URL é bloqueado.
2. **Início.** Logar como manager → Estoque → Iniciar inventário. Esperado: lista com todos os produtos ativos; inativos ausentes.
3. **Contagem com divergências.** Zero em um produto (falta total), valor maior em outro (sobra), valor igual ao saldo em um terceiro. Esperado: rótulos "Falta N", "Sobra N", "Sem divergência" e resumo atualizado.
4. **Rascunho não salvo.** Digitar um valor e clicar em Voltar. Esperado: o valor é salvo antes de sair. Repetir com um valor inválido (`-1`): esperado, permanecer na tela com a mensagem.
5. **Persistência.** Sair e reabrir o inventário. Esperado: as contagens continuam lá.
6. **Venda durante a contagem.** Em outra aba, vender uma unidade de um produto já contado. Concluir. Esperado: saldo final = saldo após a venda + (contado − saldo na contagem). Conferir.
7. **Conclusão bloqueada.** Com um produto sem contagem, "Concluir" desabilitado. Com rascunho editado não salvo, desabilitado.
8. **Confirmação.** Concluir abre o resumo de divergências. Sem o checkbox, "Aplicar ajustes" fica desabilitado.
9. **Histórico.** Esperado: um movimento `adjustment` por produto divergente, com nota "Inventário: …", autor e saldo.
10. **Conclusão repetida.** Abrir o mesmo inventário concluído: sem novos movimentos.
11. **Cancelamento.** Segundo inventário, cancelar. Esperado: estoque inalterado.
12. **Isolamento.** Com owner de outra empresa, o inventário não aparece.
13. **Exclusão de produto em inventário ativo.** Tentar excluir fisicamente um produto contado. Esperado: recusado (FK). Desativar pelo app é permitido e o item continua no inventário.
14. **Concorrência real (opcional, com acesso ao banco de homologação).** Repetir o cenário do `inventory_concurrency_check.sh` com uma sessão de venda real. Esperado: saldo final correto e sem erro para a venda.

## 8. Riscos restantes e recomendação

| Risco | Severidade | Situação |
|---|---|---|
| Oversell na venda (`create_atomic_sale`) | P0 | Medido. Guarda mínima no PR #18. Correção completa pendente. |
| Deadlock venda × conclusão | P1 | Medido. Erro para o operador, sem dano. Corrige com a ordenação do PR #18/próximo. |
| E2E de navegador | P1 | Não executado aqui. Roteiro acima. |
| Sem paginação no servidor para catálogos muito grandes | P2 | Itens carregados em blocos de 1000; a tela continua mostrando tudo de uma vez. |
| Aplicação da migration 020 falha se houver saldo negativo | P1 | Esperado e intencional: exige correção manual antes. |

**Recomendação: GO para merge do PR #17 após o roteiro E2E de homologação passar**, sem depender do PR #18 para o inventário (o inventário não depende da guarda de venda para estar correto; a guarda reduz o risco de oversell, que existe independentemente dele). **NO-GO para produção** enquanto o PR #18 (ou equivalente) não estiver aplicado, porque o oversell na venda é um defeito P0 já existente que afeta a confiança no estoque.

## 9. Próximos passos recomendados

- **P0:** revisar e aplicar a guarda de saldo (PR #18) em homologação; depois, a correção completa da RPC de venda (validação com `FOR UPDATE`, ordenação por `product_id`).
- **P1:** executar o roteiro E2E da seção 7 em homologação e anexar as evidências ao PR.
- **P1:** E2E automatizado com Playwright e usuários de teste em homologação.
- **P2:** paginação no servidor para catálogos grandes; histórico com autor na tela.
