# Procedimento de migrations 019–026 em homologação (e rollback/recuperação)

Escopo: as migrations que integram os PRs #17 (inventário), #18 (venda e estoque) e #19 (painel).
Vale para o projeto de **homologação**. Produção só depois de homologação aprovada no roteiro
(`docs/HOMOLOGACAO_COMERCIAL.md`) e do GO registrado (`docs/GO_NO_GO_PRIMEIRO_CLIENTE.md`).

## 1. Ordem e conteúdo

| # | Arquivo | O que faz | Risco |
|---|---|---|---|
| 019 | `019_physical_inventory.sql` | Tabelas de inventário, RLS somente leitura, 4 RPCs | Baixo (tabelas novas) |
| 020 | `020_stock_non_negative_guard.sql` | Trigger que recusa saldo negativo | **Médio**: falha se já houver saldo negativo |
| 021 | `021_fix_sale_number_lock.sql` | `create_atomic_sale` corrigida (numeração, `user_id`, trava `FOR NO KEY UPDATE`) | **Alto**: troca função de venda |
| 022 | `022_fix_cancel_sale_cash_user.sql` | `cancel_sale_with_reversal` corrigida (`user_id`) | **Alto**: troca função de estorno |
| 023 | `023_metricas_dashboard.sql` | Função `metricas_dashboard` (painel) | Baixo |
| 024 | `024_indice_vendas_empresa_data.sql` | Índice `(company_id, sale_date)`; no-op se o índice já existir válido | Médio em volume (ver §4) |
| 025 | `025_produtos_estoque_baixo_view.sql` | View `produtos_estoque_baixo` | Baixo |
| 026 | `026_isolamento_e_permissoes_vendas.sql` | Isolamento e permissões em `create_atomic_sale`, `cancel_sale_with_reversal` e trial | **Alto**: troca funções de venda; corrige vazamento entre empresas |
| 027 | `027_permissoes_caixa.sql` | Vendedor não grava em caixa; razão de movimentos imutável; valor inicial só gerência | **Médio**: troca políticas de RLS de caixa; a tela de caixa grava direto (ver GO/NO-GO) |

Dependências: 021 e 022 antes de 026 (a 026 copia as definições delas). 023–025 não dependem de 019–022. 027 depende de `get_user_role()` (migration 014) e das políticas de caixa (migration 005).
O app precisa estar na versão dos três PRs **no mesmo deploy** das migrations 021, 022 e 026: as RPCs
passam a exigir que `p_operator_id` seja o usuário logado e que a empresa seja a da sessão.

## 2. Antes de aplicar (checagens somente leitura)

Rodar no SQL Editor do projeto de homologação. Cada consulta deve retornar o valor indicado.

```sql
-- 020: nenhum saldo negativo (senão a migration recusa)
select count(*) as negativos from products where stock_quantity < 0;        -- esperado: 0

-- 024: nenhum índice inválido com o mesmo nome (senão a migration recusa)
select count(*) as invalidos from pg_index i join pg_class c on c.oid = i.indexrelid
 where c.relname = 'idx_sales_company_sale_date' and not i.indisvalid;     -- esperado: 0

-- 019: nenhuma tabela de inventário ainda (primeira aplicação)
select to_regclass('public.inventory_counts');                             -- esperado: null
```

## 3. Backup

Antes de qualquer migration em homologação, guardar um dump do banco. Pelo painel do Supabase
(Database > Backups), ou com o CLI apontando para a URL de homologação (nunca para produção):

```bash
supabase db dump --db-url "$HOMOLOG_DB_URL" -f backup-pre-019-026.sql
```

`$HOMOLOG_DB_URL` deve ser uma variável de ambiente local, nunca commitada.

## 4. Aplicação

1. Conferir a branch de integração: `homologacao/rc-integrado` (contém os três PRs e os testes).
2. Aplicar 019 a 023 e 025 e 026 pelo fluxo oficial de migrations (`supabase db push` **apenas contra o
   projeto de homologação**, com o link configurado para ele).
3. Migration 024 com volume:
   - Criar o índice fora da migration, com `CONCURRENTLY`, em horário de pouco movimento:
     ```sql
     create index concurrently idx_sales_company_sale_date on sales (company_id, sale_date desc);
     ```
   - Confirmar que está válido (`indisvalid = true`).
   - Aplicar a migration 024: vira no-op (`IF NOT EXISTS`) e não duplica o índice.
   - Motivo: `CREATE INDEX` dentro de migration bloqueia escritas em `sales` durante a construção.
     Ensaiado localmente (`supabase/tests/ensaio_rollback.sh`, passo 3).
4. Deploy do app na mesma janela das migrations 021, 022 e 026.

## 5. Verificação após aplicar

```sql
select count(*) from pg_views where viewname = 'produtos_estoque_baixo';                  -- 1
select count(*) from pg_indexes where indexname = 'idx_sales_company_sale_date';           -- 1
select count(*) from pg_proc where proname = 'metricas_dashboard';                         -- 1
select count(*) from pg_trigger where tgname = 'products_stock_nao_negativo';              -- 1
select count(*) from information_schema.tables where table_name = 'inventory_counts';      -- 1
select prosecdef from pg_proc where proname = 'metricas_dashboard';                        -- false (INVOKER)
```

Depois, o roteiro E2E de `docs/HOMOLOGACAO_COMERCIAL.md` (seção 2 automatizada, seção 3 manual).

## 6. Rollback

| Migration | Rollback | Quando usar |
|---|---|---|
| 025 | `supabase/rollback/025_rollback.sql` | Seguro. A listagem de estoque baixo precisa da versão do app anterior à 025 |
| 024 | `supabase/rollback/024_rollback.sql` (rodar com `psql`, não dentro de migration) | Seguro. Só perde desempenho no pior caso |
| 023 | `supabase/rollback/023_rollback.sql` | Seguro se o app voltar à versão sem painel de dados reais |
| 020 | `supabase/rollback/020_rollback.sql` | **Último recurso**: reabre o oversell (reproduzido) |
| 019 | `supabase/rollback/019_rollback.sql` | **Apaga inventários e contagens.** Exportar antes |
| 021, 022, 026 | **Não fazer rollback.** Reabrem defeitos graves: venda com caixa quebrada (021/022) ou vazamento entre empresas (026) | Recuperar com correção para frente |
| 027 | **Não fazer rollback.** Reabre o vendedor gravando sangria e alterando o valor inicial do caixa | Recuperar com correção para frente |

Ensaio de rollback e reaplicação do zero: `bash supabase/tests/ensaio_rollback.sh` (Postgres descartável,
nenhum projeto remoto). Último resultado: `ENSAIO DE ROLLBACK OK`.

## 7. Recuperação

- **Falha de migration no meio:** a migration roda em transação; o banco volta ao estado anterior. Corrigir
  o motivo e reaplicar.
- **Índice inválido (024):** `drop index concurrently idx_sales_company_sale_date;` e recriar com `CONCURRENTLY`.
- **Regressão de venda após 021/022/026:** corrigir para frente (nova migration com a função corrigida),
  nunca reverter para a definição da 008 (que quebra toda venda com caixa e reabre o vazamento).
- **Restauração completa:** restaurar o dump do passo 3 em um projeto novo de homologação e repetir.
  Não restaurar sobre produção sem análise separada.
