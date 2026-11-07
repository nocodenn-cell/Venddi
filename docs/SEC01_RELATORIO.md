# VENDDI-SEC-01 — Relatório final: hotfix, drift e homologação

Data: 2026-11-04. Projeto remoto: **Venddi**, ref `jcvblxyzceszzehehyjd`, organização Damatta, **PRODUÇÃO**.
Base de análise: dump do schema remoto (CLI, somente leitura) e consultas somente leitura ao remoto.
Nenhuma alteração foi feita no banco remoto. Nenhuma migration foi aplicada. Nenhum merge, nenhum deploy.

## 1. Resumo executivo

- **Estado de produção:** o banco está **vazio** (0 empresas, 0 usuários, 0 produtos, 0 vendas, 0 caixas, 0 auditorias). Nenhum dado pessoal está exposto hoje. A janela de risco abre no primeiro cadastro.
- **Hotfix:** corrige as brechas de escrita direta em vendas e pagamentos, o `EXECUTE` de `anon` em funções financeiras e o vazamento entre empresas em `update_subscription_statuses`. Testado no ambiente local replicado do schema remoto: **17 de 18 casos passam**; o caso restante é um defeito conhecido, fora do escopo (K1).
- **Defeito funcional grave (K1):** a função `create_atomic_sale` do remoto **falha sempre** ("FOR UPDATE is not allowed with aggregate functions"). A primeira venda real falharia. Não é hotfix de segurança; é migração corretiva.
- **Drift:** o histórico de migrations remoto usa os números 019 a 021 para outras migrations. As migrations 019 a 021 do repositório nunca foram aplicadas. Há funções e triggers em produção que não existem no repositório.
- **Parecer:** GO técnico para o hotfix, condicionado à sua aprovação explícita para aplicar em produção. **NO-GO** para abrir o cadastro de clientes até K1 e o caixa direto estarem resolvidos (ver seção 8).

## 2. Diagnóstico de acesso

| Canal | Conta | Enxerga o Venddi |
|---|---|---|
| CLI Supabase | Conta com acesso à organização Damatta | Sim (leitura confirmada) |
| Conector MCP | Conta com acesso só à organização NatureCode | Não |

Causa do MCP: a conexão do conector está em outra conta. A reconexão precisa do seu login interativo (`/mcp`, conta com acesso à Damatta). Não editei `~/.claude.json` (contém credenciais) e não iniciei OAuth por conta própria. **Bloqueio humano.**

## 3. Inventário do histórico remoto x repositório

Histórico remoto (`supabase_migrations.schema_migrations`, somente leitura):

| Versão | Remoto | Repositório | Situação |
|---|---|---|---|
| 001 a 018 | Mesmos nomes dos arquivos | Mesmos nomes | Alinhado no nome. **018 tem conteúdo diferente** (ver 3.2) |
| 019 | `invite_hardening` | `019_physical_inventory` | **Colisão de número.** Migration 019 do repositório nunca aplicada |
| 020 | `caixa_fechamento_cancelamento` | `020_stock_non_negative_guard` | **Colisão.** Nunca aplicada |
| 021 | `security_followups` | `021_fix_sale_number_lock` | **Colisão.** Nunca aplicada |
| 022 a 030 | Não registradas | `022` a `030` | Não aplicadas (030 é o hotfix local de escrita direta) |

### 3.1 Origem do drift (evidência)

Os objetos que existem no remoto e não no repositório vêm do próprio histórico remoto:

| Objeto remoto fora do repositório | Migration remota que o cria |
|---|---|
| `snapshot_sale_commission`, `trg_sale_commission_snapshot` | 018 |
| `guard_user_identity_change`, `trg_guard_user_identity_change` | 019 |
| `relatorio_fechamento_caixa`, `calc_fechamento_caixa`, `caixa_saldo_esperado`, `relatorio_caixas_periodo` | 020 |
| `guard_sale_tenant`, `guard_sale_cancellation` (e triggers) | 021 |

Conclusão: a produção tem trabalho feito diretamente no remoto, registrado com números que colidem com o repositório. Esse trabalho é desejável em parte (guardas de tenant e de cancelamento), mas não está no repositório.

### 3.2 Mesmo nome, conteúdo diferente

A migration **018** remota tem 6.930 bytes e cria `snapshot_sale_commission`. A 018 do repositório (`commission_and_discount_rules`) tem 4.813 bytes e não cria essa função. Precisa de reconciliação de conteúdo.

## 4. Vulnerabilidades financeiras mapeadas

| # | Gravidade | Vulnerabilidade | Evidência | Status |
|---|---|---|---|---|
| V1 | Crítica | Escrita direta (INSERT, UPDATE, DELETE) em `sales`, `payments`, `sale_items` por qualquer usuário da empresa | Políticas no remoto; testes A1 a A5 falhavam antes | **Corrigida pelo hotfix** |
| V2 | Alta | `EXECUTE` para `anon` (e `PUBLIC`) em funções financeiras e de permissão | ACL do remoto; testes A9 e A10 | **Corrigida pelo hotfix** |
| V3 | Alta | `update_subscription_statuses` é `SECURITY DEFINER` sem checagem de chamador: usuário de uma empresa expira trial de **todas** | Corpo da função; teste A11 falhava antes | **Corrigida pelo hotfix** |
| V4 | Alta | Escrita direta em `cash_registers` e `cash_movements` (abrir, fechar, sangria, suprimento) | Políticas no remoto; o app publicado (main) depende disso | **Não corrigida.** Remover quebra o caixa em produção. Ver seção 8 |
| V5 | Alta (funcional) | `create_atomic_sale` do remoto falha sempre (K1) | Reproduzido: "FOR UPDATE is not allowed with aggregate functions" | **Não corrigida.** Migração corretiva (seção 7) |
| V6 | Média | App publicado chama `cancel_sale_with_reversal` com 4 argumentos; o remoto tem 2 | Código do main x dump remoto | **Não corrigida.** Quebra o cancelamento a partir do app publicado |
| V7 | Média | `anon` pode executar `register_tenant` | ACL | **Mantida de propósito** (cadastro de empresa) |

Verificado e **sem falha** no remoto:
- Escrita direta na auditoria: já negada (só `SELECT`), testes A6 e A7.
- Cancelamento de venda alheia por outra empresa: recusado, teste A8.
- Caixa não cancela venda: recusado pelo papel, teste L5.
- Alteração de status de venda fora do cancelamento oficial: bloqueada por `guard_sale_cancellation`.
- `set_commission_percent`: exige owner ou admin e filtra pela empresa.

## 5. Hotfix (branch própria, fora de `supabase/migrations/`)

Arquivos:
- `supabase/hotfix/sec01_hotfix_escrita_direta.sql`: aplica o hotfix.
- `supabase/hotfix/sec01_rollback.sql`: desfaz, restaurando políticas, grants e o corpo original de `update_subscription_statuses`.
- `supabase/hotfix/tests/sec01_autorizacao.sql`: testes de autorização e isolamento (grupos A, L e K).
- `supabase/hotfix/README.md`: como replicar o schema remoto localmente.

O que o hotfix faz:
1. Remove as 9 políticas de escrita direta em `sales`, `payments` e `sale_items`.
2. Revoga `EXECUTE` de `PUBLIC` e `anon` em 11 funções financeiras e de permissão, e devolve `EXECUTE` a `authenticated` onde ele já existia.
3. Substitui `update_subscription_statuses` para que, com sessão de usuário, ela atue só na empresa do usuário. Sem sessão (cron, service role), o comportamento global é mantido.

O que o hotfix **não** faz (de propósito):
- Não remove a escrita direta de caixa (V4), porque o app publicado depende dela.
- Não corrige `create_atomic_sale` (K1), que é defeito funcional.
- Não reaplica migrations antigas e não edita o histórico remoto.

## 6. Testes (replicação local do schema remoto)

Ambiente: Postgres 16 local com o schema do dump remoto carregado (21 tabelas, funções, triggers e políticas). Três erros de carga são esperados e não afetam os testes: schema `extensions`, `supabase_vault` e a publicação de realtime, que são do ambiente gerenciado.

| Caso | Antes do hotfix | Depois do hotfix | Depois do rollback |
|---|---|---|---|
| A1 a A5 (escrita direta em vendas, pagamentos e itens) | FALHOU | OK | FALHOU |
| A6, A7 (auditoria) | OK (já protegida) | OK | OK |
| A8 (outra empresa cancela) | OK | OK | OK |
| A9, A10 (`anon` executa) | FALHOU | OK | FALHOU |
| A11 (trial de outra empresa) | FALHOU | OK | FALHOU |
| K1 (defeito de `create_atomic_sale`) | Defeito | Defeito (fora do escopo) | Defeito |
| L2 a L5 (caixa direto e cancelamento) | OK | OK | OK |
| L6, L7 (`authenticated` mantém `EXECUTE`) | OK | OK | OK |

Resultado: **17 de 18** casos OK após o hotfix. O rollback volta exatamente ao estado vulnerável, e o hotfix pode ser reaplicado.

Testes do repositório (`npm`):
- `tsc --noEmit`: passa.
- `vitest run`: 82 testes passam.
- `npm run build`: ver seção 9.

Observação de método: a primeira versão do teste de A11 estava mal formada (abortava a transação). Foi reescrita e rerodada antes de qualquer conclusão.

## 7. Plano de reconciliação do drift (sem reaplicar migrations antigas)

Princípio: incorporar ao repositório o que é necessário, corrigir o que é inseguro, nunca reaplicar 019 a 021 automaticamente.

1. **C-01: `create_atomic_sale`.** Migração corretiva nova que porta a correção de 021 e 028 (trava da numeração, ordem de travas, checagem de caixa aberto) para as colunas reais do remoto (`salesperson_id`, `commission_percent_snapshot`). Teste de compatibilidade com os triggers `trg_sale_commission_snapshot` e `trg_guard_sale_tenant`.
2. **C-02: incorporar o drift ao repositório.** Migração que declara as funções e triggers que existem só no remoto (`guard_sale_*`, `snapshot_sale_commission`, `guard_user_identity_change`, `relatorio_*`, `calc_fechamento_caixa`, `caixa_saldo_esperado`), com testes.
3. **C-03: reconciliar a 018.** Comparar o conteúdo remoto (6.930 bytes) com o repositório (4.813 bytes) e decidir qual é a versão correta antes de qualquer migração nova.
4. **C-04: renumerar as migrations do repositório 019 a 030** para números que não colidam com o remoto (por exemplo, 031 em diante), para que `migration up` as trate como novas.
5. **C-05: cancelamento.** Alinhar o app à assinatura remota (2 argumentos) ou criar a versão de 4 argumentos com testes. Decisão de produto.
6. **C-06: caixa direto (V4).** Só depois de publicar o app novo, que usa as RPCs de caixa, remover as políticas de escrita direta de `cash_registers` e `cash_movements`.
7. **C-07: revisão de grants.** Revisar `register_tenant` e a lista de funções que o app chama (ver `supabase/hotfix/sec01_hotfix_escrita_direta.sql`).

## 8. Parecer GO/NO-GO

| Item | Parecer | Condição |
|---|---|---|
| Aplicar o hotfix em produção | **GO técnico** | Sua aprovação explícita. Produção está vazia, então o impacto atual é baixo |
| Liberar cadastro de clientes reais | **NO-GO** | K1 corrigido (C-01), caixa direto resolvido ou documentado (C-06), drift reconciliado (C-02, C-03, C-04) |
| Publicar o app do PR #20 | **NO-GO** | Depende de C-01, C-04, C-05 e das RPCs de caixa (migration 029 adaptada ao remoto) |

Riscos residuais após o hotfix:
- V4 (caixa direto): vendedor não consegue gravar caixa, mas qualquer usuário de caixa da empresa consegue alterar abertura, fechamento e sangria diretamente. Aceito só até o app novo ser publicado.
- K1: nenhuma venda é concluída pela RPC do remoto. Isso bloqueia o negócio, mas não expõe dados.
- Drift: funções e triggers de produção sem testes no repositório.
- `anon` em `register_tenant`: necessário para cadastro, mas merece revisão.

## 9. Backup e integridade

- **Schema:** dump do schema remoto salvo em diretório privado fora do repositório (`scratchpad`, 112.786 bytes, somente leitura).
- **Dados:** dump somente leitura, sem nenhuma linha. Coerente com o banco vazio (contagens confirmadas). Arquivo de 6.649 bytes, 0 comandos `INSERT` e 0 `COPY`.
- **Integridade:** prefixo SHA-256 registrado. Nenhum dado pessoal foi copiado para o repositório, para commits ou para outro projeto.
- Nenhum recurso remoto foi criado. Nenhum projeto de homologação foi criado (exige aprovação e pode ter custo).

Build de produção (`npm run build`): passa, código 0, sem erros.

## 10. Plano de homologação isolada

1. Projeto Supabase novo e separado, com dados sintéticos ou anonimizados (nenhum dado real). **Criar exige sua aprovação** (custo ou ação administrativa).
2. Restaurar o schema remoto no projeto isolado e comparar com o dump (mesmo método desta auditoria).
3. Aplicar, nessa ordem: hotfix (seção 5), depois C-01 a C-07 quando existirem.
4. Rodar `supabase/hotfix/tests/sec01_autorizacao.sql` e as suítes `supabase/tests/*.sql`, uma execução por vez.
5. Rodar `concorrencia_caixa.sh` com 15 rodadas e validar a invariante.
6. E2E de venda e caixa pela interface, com conferência no banco.

Aplicação em produção só depois de homologação aprovada, com backup de schema e dados e janela de manutenção.

## 11. Bloqueios que exigem intervenção humana

1. **Reconectar o conector MCP à Damatta** via `/mcp` (login interativo).
2. **Aprovar a aplicação do hotfix em produção** (GO técnico, seção 8).
3. **Aprovar a criação de um projeto de homologação isolado.**
4. **Decidir sobre C-05** (assinatura do cancelamento: alinhar o app ou criar a versão de 4 argumentos).
5. **Decidir sobre a reconciliação da 018** (qual conteúdo é o correto).
6. **Autorizar a publicação do app novo** só depois de C-01, C-04 e C-06.

## 12. Entregáveis e commits

- `docs/AUDITORIA_REMOTA_HOMOLOGACAO.md` (commit `adc8085` em `feat/caixa-transacional`): contém correções a esta análise, indicadas na seção 13.
- `docs/SEC01_RELATORIO.md`: este relatório.
- Branch `hotfix/sec01-escrita-direta` (a partir de `origin/main`): hotfix, rollback, testes e README do hotfix.

## 13. Correções à auditoria anterior (`docs/AUDITORIA_REMOTA_HOMOLOGACAO.md`)

- Eu havia escrito que o cancelamento do remoto não tinha checagem de papel. **Errado:** o remoto tem checagem de papel e o trigger `guard_sale_cancellation`. O problema real é a assinatura (V6).
- Eu havia escrito que as migrations 019 a 021 "aparecem como aplicadas, sem efeito". **Mais preciso:** o remoto registra outras migrations com esses números. As do repositório nunca foram aplicadas (seção 3).
- Eu havia escrito que a auditoria de vendas no remoto tinha políticas genéricas. **Errado:** só vendas, pagamentos e itens têm essas políticas. A auditoria já é só leitura.
