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

## Limites conhecidos

- O cálculo de estoque baixo na listagem de produtos ainda lê todos os produtos ativos para decidir quais ids filtrar. Para catálogos muito grandes, o próximo passo é uma função no banco, como a do painel.
