# GO / NO-GO — primeiro cliente do Venddi

Data: 3 de novembro de 2026. Base: `homologacao/rc-integrado` (PRs #17, #18 e #19, migrations 001–027).

## Decisão

- **Homologação remota: GO.** O procedimento está escrito, ensaiado do zero e pronto para aplicação.
- **Primeiro cliente: NO-GO agora.** O motivo principal é o módulo de caixa (abrir, sangria, suprimento
  e fechamento): a tela grava direto nas tabelas, sem RPC e sem trilha de auditoria, e tem erro
  de código. As permissões foram endurecidas (migration 027), mas o fluxo não foi validado na tela.
- **Produção: NO-GO** até os bloqueios abaixo serem resolvidos e a homologação remota aprovada.

## Bloqueios para o primeiro cliente

| # | Bloqueio | Por que bloqueia | O que falta |
|---|---|---|---|
| B1 | Caixa grava direto nas tabelas (abrir, sangria, suprimento, fechar) | Integridade financeira depende de a tela estar certa; não há RPC nem trilha de auditoria. Em `cashRegister.ts`, `total_withdrawals` recebe uma promessa de `rpc()` dentro de `update()`, o que não grava o valor | **Resolvido na branch `feat/caixa-transacional` (migration 029):** RPCs com idempotência, log imutável, trava de status e de caixa fechado, tela reescrita; matriz em `docs/CAIXA_TRANSACIONAL.md`. Pendente: aplicar no remoto de homologação e rodar o roteiro (seção 5) |
| B2 | Fluxo de venda pela tela do PDV não validado (U14–U17) | É o fluxo de receita do cliente | Roteiro manual, seção 3, etapas 1–4 |
| B3 | Fechamento de caixa pela tela não validado (U19) | Conciliação do dia | Roteiro manual, etapa 10, e conferência de valores |
| B4 | Homologação remota não executada | Não há projeto de homologação identificado nas contas acessíveis (o projeto indicado como Venddi é o de produção, e não foi tocado) | Informar o projeto de homologação; aplicar o procedimento |
| B5 | Revisão do Codex sobre os commits finais | Achados novos apareceram a cada rodada | Aguardar a revisão final e tratar |

## Achados corrigidos nesta rodada (com evidência)

| Achado | Gravidade | Correção | Evidência |
|---|---|---|---|
| Owner de outra empresa vendia na loja A e baixava estoque | **P0** | Migration 026: empresa e operador conferidos contra a sessão | Reproduzido; `isolamento_permissoes_vendas.sql` falha sem a 026 e passa com ela |
| Owner de outra empresa cancelava venda da loja A | **P0** | Migration 026 | Idem |
| Vendedor gravava sangria e zerava o valor inicial do caixa | **P0** | Migration 027: políticas de caixa, razão imutável, valor inicial só gerência | Reproduzido (100 → 0); `permissoes_caixa.sql` falha sem a 027 e passa com ela |
| Caixa cancelava venda pela RPC (a restrição existia só na tela) | P1 | Migration 026: papel owner/admin/manager | `isolamento_permissoes_vendas.sql`, passo 5 |
| Trial de outra empresa legível | P2 | Migration 026 | Passo 8 do mesmo teste |
| Venda e entrada no mesmo produto se bloqueavam (deadlock) | P1 (Codex) | Trava da numeração `FOR NO KEY UPDATE` (021 e 026) | `concorrencia_chave_estrangeira.sh`: com `FOR UPDATE` dá deadlock (saída 1), com `FOR NO KEY UPDATE` passa; RPC real × entrada passa, saldo 19 |
| Rascunho pendente após cancelar inventário deixava a tela presa | P2 (Codex) | PR #17, `7f626e0` | Testado no navegador: Voltar devolve à lista |
| Erro de conclusão aparecia atrás do modal | P2 (Codex) | PR #17, `7f626e0` | Erro dentro do diálogo (verificado no código; sem teste de UI) |
| Runner de testes ignorava falha de conexão | P2 (Codex) | PR #19, `bc7b4e8` | Teste que encerra a própria conexão: runner falha com exit 1 |
| Índice 024 com `CONCURRENTLY` podia ficar inválido e ser ignorado | P2 | Guarda na 024 e procedimento | Testado: índice inválido é recusado; recuperação oficial funciona |
| Filtro de estoque baixo lia tudo no cliente e mandava ids na URL | P2 (desempenho) | View `produtos_estoque_baixo` (025) | Testado com E2E e isolamento |

## Evidências gerais

- Reprodução integrada (`run_local_db_tests.sh`): migrations 001–027 do zero; 16 suítes SQL; concorrência
  de inventário OK; guarda de venda OK.
- Ensaio de rollback (`ensaio_rollback.sh`): OK.
- Unitários: 69 de 69. Typecheck e build: OK.
- Navegador: 12 fluxos PASSOU (ver `docs/HOMOLOGACAO_COMERCIAL.md`, seção 2); 8 NÃO TESTADOS, todos da tela de caixa e do PDV.

## Riscos residuais (aceitos para homologação, não para o primeiro cliente)

- A migration 027 protege contra o vendedor e contra alteração do razão; **um caixa ainda pode alterar o
  valor final e o status do próprio caixa** pela tela atual. Resolve-se com as RPCs do B1.
- Migrations 021, 022 e 026 trocam funções de venda: precisam ir **junto com o app** na mesma janela.
  Não têm rollback seguro (ver `docs/PROCEDIMENTO_MIGRATIONS_HOMOLOGACAO.md`, seção 6).
- A mensagem de estoque insuficiente chega ao operador, mas a tela de PDV não foi exercitada.
- O painel depende de empresa com assinatura ativa ou trial válido (migration 016): empresa com trial vencido
  vê zeros, o que é o comportamento desejado, mas precisa estar explicado ao cliente.
- Carga: testado com até 1 milhão de vendas em um cenário sintético. Não testado com concorrência de vários
  usuários de tela ao mesmo tempo.
- A reprodução é local (Postgres 17 do CLI). Homologação remota pode ter diferenças de rede e de limites da API.

## Fora de escopo nesta rodada (deliberadamente)

- Nenhum merge, nenhum deploy, nenhuma alteração no Supabase de produção, nenhum serviço pago criado,
  nenhum secret alterado.
- Reescrita do módulo de caixa (B1): é a próxima tarefa, com revisão.

## Próximos passos (em ordem)

1. Reescrever o caixa com RPCs auditadas (abrir, sangria, suprimento, fechar), com testes de banco e de tela.
2. Executar o roteiro manual do PDV e do caixa (`docs/HOMOLOGACAO_COMERCIAL.md`, seção 3).
3. Informar o projeto de homologação remota e aplicar o procedimento de migrations, com backup antes.
4. Tratar a revisão final do Codex.
5. Reavaliar este GO/NO-GO com as evidências da homologação remota.

## Atualização da rodada de fechamento

Hashes exatos (commit no GitHub):

| Item | Branch | Commit |
|---|---|---|
| PR #17 (inventário) | `claude/venddi-physical-inventory-b9599c` | `be8dc62` |
| PR #18 (venda, estoque, caixa) | `fix/venda-baixa-estoque-concorrente` | `2fc09fb` |
| PR #19 (painel, produtos, testes) | `fix/dashboard-dados-reais` | `bc7b4e8` |
| Release candidate integrado | `homologacao/rc-integrado` | `a31b775` (código testado pela bateria; o topo atual `55508b1` só acrescenta este relatório) |

Resultados desta rodada:

| # | Item | Status | Evidência |
|---|---|---|---|
| 1–5 | Inventário: voltar com salvamento pendente, concluir com salvamento em voo, falha sem perda, persistência única, conclusão bloqueada com pendência ou erro | PASSOU (lógica) | `draftCoordinator.test.ts`: 13 testes; mutação (remover a espera pelo salvamento em voo) faz os testes do cenário do Codex falharem |
| 1–5 | Clique real em "Voltar" com teste automatizado de interface | NÃO TESTADO | O projeto não tem ferramenta de teste de interface; a página usa o coordenador testado, e um teste de fumaça no navegador passou |
| 6 | Ordem de travas e ausência de deadlock com `FOR NO KEY UPDATE` | PASSOU | `docs/ORDEM_TRAVAS_E_DEADLOCK.md`; `concorrencia_chave_estrangeira.sh` (FOR UPDATE falha, NO KEY UPDATE passa) |
| 7 | Concorrência venda × inventário | PASSOU | `stress_venda_inventario.sh`: 40 rodadas, 0 deadlocks, 0 falhas com a 028; sem a 028: 2 deadlocks em 40 |
| 8 | Commits recentes do PR #19 integrados | PASSOU | Os 8 commits mais recentes do PR #19 são ancestrais do RC |
| 9 | Migrations 023–025 e runner | PASSOU | Migrations no RC; `run_all_db_tests.sh`: `ALL DB TESTS OK`, saída 0 |
| 10 | RC atualizado com os commits finais | PASSOU | `a31b775` |
| 11 | Bateria integrada completa | PASSOU | `bateria_integrada.sh` em `a31b775`: reconstrução, 16 suítes, concorrências, estresse, rollback, 82 unitários, tipos, build |
| 12 | Hashes | PASSOU | Tabela acima |

Decisão desta rodada: os bloqueios para o primeiro cliente continuam os mesmos (módulo de caixa grava direto
nas tabelas; PDV e fechamento de caixa pela tela não validados; homologação remota não executada). As
correções de concorrência e permissões desta rodada não mudam a decisão.

**Recomendação: GO para homologação remota. NO-GO para o primeiro cliente até os bloqueios B1–B4.**
