# Auditoria do banco remoto Venddi e preparo da homologação (somente leitura)

Data: 2026-11-04. Projeto remoto: **Venddi**, ref `jcvblxyzceszzehehyjd`, organização **Damatta**, região us-east-1, Postgres 17, status ACTIVE_HEALTHY, marcado como **PRODUÇÃO** pelo proprietário.

Escopo desta auditoria: somente leitura. Nada foi alterado no remoto. Nenhuma migration foi aplicada, nenhum merge e nenhum deploy. Nenhum projeto Jinlong foi usado.

## 1. Diagnóstico de acesso

| Canal | Conta / organização | Enxerga o Venddi? |
|---|---|---|
| CLI Supabase (`supabase projects list`) | Conta com acesso à organização **Damatta** | **Sim** |
| Conector MCP Supabase (`list_organizations`) | Conta com acesso só à organização **NatureCode** (`cmgixawhsltzcudyeukz`) | **Não**. `get_project` retorna "You do not have permission" |

Causa: o conector MCP está autenticado em outra conta, sem acesso à organização Damatta. Por isso o projeto não aparece no MCP. A conta do CLI tem acesso.

Ações realizadas:
- `supabase link --project-ref jcvblxyzceszzehehyjd`. Cria só `supabase/.temp/project-ref`, que está no `.gitignore`. Nenhum segredo foi gravado no repositório.
- `supabase migration list --linked` e `supabase db dump --linked` funcionaram sem senha informada por nós. O CLI criou um papel de login temporário.

Para o MCP enxergar a Damatta, é preciso refazer a autenticação do conector com a conta da Damatta (via `/mcp`). Isso exige ação humana. Não tentamos OAuth nem usamos credenciais.

## 2. Inventário das migrations remotas

| Histórico | Situação |
|---|---|
| Versões 001 a 021 | Registradas como aplicadas no remoto |
| Versões 022 a 030 | **Não aplicadas** |

Mas o histórico não confere com o schema real. Ver seção 3.

## 3. Divergências entre o banco remoto e o repositório

Comparação feita com o dump do schema remoto (`pg_dump` via CLI, somente leitura) e o dump do banco local com as migrations 001 a 030.

### 3.1 Migrations registradas como aplicadas, mas sem efeito no schema

| Migration | Esperado | Estado no remoto |
|---|---|---|
| 019 (inventário) | Tabelas `inventory_counts`, `inventory_count_items` e RPCs | **Tabelas ausentes** |
| 020 (guarda de estoque negativo) | Trigger `products_stock_nao_negativo` | **Ausente** |
| 021 (numeração de vendas com `FOR NO KEY UPDATE`) | `create_atomic_sale` com a trava | **Versão antiga** (sem `FOR NO KEY UPDATE`, sem `Estoque insuficiente`) |

Conclusão: o remoto não tem as correções de oversell e de deadlock que o repositório declara como aplicadas. Não dá para confiar no histórico de migrations do remoto.

### 3.2 Objetos no remoto que não existem no repositório

- Funções: `caixa_saldo_esperado`, `calc_fechamento_caixa`, `get_user_id`, `guard_sale_cancellation`, `guard_sale_tenant`, `guard_user_identity_change`, `relatorio_caixas_periodo`, `relatorio_fechamento_caixa`, `snapshot_sale_commission`.
- Triggers: `trg_guard_sale_cancellation`, `trg_guard_sale_tenant`, `trg_guard_user_identity_change`, `trg_sale_commission_snapshot`.
- Políticas: `users | Users can view own profile`.

Esses objetos foram criados fora das migrations do repositório (drift). Remover qualquer um deles em produção pode quebrar a aplicação. Devem ser incorporados ao repositório ou deliberadamente descontinuados, com decisão do proprietário.

### 3.3 Objetos do repositório ausentes no remoto

- Tabelas: `cash_operation_log` (029), `inventory_counts` e `inventory_count_items` (019).
- Funções: `abrir_caixa`, `fechar_caixa`, `registrar_movimento_caixa`, `proteger_estado_caixa`, `proteger_valor_inicial_caixa`, `cash_operation_log_imutavel`, `garantir_saldo_nao_negativo`, `metricas_dashboard`, `iniciar_inventario`, `registrar_contagem_item`, `concluir_inventario`, `cancelar_inventario`.
- Triggers: `cash_operation_log_nao_altera`, `cash_registers_protege_estado`, `cash_registers_protege_valor_inicial`, `products_stock_nao_negativo`.
- Políticas da 027 em caixa ausentes: o remoto ainda tem as políticas genéricas de INSERT, UPDATE e DELETE.

### 3.4 Políticas de escrita direta presentes no remoto (risco ativo)

O remoto permite que **qualquer usuário da empresa** grave diretamente, pela API:

| Tabela | Políticas de escrita direta |
|---|---|
| `sales` | INSERT, UPDATE, DELETE |
| `payments` | INSERT, UPDATE, DELETE |
| `sale_items` | INSERT, UPDATE, DELETE |
| `cash_movements` | INSERT, UPDATE, DELETE |
| `cash_registers` | INSERT, UPDATE, DELETE |

A migration 030 do repositório remove essas políticas. No remoto, a brecha continua aberta.

### 3.5 Grants

- `anon` tem `GRANT ALL` em `create_atomic_sale` e em funções de caixa (`caixa_saldo_esperado`, `calc_fechamento_caixa`, `calculate_cash_balance`). Nas funções de sessão a checagem de empresa do auth recusa o `anon`, mas o grant amplo deve ser revogado.

### 3.6 RLS

Habilitado nas mesmas tabelas de venda e caixa nos dois lados. Sem divergência de habilitação.

## 4. Riscos de aplicar as migrations 026 a 030 como estão

1. **Não basta aplicar 022 a 030.** O remoto já tem 019 a 021 registradas e as correções ausentes. O `migration up` pula as versões registradas. As migrations 019, 020 e 021 precisariam ser reaplicadas manualmente, com verificação, antes de 022 a 030. Caso contrário, o inventário, a guarda de estoque e a trava de venda continuam ausentes.
2. **Drift:** funções e triggers remotos fora do repositório. Uma reaplicação completa das funções de venda (021 a 028 reescrevem `create_atomic_sale` e `cancel_sale_with_reversal`) pode conflitar com `trg_guard_sale_tenant`, `trg_guard_sale_cancellation` e `trg_sale_commission_snapshot`. É preciso testar isso no ambiente isolado antes.
3. **Dados existentes:** a 029 valida `cash_registers` com mais de um caixa aberto por operador e interrompe se houver. Precisa de checagem prévia no remoto (somente leitura).
4. **Políticas:** a 030 remove as políticas genéricas. Qualquer código de produção que grave direto nessas tabelas quebra. O código do app em `src/` não grava diretamente; a checagem precisa cobrir os clientes em produção também (versões antigas do app, integrações).
5. **Rollback:** os rollbacks 029 e 030 existem no repositório, mas o rollback da 030 reabre a brecha. Qualquer rollback remoto exige backup.
6. **Dados de produção com PII:** qualquer cópia para homologação contém dados de clientes. Precisa de anonimização antes de sair do ambiente de produção.

## 5. Plano de homologação isolada

Pré-requisitos (bloqueios, seção 7): acesso MCP à Damatta e decisão do proprietário.

1. **Backup de produção (somente leitura):** `supabase db dump --linked` com schema e dados, salvo fora do repositório, criptografado, com acesso restrito. Verificar o tamanho e o conteúdo antes de usar.
2. **Ambiente isolado:** um projeto Supabase novo e separado, sem ligação com produção (por exemplo, `venddi-homolog`, na organização Damatta). Criar um projeto é ação que gera custo e exige aprovação. Alternativa: stack local já existente, usada para os testes.
3. **Restaurar o backup no projeto isolado**, com dados anonimizados (nomes, CPFs e telefones de clientes e usuários).
4. **Reconciliação do schema:** comparar o schema restaurado com o repositório (o mesmo método desta auditoria). Reaplicar 019, 020 e 021 manualmente, com verificação. Só depois aplicar 022 a 030.
5. **Testes no isolado:**
   - `supabase/tests/*.sql` inteiro, com as suítes de isolamento multiempresa (`rls_isolation_test.sql`, `isolamento_permissoes_vendas.sql`, `integridade_pdv_caixa.sql`).
   - `concorrencia_caixa.sh` (uma execução por vez).
   - E2E de caixa e vendas pela interface, com conferência no banco.
6. **Critério de aprovação para o primeiro cliente:** todos os testes verdes no isolado, divergências de drift resolvidas e aprovadas pelo proprietário.

Aplicação em produção só depois de homologação aprovada, com janela de manutenção e backup confirmado.

## 6. Resultados dos testes locais e CI

- Suítes SQL com migrations 001 a 030 no Postgres local: todas passaram na última reconstrução do banco de testes (19 arquivos).
- `concorrencia_caixa.sh`: execução limpa, 15 rodadas por cenário, 0 violações e 0 falhas inesperadas.
- `tsc --noEmit` e `vitest run` (82 testes): passam.
- CI do PR #20: Vercel Preview Comments, Vercel landing e Vercel venddi com status `pass`.

Observação: a primeira execução de concorrência falhou por sobreposição de duas execuções no mesmo banco. Repetida sozinha, passou.

## 7. Bloqueios que exigem intervenção humana

1. **Reconectar o conector MCP do Supabase à organização Damatta** (`/mcp`). Sem isso, o MCP não enxerga o Venddi.
2. **Decidir sobre o drift** (seção 3.2): incorporar ao repositório ou remover, com aprovação do proprietário.
3. **Aprovar a criação de um projeto de homologação isolado** (custo e recurso remoto).
4. **Autorizar o backup de produção com dados pessoais**, com destino e prazo de guarda.
5. **Decidir sobre a brecha de produção (seção 3.4):** aplicar um hotfix só com a remoção das políticas de escrita direta, antes da homologação completa, ou esperar. Isso altera produção e precisa de autorização explícita.
6. **Revogar `GRANT` de `anon`** em funções de venda e caixa (seção 3.5).

## 8. Recomendação

**Não iniciar a homologação das migrations 026 a 030 diretamente no remoto.** A evidência mostra que o histórico de migrations do remoto não reflete o schema real. Primeiro: restaurar em ambiente isolado, reconciliar, testar e só então decidir sobre produção.

Risco de produção que não depende da homologação: as políticas de escrita direta (seção 3.4) estão ativas agora. Vale decidir sobre um hotfix mínimo o quanto antes.
