# VENDDI — Go-live 02: integração, Golden Flow e camada fiscal

Data: 2026-11-05
Branch de integração: `integracao/go-live-02` (a partir de `origin/feat/caixa-transacional`, o head do PR #20, com o PR #21 incorporado)
Branches originais preservadas: `claude/venddi-sprint-go-live-b99233` (PR #21) e `feat/caixa-transacional` (PR #20)
Resultado: **NO-GO continua** (ver seção 7). Houve redução comprovada de bloqueios P0, mas não a zero.

## 0. Decisões do proprietário aplicadas

| Decisão | Como foi cumprida |
|---|---|
| Fiscal por provedor, Focus NFe candidata | Adaptador Focus implementado; nenhuma chamada real. Escolha final condicionada à análise técnica e comercial. |
| Homologação em Supabase local com Docker e dados sintéticos | Postgres 16 em Docker (container `venddi-pg`), migrations 001→032 e dados sintéticos. **Não** foi subido o stack completo do Supabase CLI (ver seção 3.4). |
| PRs #20 e #21 em branch separada, sem merge na `main` | Branch `integracao/go-live-02`; nenhum merge. |
| Banco remoto: somente leitura | Nenhuma escrita no remoto. Só consultas de leitura anteriores (auditoria `adc8085`, de outra sessão). |
| Produção: nenhuma alteração | Nenhuma. |
| Contratação de serviços: não autorizada | Nenhuma. Focus não foi contratada nem chamada. |
| Emissão fiscal real: não autorizada | Nenhum documento transmitido. `FISCAL_ENABLED = false`; produção bloqueada no código. |

## 1. Tarefa 1 — Unificação das correções

### 1.1 Integração

- Merge do PR #21 em `feat/caixa-transacional`: 4 conflitos (`PDVPage.tsx`, `sales.ts`, `router.tsx`, `PROXIMOS_PASSOS.md`). Resolvidos mantendo a versão do PR #20, que já traz catálogo real, troco e idempotência no PDV. As correções do PR #21 que não conflitavam (leitor de código, `pdvHelpers`) foram mantidas.
- **Correção de minha afirmação anterior:** no GO_LIVE_01 eu disse que a regra de desconto (5% e só em dinheiro) estava só no cliente (P0-06). Isso estava errado. A migration **018** (já em `main`) cria os triggers `trg_sale_discount_limit` e `trg_payment_discount_cash_only`, e o teste `commission_discount_check.sql` já cobre a regra. Eu tinha criado a migration 030 (que virou 031) duplicando isso. **A 031 foi removida** antes de chegar a qualquer banco.
- Numeração: a migration de desconto colidia com a 030 do PR #20 (`030_fecha_gravacoes_diretas`). Resolvido ao remover a duplicata.

### 1.2 Sequência 028 → 029 → 030 (e 032 desta sprint)

Validada num Postgres limpo com o runner `supabase/tests/run_local_db_tests.sh`, aplicando **todas** as migrations em ordem. Divergências encontradas e corrigidas:

| # | Divergência | Efeito | Correção (commit) |
|---|---|---|---|
| D1 | `GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal TO authenticated` sem lista de argumentos em 022, 026, 028 e 029. Existem overloads, então a função é ambígua. | Migrations quebravam num banco limpo ("function name is not unique"). | `021d62c`: assinatura explícita. |
| D2 | A versão de 4 argumentos (usada pela tela) fazia `UPDATE sales` sem liberar a trava `app.cancel_sale` da migration 021. | **Cancelar venda pela interface falhava no banco** ("só pode ser cancelada pelo cancelamento oficial"). Reproduzido no `e2e_fluxo_integrado.sql` (passo 7). | `021d62c`: libera a trava e grava `cancelled_by`. |
| D3 | `VendasPage` chamava `cancelSale(id, motivo)` sem o `operatorId` obrigatório. Erro de tipo no typecheck; em runtime a RPC recusaria. | Cancelamento pela tela quebrado. | `fd666c5`: usa o usuário da sessão. |
| D4 | Testes com asserção frágil: esperavam erro onde o RLS só filtra (0 linhas), ou esperavam 0 linhas onde a trava lança 42501. | Falsos vermelhos. | `021d62c`: os testes aceitam os dois bloqueios e conferem o estado final. Nenhuma regra de segurança foi afrouxada. |
| D5 | Prefixos duplicados: `019` (invite_hardening e physical_inventory), `020` (caixa_fechamento e stock_guard), `021` (fix_sale_number_lock e security_followups). | Risco de `supabase db push` recusar ou aplicar fora de ordem. | **Não renomeado**: já aplicados no histórico do remoto. Pendência P1. |
| D6 | Overload legado `cancel_sale_with_reversal(UUID, TEXT)` (021) ainda existe ao lado da versão de 4 argumentos. | Dois caminhos de cancelamento com regras possivelmente diferentes. Os testes atuais ainda usam a forma de 2 argumentos. | Não removido nesta sprint (quebraria testes). Pendência P1. |
| D7 | **Drift no remoto** (auditoria `adc8085`): o remoto tem 001–021 registradas, com 019–021 registradas mas sem tabelas, triggers e travas do schema real; funções de drift fora do repositório; políticas de escrita direta em vendas. | Aplicar a cadeia 022→032 no remoto sem reconciliação é perigoso. | **Bloqueio** (seção 7). |

Resultado da cadeia: `MIGRATIONS OK` do runner, 001→032 aplicadas num banco limpo.

## 2. Tarefa 2 — Golden Flow

### 2.1 Testes executados (contra Postgres 16 local, com RLS e papéis reais)

Runner `supabase/tests/run_local_db_tests.sh`: **exit 0**, 24 arquivos SQL ok, mais concorrência e reenvio.

| Teste | O que cobre | Resultado |
|---|---|---|
| `golden_flow_go_live02.sql` (novo, 14 blocos, RPCs reais) | Abertura pelo operador, reenvio de abertura, venda em dinheiro com troco (banco recebe só o aplicado), PIX, cartão, reenvio de venda com mesma chave (estoque baixa uma vez), desconto 5% válido, desconto 5,01% recusado, desconto com cartão recusado, suprimento, sangria, reenvio de sangria (gravada uma vez), sangria acima do saldo recusada, estorno pelo gerente, caixa e outra empresa recusados, saldo esperado 179, fechamento com diferença zero, reenvio de fechamento (replay), venda com caixa fechado recusada | ✅ |
| `golden_reenvio_concorrente.sh` (novo) | 3 tentativas simultâneas com a mesma chave: 1 venda, 1 pagamento, estoque 10 → 7 | ✅ |
| `caixa_transacional.sql`, `cash_closing_cancel_check.sql`, `e2e_fluxo_integrado.sql` | Caixa, fechamento, estorno, inventário, permissões, isolamento | ✅ |
| `concorrencia_caixa.sh` (15 rodadas) | Concorrência de caixa | ✅ 0 violações |
| `inventory_concurrency_check.sh` | Concorrência de inventário | ✅ |
| `rls_isolation_test.sql`, `rls_integration_tests.sql`, `isolamento_permissoes_vendas.sql`, `security_followups_check.sql` | Isolamento entre empresas e permissões | ✅ |
| `commission_discount_check.sql` | Regra de desconto e comissão (018) | ✅ |
| `fiscal_protecao_check.sql` (novo) | Privilégios de coluna do token e da CSC; transições de status | ✅ |

### 2.2 Cobertura da lista pedida

| Item pedido | Coberto por | Situação |
|---|---|---|
| Abertura de caixa | golden 1 | ✅ |
| Leitura de produtos | `QuickProductSearch` / `getProducts` (unitário e tela); código de barras testado em `pdvHelpers` | ⚠️ leitura por RPC/REST não testada no banco |
| Vendas, dinheiro, troco, PIX, cartão | golden 2–5 | ✅ no banco; troco só no cliente (ver P1) |
| Descontos | golden 6–8, `commission_discount_check` | ✅ |
| Cancelamentos | golden 10, `e2e` 7 | ✅ (após D2) |
| Sangrias e suprimentos | golden 9 (pelas RPCs) | ✅ |
| Fechamento | golden 12–13 | ✅ |
| Concorrência | `concorrencia_caixa.sh`, `inventory_concurrency_check.sh`, `golden_reenvio_concorrente.sh` | ✅ |
| Reenvio após falha de rede | golden 3b, 9c, 13c e teste concorrente | ✅ no banco |
| Isolamento entre empresas | golden 11, `rls_isolation_test` | ✅ no banco |

### 2.3 Falhas reproduzidas nesta sprint

D1, D2, D3 e D4 (seção 1.2). Mais dois achados do golden:
- **Papel do operador de caixa:** o caixa pertence a quem o abriu. Um teste inicial abriu o caixa com o gerente e o operador não conseguiu movimentar. Isso é o comportamento desenhado na 029, não um bug. O teste foi ajustado para o operador abrir o próprio caixa.
- **Campo de saldo:** o relatório de fechamento devolve `expected_cash`, não `expected_balance`. Só ajuste do teste.

### 2.4 Não executado nesta sprint

- **E2E de interface (navegador).** Tentei o modo dev com mock no navegador embutido, mas a abertura de caixa pela automação não ficou confiável e o estado mock se perde a cada recarga. A tela de venda, o troco e o leitor **não foram conferidos na prática**.
- **Stack Supabase completo** (`supabase start`, com Auth, PostgREST e Kong). Usei Postgres puro com stub de `auth.uid()`. O RLS foi testado trocando `role` e `request.jwt.claim.sub`, o que simula bem mas não passa pelo PostgREST real. Subir o stack exige baixar várias imagens grandes; fica como próximo passo.
- Leitor físico, impressora térmica, gaveta.

## 3. Tarefa 3 — Fiscal Pernambuco

### 3.1 Requisitos (fontes e nível de confiança)

Fontes **secundárias** (blogs de fornecedores). O texto oficial do Ajuste SINIEF 23/2026 e da NT 2026.002 **não foi acessível** pelas ferramentas: o portal da NF-e retornou erro de redirecionamento e o CONFAZ não apareceu nos resultados. Tratar tudo abaixo como **a confirmar pelo contador** antes de qualquer decisão.

| Tema | O que as fontes dizem | Confiança |
|---|---|---|
| NFC-e 65 é o padrão para varejo a consumidor em PE | Decreto 44.650/2017 (arts. 147 a 149), Ajuste SINIEF 19/2016, Portaria SF 192/2017; ECF não autorizado desde 01/08/2017. Fontes: [SEFAZ-PE — NFC-e perguntas e respostas](https://www.sefaz.pe.gov.br/Publicacoes/Novo%20regulamento%20ICMS/Informativos%20a%20partir%20de%2001.10.2017/NFC-e%20-%20NOTA%20FISCAL%20CONSUMIDOR%20ELETR%C3%94NICA.pdf), [Portaria SF 192/2017](https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Portarias/2017/Port192_2017.htm) | Alta para a existência da obrigação; detalhes a confirmar |
| Limite de valor da NFC-e sem identificação do consumidor | Regra W16-40 da NT 2026.002; valor de referência R$ 10.000,00, com parametrização por UF | Média. Valor real por UF não verificado |
| Ajuste SINIEF 23/2026 | Varejista com venda que permite ao adquirente aproveitar crédito de ICMS deve emitir **NF-e modelo 55**. Publicado no DOU em 9/07/2026 (Despacho CONFAZ 30). Efeitos práticos a partir de 5/10/2026 segundo fontes. Estados podem fixar limites próprios. Fontes: [Inventti](https://inventti.com.br/?p=25000), [portalspedbrasil](https://portalspedbrasil.com.br/forum/nf-e-danfe-simplificado-varejo-ajuste-sinief-no-23-de-3-de-julho-de-2026/), [COAD (Despacho 30)](https://www.coad.com.br/home/noticias-detalhe/138516/confaz-publica-despacho-30-com-novos-ajustes-sinief-aprovados-em-reuniao-ordinaria) | Média. Fontes divergem sobre a data |
| **Venda a destinatário identificado por CNPJ** | **Fontes divergentes.** [Jettax](https://www.jettax.com.br/blog/mudancas-na-nfe-e-nfce/) diz que vendas a pessoa jurídica passam a exigir NF-e 55. [amdjus](https://amdjus.com.br/?p=23611) diz "mantido o uso da NFC-e para empresas (CNPJ)". A NT 2026.002 trata CNPJ apenas no alerta de situação irregular e no limite de R$ 10.000,00. | **Baixa. Não implementar regra fixa.** |
| NT 2026.002 (DANFE Simplificado Tipo 2) | Permite NF-e 55 com DANFE simplificado em operações de varejo presenciais e não presenciais, com restrições (consumidor final, sem entrada, sem interestadual, CFOPs específicos). Cronograma de homologação e produção entre 01/06/2026 e 14/12/2026. | Média |
| Ajuste SINIEF 29/2026 | Prorroga a vedação de referenciar NFC-e em NF-e de saída para 14/12/2026 (secundária). | Baixa |
| Responsável técnico na NFC-e | Obrigatório desde 01/08/2019 (NT 2018.005 v1.30), por [COAD](https://www.coad.com.br/home/noticias-detalhe/94228/pernambuco-informa-sobre-a-obrigatoriedade-de-identificacao-do-responsavel-tecnico-na-nfc-e). | Média |
| TEF para cartão | Citado em blog de fornecedor (Decreto 46.087/2018). Não verificado. | Baixa. Não assumir |

**Conclusão:** a regra de modelo (65 ou 55) depende de decisão tributária do contador por empresa e pode mudar por UF. Por isso o código **não fixa** a regra: ela é um parâmetro (`regraEmpresa`) e o limite é injetado.

### 3.2 O que foi implementado

| Componente | Arquivo | Estado |
|---|---|---|
| Máquina de estados (mesmas transições do banco) | `src/lib/fiscal/core.ts` | ✅ testado |
| Regra de modelo 65/55 e bloqueio acima do limite sem identificação | `escolherModelo` em `core.ts` | ✅ testado |
| Orquestração idempotente: compare-and-set, rejeição sem retentativa, erro técnico com retentativa e **mesma referência**, `processing`, `pending` para fila, produção bloqueada | `emitirDocumento` em `core.ts` | ✅ 14 testes |
| Adaptador Focus: mapeamento puro de status HTTP e de status do documento; fetch injetável | `src/lib/fiscal/focusAdapter.ts` | ✅ 10 testes simulados |
| Persistência segura: revogação de `api_token`, `csc` e escrita direta; trigger de transição | `supabase/migrations/032_fiscal_protecao_credenciais.sql` | ✅ teste SQL |
| Cliente sem caminho de emissão real | `src/lib/api/fiscal.ts` (`emitNfceForSale` só aceita modo mock) | ✅ |

**Nenhum documento foi transmitido.** Os testes usam provedor e repositório simulados. O adaptador nunca é chamado com credencial real. `FISCAL_ENABLED` segue `false`.

### 3.3 Falha de segurança encontrada e corrigida (P0)

`fiscal_configurations.api_token` (token do provedor) e `csc` eram **legíveis por qualquer usuário autenticado da empresa**, e o navegador chamava o provedor diretamente (`focusNFeProvider.ts`). Corrigido no banco (032) e no cliente (guarda em `emitNfceForSale`). **Resíduo:** o código `focusNFeProvider.ts` e `fiscalService.ts` ainda existem como caminho morto; devem ser removidos quando a Edge Function for criada.

### 3.4 O que falta para emissão de verdade (bloqueado)

1. Contador confirma a regra de modelo por empresa (NFC-e 65 ou NF-e 55) e o tratamento de venda a CNPJ.
2. Decisão do proprietário sobre o provedor (contrato e custo) ou emissão própria.
3. Edge Function server-side que chama o adaptador, com o token em secret do Supabase (ou Vault), e a camada de estados gravando em `fiscal_documents` com a service role.
4. Homologação com o ambiente de homologação do provedor, com CNPJ e CSC **de teste**.
5. Cadastro fiscal por produto (`product_fiscal_data`: NCM, CFOP, CST/CSOSN) validado pelo contador. O payload ainda não foi montado com esses dados.
6. Contingência, cancelamento, inutilização e consulta com a mesma referência.
7. Certificado digital A1 e CSC de produção: exigem o proprietário e o credenciamento na SEFAZ-PE.

## 4. Tarefa 4 — Resultado de verificação

| Verificação | Comando | Resultado |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ sem erros |
| Testes unitários | `npx vitest run` | ✅ 14 arquivos, 128 testes |
| Build de produção | `npx vite build` | ✅ |
| Testes SQL (cadeia completa + golden + concorrência + reenvio) | `bash supabase/tests/run_local_db_tests.sh` | ✅ exit 0 |
| E2E de interface | — | ❌ não executado (ver 2.4) |
| Supabase CLI completo | — | ❌ não executado (ver 2.4) |

## 5. Commits e PR

Branch `integracao/go-live-02` (sobre `origin/feat/caixa-transacional`):

- `6b1c3fb` merge: integra PR #21 (go-live 01) em feat/caixa-transacional
- `021d62c` fix(db): cadeia de migrations 022→029 sobe em banco limpo; cancelamento pela tela
- `119d134` test(golden): fluxo de caixa e venda pelas RPCs reais + reenvio concorrente
- `fd666c5` fix(vendas): tela de vendas passa o operador logado no cancelamento
- `10ae29e` feat(fiscal): núcleo de emissão, adaptador Focus e proteção de credenciais (migration 032)
- (commit de documentação, este arquivo e `PROXIMOS_PASSOS.md`)

Originais, sem alteração nesta sprint: [PR #20](https://github.com/nocodenn-cell/Venddi/pull/20) (`feat/caixa-transacional`), [PR #21](https://github.com/nocodenn-cell/Venddi/pull/21) (`claude/venddi-sprint-go-live-b99233`).

PR draft da integração: ver resposta final.

## 6. Achados de outras branches (não integrados)

- `origin/homologacao/rc-integrado` já tem uma integração de RC (inventário, concorrência, decisão de go/no-go). **Não foi incorporada**, por fora do escopo pedido. Vale comparar antes do merge.
- `origin/hotfix/sec01-escrita-direta` tem um hotfix de produção com escrita direta e permissões de execução. Não integrado; verificar se conflita com a 030 do PR #20.

## 7. Resultado: NO-GO continua. O que falta para vender legalmente e operar com segurança

**P0 — bloqueios ainda abertos**

1. **Fiscal não homologado.** Emissão NFC-e/NF-e obrigatória para varejo em PE; módulo desligado. Depende de contador (seção 3.1), decisão de provedor e Edge Function (3.4). *Não há como vender legalmente sem isso para consumidor com emissão obrigatória.*
2. **Remoto com drift** (D7). Reconciliar o schema real com o repositório antes de aplicar 022→032. Exige backup e autorização do proprietário.
3. **E2E de interface não executado** com stack real. A validação atual é de banco, não de tela.
4. **Hardware** (leitor, impressora, gaveta) sem teste.

**P1 — falta para operar com segurança**

- Dois overloads de cancelamento (D6) e prefixos duplicados de migration (D5).
- Troco não gravado no banco (só o valor aplicado); a auditoria do valor recebido fica no cliente.
- Impressão de cupom não integrada ao PDV.
- Autorização do gerente para desconto acima de 5% (hoje a regra recusa, sem fluxo de autorização).
- Código morto de emissão no cliente (`focusNFeProvider.ts`, `fiscalService.ts`) a remover.
- Backup e restauração testados; plano pago do Supabase.
- Revisão jurídica (LGPD) e termos.

**Itens de ambiente:** subir o stack Supabase CLI completo para repetir os testes pelo PostgREST e pelo Auth reais.

## 8. Riscos residuais de segurança

- Overload legado de `cancel_sale_with_reversal` com outra regra (D6).
- Token fiscal ainda existe no banco (`api_token`), protegido por grant, não criptografado. O plano é mover para Vault ou secret do servidor.
- Políticas de escrita direta do remoto (auditoria `adc8085`) continuam até a reconciliação.
