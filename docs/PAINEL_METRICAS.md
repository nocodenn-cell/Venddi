# Painel (dashboard) — definição das métricas

Fonte única: função `metricas_dashboard` (migration 023). O navegador só exibe o resultado.

## Definições

| Métrica | Regra |
|---|---|
| Vendas hoje | Soma do total das vendas com `status = 'completed'` entre o início do dia local e o início do dia seguinte. |
| Pedidos hoje | Contagem das mesmas vendas. |
| Variação vs ontem | Mesma regra, do dia anterior. Sem base (ontem = 0), não mostra porcentagem. |
| Estoque baixo | Produtos ativos com `stock_quantity <= min_stock`. Produtos inativos não contam. |
| Saldo em caixa | Soma, por caixa **aberto**, de: valor inicial + venda + depósito − sangria − estorno. |
| Vendas recentes | As 5 vendas mais recentes da empresa, sem corte de data (inclui cancelada e estornada, com o status). |

## Decisões

- **Saldo calculado, não lido.** `cash_movements.balance_after` não é confiável: depósitos e sangrias gravam `0` (`src/lib/api/cashRegister.ts`). O saldo é recalculado a partir do valor inicial e dos movimentos com sinal.
- **Escopo por empresa.** A função roda com `SECURITY INVOKER`: o RLS das tabelas vale, e ela também filtra por `get_user_company_id()`. Só `authenticated` tem permissão de execução.
- **Empresa sem assinatura ativa ou em trial vencido não resolve empresa** (migration 016). Nesse caso o painel mostra zeros, pelo mesmo controle que bloqueia o restante do sistema.
- **Cards sem fonte de dados foram removidos** (contas a vencer, meta mensal). Não exibir número inventado é preferível a um número falso.

## Estoque baixo na listagem de produtos

`getProducts({ lowStock: true })` consulta a view `produtos_estoque_baixo` (migration 025): produtos ativos com `stock_quantity <= min_stock`. A view é `security_invoker`, então o RLS de `products` vale, e a paginação é a normal da listagem. A regra é a mesma do indicador do painel (migration 023).

## Testes

- `supabase/tests/dashboard_metrics_check.sql`: valores, saldo com depósito, sangria, venda e estorno; caixa fechado fora; estoque baixo sem inativo; histórico antigo nas recentes; isolamento entre empresas; zero sem usuário autenticado.
- `src/lib/__tests__/dashboardMetrics.test.ts`, `lowStock.test.ts`: variação, início do dia e regra de estoque baixo.

## Cancelamento e estorno (consistência)

Medido com as RPCs reais (`create_atomic_sale` e `cancel_sale_with_reversal`) no stack local:

| Etapa | Vendas hoje | Saldo do caixa |
|---|---|---|
| Antes | R$ 400,00 · 5 | R$ 500,00 |
| Após venda de R$ 20,00 | R$ 420,00 · 6 | R$ 520,00 |
| Após cancelamento (estorno) | R$ 400,00 · 5 | R$ 500,00 |

A venda cancelada continua nas vendas recentes, com status `cancelled`, e fica fora dos totais.

## Isolamento multiempresa

Todos os indicadores são filtrados pela empresa do usuário, no banco:
- Vendas de hoje e de ontem, pedidos: só vendas `completed` da empresa (teste de banco).
- Estoque baixo: produtos ativos da empresa (teste de banco; a listagem usa RLS).
- Saldo do caixa: só caixas abertos da empresa (teste de banco).
- Vendas recentes: só da empresa (teste de banco).
- Sem usuário autenticado: zeros.

## Desempenho

- Totais e contagens são calculados no banco, em uma chamada, sem trazer linhas ao navegador.
- Índice `idx_sales_company_sale_date (company_id, sale_date DESC)` (migration 024).
- Medido no stack local (Postgres 17), com transação descartável:

| Cenário | Recentes (5) sem 024 | Recentes (5) com 024 | Período 2 dias sem 024 | Período 2 dias com 024 |
|---|---|---|---|---|
| Loja com 1 milhão de vendas em 2 anos (dados densos) | 0,06 ms | 0,09 ms | 1,6 ms | 5,0 ms |
| Loja antiga (1 milhão de vendas há 1 ano) ao lado de outra com 1 milhão de vendas recentes | **130 ms** | **0,13 ms** | **24 ms** | **0,09 ms** |

Leitura: quando as vendas da empresa são densas no tempo, o planejador já usa o índice por data e a diferença é pequena. O ganho real aparece no pior caso multiempresa: uma loja com histórico antigo, numa tabela onde outra empresa tem muitas vendas recentes. Sem o 024, o banco varre as vendas recentes de todas as empresas até achar 5 da loja. Por isso o índice se justifica.

- Custo: escrita extra em `sales` e bloqueio na criação. A migration 024 usa `CREATE INDEX` (sem `CONCURRENTLY`, que não roda dentro da transação da migration), que bloqueia escritas em `sales` enquanto constrói. Em produção, aplicar em horário de pouco movimento, ou criar o índice manualmente com `CREATE INDEX CONCURRENTLY` antes do deploy, e então marcar a migration como aplicada.

## Segurança (revisão)

- `metricas_dashboard` é `SECURITY INVOKER`: o RLS das tabelas vale, e a função também filtra por `get_user_company_id()`.
- Permissão de execução só para `authenticated` (revogado de `PUBLIC` e `anon`).
- Sem SQL dinâmico; parâmetros são timestamps.
- O retorno inclui só agregados e campos de venda (id, número, total, status, data). Não inclui `customer_id` nem dados pessoais.
- Empresa sem assinatura ativa ou trial vencido: zeros (controle da migration 016).

## Estoque baixo na tela de Produtos (E2E)

A tela tem o botão "Estoque baixo", que liga o filtro `getProducts({ lowStock })`. Testado no navegador, com a view da migration 025 aplicada pelo CLI oficial (`supabase migration up --local`): com o filtro, só o Boné Teste (no mínimo). Desligado, a lista completa volta (4 produtos).

## Limites conhecidos

- Codex: a revisão do commit `be5e243` e dos commits seguintes não chegou durante esta rodada; o último status observado estava no commit `d77da6d`.
- O botão "Filtros" da tela de Produtos continua sem função (já existia; fora do escopo).

## Compatibilidade com os PRs #17 e #18

Integração testada por merges reais das três branches (sem conflito):

- Sequência de migrations: 001–018 (base), 019 (PR #17, inventário), 020–022 (PR #18, guarda de saldo e correções de venda), 023–025 (PR #19, painel e view). Números não colidem.
- Dependências: 023 usa `sales`, `cash_registers`, `cash_movements`, `products` e `get_user_company_id()` (013/016). 024 usa `sales`. 025 usa `products`. Nenhuma depende de 019–022.
- Interação: a trigger de saldo (020) recusa saldo negativo; o inventário (019) valida saldo antes de ajustar. A view (025) e a função (023) só leem.

## Índice 024 com CREATE INDEX CONCURRENTLY

`CONCURRENTLY` não roda dentro de transação, então não pode estar na migration. Procedimento testado localmente:

1. Criar fora da migration: `CREATE INDEX CONCURRENTLY idx_sales_company_sale_date ON sales (company_id, sale_date DESC);`
2. Confirmar que está válido: `indisvalid = true`.
3. Aplicar a migration 024: vira no-op (`IF NOT EXISTS`), sem duplicar o índice.

Se o `CONCURRENTLY` falhar, o índice fica inválido com o mesmo nome. A migration 024 recusa esse caso (guarda com `pg_index.indisvalid`). Testado: índice inválido provocado por construção que falha → 024 recusa; recuperação com `DROP INDEX CONCURRENTLY` + `CREATE INDEX CONCURRENTLY` → 024 no-op, índice único e válido.

## Reprodução do zero

- `supabase/tests/run_all_db_tests.sh` (deste PR): Postgres 16 descartável, schema `auth` mínimo, migrations em ordem, todas as suítes SQL da pasta. Resultado com este PR: `ALL DB TESTS OK` (migrations 001–018 e 023–025).
- Integração dos três PRs (`run_local_db_tests.sh` do PR #17): migrations 001–025, 13 suítes SQL, `INVENTORY CONCURRENCY OK`; concorrência da guarda de venda (PR #18) `SALE STOCK GUARD OK`. Unitários: 69 de 69 no conjunto integrado; typecheck e build passam.

## Próximos passos

1. Aguardar a revisão do Codex sobre os commits desta rodada e tratar os achados.
2. Em homologação remota, antes de produção: criar o índice com `CONCURRENTLY` fora da migration, validar, e aplicar a 024 (no-op).
3. Aplicar 023, 024 e 025 em homologação remota pelo fluxo oficial de migrations, antes de qualquer produção.
