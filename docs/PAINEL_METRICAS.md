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

`getProducts({ lowStock: true })` compara duas colunas (`stock_quantity <= min_stock`), o que o PostgREST não expressa. Os ids são calculados no cliente a partir dos produtos ativos (leitura paginada) e a listagem filtra por eles. A mesma regra está em `src/lib/stock/lowStock.ts`.

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
- Índice `idx_sales_company_sale_date (company_id, sale_date DESC)` (migration 024) atende o período e as 5 mais recentes sem ordenação em memória.
- Atenção de produção: a migration 024 usa `CREATE INDEX` (sem `CONCURRENTLY`), que bloqueia escritas em `sales` durante a construção. Aplicar em horário de pouco movimento.

## Segurança (revisão)

- `metricas_dashboard` é `SECURITY INVOKER`: o RLS das tabelas vale, e a função também filtra por `get_user_company_id()`.
- Permissão de execução só para `authenticated` (revogado de `PUBLIC` e `anon`).
- Sem SQL dinâmico; parâmetros são timestamps.
- O retorno inclui só agregados e campos de venda (id, número, total, status, data). Não inclui `customer_id` nem dados pessoais.
- Empresa sem assinatura ativa ou trial vencido: zeros (controle da migration 016).

## Estoque baixo na tela de Produtos (E2E)

A tela tem o botão "Estoque baixo", que liga o filtro `getProducts({ lowStock })`. Testado no navegador: com o filtro, só o Boné Teste (no mínimo). Desligado, a lista completa volta.

## Limites conhecidos

- O filtro de estoque baixo na listagem ainda lê todos os produtos ativos da empresa para decidir os ids. Para catálogos muito grandes, o próximo passo é uma função no banco, como a do painel.
- Codex: a revisão do commit `be5e243` não chegou durante esta rodada; o status estava em "running" no commit `d77da6d`.

## Próximos passos

1. Revisão do Codex sobre os commits desta rodada (`530f6c8` a `3a645fa` e 024).
2. Aplicar a migration 024 em homologação remota antes de produção (bloqueio curto de escrita em `sales`).
3. Mover o filtro de estoque baixo da listagem para o banco, se o catálogo crescer.
