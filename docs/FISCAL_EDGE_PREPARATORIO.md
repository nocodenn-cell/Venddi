# Edge Function fiscal (Focus NFe): etapa preparatória

Data: 2026-11-07
Status: **preparatória, em homologação. Não deployada. Não transmite. Produção desabilitada.**

## 1. Plano de implementação (aprovação antes da integração efetiva)

| Etapa | Conteúdo | Situação |
|---|---|---|
| P0 | Limpeza de conflitos de migration e overload legado | Feito (seção 6) |
| P1 | Núcleo de emissão (máquina de estados, regra de modelo, idempotência) | Feito, testado (`src/lib/fiscal/core.ts`) |
| P2 | Adaptador Focus (mapeamento puro + fetch injetável) | Feito, testado (`src/lib/fiscal/focusAdapter.ts`) |
| P3 | Camada server-side com DI (permissões, produção bloqueada, reenvio) | Feito, testado (`src/lib/fiscal/servidor.ts`) |
| P4 | Edge Function esqueleto: autentica, checa papel e empresa, lê secret, recusa transmissão | Feito, **não testado em runtime** (Deno indisponível aqui) |
| P5 | Montagem de payload fiscal (NCM, CFOP, CST/CSOSN, ICMS origem) a partir de `product_fiscal_data` | **Pendente** (depende do contador) |
| P6 | Empacotamento do núcleo para o Deno (ver 9.1) e ligação do adaptador à Edge Function | **Pendente** |
| P7 | Consulta e cancelamento | **Pendente** (exige decisão do contador: prazo e justificativa) |
| P8 | Homologação com ambiente de teste da Focus (CNPJ e CSC de teste) | **Pendente** (autorização específica) |
| P9 | Deploy da Edge Function | **Pendente** (autorização específica; nenhum deploy feito) |

## 2. Arquivos

Criados nesta etapa:
- `supabase/functions/fiscal-emitir/index.ts`: Edge Function esqueleto (não deployada).
- `src/lib/fiscal/servidor.ts`: camada de ações com injeção de dependências.
- `src/lib/__tests__/fiscalServidor.test.ts`: 11 testes.
- `supabase/migrations/033_cancelamento_overload_unico.sql`: resolução do overload e motivo mínimo no banco.
- `docs/FISCAL_EDGE_PREPARATORIO.md`: este documento.

Já existentes e reutilizados (sem alteração de comportamento):
- `src/lib/fiscal/core.ts`, `src/lib/fiscal/focusAdapter.ts`, migration 032.

Alterados:
- `src/lib/api/fiscal.ts`: `emitNfceForSale` só aceita modo mock (o token nunca sai do servidor).
- `src/lib/services/focusNFeProvider.ts`, `fiscalService.ts`: continuam no repositório como **código morto** a remover quando a Edge Function ligar.

## 3. Secrets necessários (somente no servidor)

| Nome | Uso | Onde fica | Observação |
|---|---|---|---|
| `FOCUS_TOKEN_HOMOLOG` | Token da API de homologação da Focus | Secret da Edge Function | Nunca no banco, nunca no navegador, nunca em log |
| `FISCAL_AMBIENTE` | Deve ser exatamente `homologacao` | Secret da Edge Function | Qualquer outro valor bloqueia |
| `SUPABASE_SERVICE_ROLE_KEY` | Consulta de papel e documentos | Fornecido pelo runtime | Só no servidor |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Autenticação do JWT | Fornecidos pelo runtime | — |
| `FOCUS_TOKEN_PRODUCAO` | **Não criar nesta etapa** | — | Só após homologação aprovada |
| CSC e certificado A1 | **Não criar nesta etapa** | — | Dependem do proprietário e da SEFAZ-PE |

Migração futura prevista: remover `fiscal_configurations.api_token` e `csc` do banco (hoje protegidos por grant pela migration 032, mas ainda armazenados em texto). Plano: Vault do Supabase ou secret por empresa.

## 4. Fluxos

**Emissão (planejado):** cliente chama `fiscal-emitir` com `{acao: "emitir", documento_id}` → função autentica (JWT) → confere papel e empresa no banco → carrega o documento `pending` → monta payload no servidor → `emitirDocumento` (CAS `pending→processing`) → Focus `POST /v2/nfce?ref=<reference>` ou `/v2/nfe` → resultado gravado: `authorized` (chave, protocolo), `rejected` (sem retentativa), `pending` (erro técnico esgotado, fila para reenvio) ou `processing` (SEFAZ ainda processando).

**Reenvio (planejado):** mesma `reference`. Só para `pending`, `processing` ou `contingency`. Documento em estado final não envia nada.

**Consulta (pendente):** `GET` com a mesma referência para documentos em `processing`. Job periódico.

**Cancelamento (pendente):** só `authorized`. Exige justificativa, prazo legal e decisão do contador. Transição `authorized → cancelled` já permitida no banco.

**Contingência (pendente):** `contingency` (emissão offline) precisa de transmissão posterior, com prazo a confirmar.

## 5. Estratégia de idempotência

1. **Chave única por documento:** `fiscal_documents.reference` (UUID, `UNIQUE`). É enviada à Focus como `ref`, então reenvios não duplicam nota no provedor.
2. **Compare-and-set:** toda mudança de estado é `UPDATE ... WHERE status = <esperado>`. Dois processos simultâneos: só um envia (teste `dois processos ao mesmo tempo`).
3. **Estados finais não reenviam:** `authorized`, `rejected`, `denied`, `cancelled` devolvem o estado atual sem chamar o provedor.
4. **Trigger no banco** (migration 032) impede transições inválidas mesmo se a aplicação errar.
5. **Retentativa:** erro técnico retentável repete a mesma `reference` com backoff exponencial limitado (1 s, 2 s, 4 s... até 30 s). Rejeição de regra de negócio **nunca** é repetida.

## 6. Conflitos de migration (019, 020, 021) e overload legado

**Situação verificada:**
- `019_invite_hardening` e `019_physical_inventory`; `020_caixa_fechamento_cancelamento` e `020_stock_non_negative_guard`; `021_fix_sale_number_lock` e `021_security_followups`.
- Não é possível confirmar, a partir deste ambiente, quais versões estão registradas no banco remoto **do Venddi**. O projeto `yvdilcmxyjafnnsfdtam` (`jinlong-homolog-palm`), que foi consultado em leitura, tem histórico de migrations com nomes e numeração diferentes e **não é o banco do Venddi**. Ele não foi usado para nenhuma decisão.
- A auditoria anterior (`adc8085`, outra conta) registrou 001–021 no remoto, com 019–021 marcadas como aplicadas e sem as tabelas correspondentes.

**Decisão nesta etapa:**
- **Nenhum arquivo foi renomeado.** Renomear um arquivo já aplicado troca a versão no histórico e quebra o controle de migrations. Como não há como confirmar o que está aplicado, a renomeação seria um palpite.
- Os duplicados ficam **documentados** como bloqueio P0 de reconciliação (seção 8).
- Quando a reconciliação for feita, o caminho recomendado é: (a) comparar `supabase migration list` do remoto com os arquivos; (b) para os não aplicados, renomear com versões novas e ordenadas após 033; (c) para os aplicados, nada muda no arquivo.

**Overload `cancel_sale_with_reversal(UUID, TEXT)` — resolvido (migration 033):**
- A forma de 2 argumentos agora resolve empresa e operador da sessão e **delega** para a de 4 argumentos, que já faz as checagens de empresa, papel, operador, trava de estoque e estorno de caixa. Existe uma só regra.
- A forma de 2 argumentos mantém o contrato antigo: lança erro em recusa (a de 4 argumentos devolve `{"success": false}`).
- Trigger `trg_cancelamento_motivo_minimo` exige motivo com ao menos 5 caracteres em **qualquer** cancelamento, inclusive o da tela. Antes essa regra valia só no cliente.
- Correção acompanhante na 029: a recusa "caixa fechado" passa a valer só para vendas com dinheiro (venda só em cartão/PIX pode ser cancelada com caixa fechado, como esperava o teste de regressão).

## 7. Plano de rollback

- **Edge Function:** não deployada. Rollback = não deployar. Se já deployada: remover a função (`supabase functions delete fiscal-emitir`) e apagar o secret `FOCUS_TOKEN_HOMOLOG`.
- **Migration 032:** reverter com `GRANT ALL` de volta em `fiscal_configurations` e `fiscal_documents` para `authenticated` e `DROP TRIGGER trg_fiscal_transicao_status`. **Não recomendado**: reabre a leitura do token.
- **Migration 033:** reverter restaurando a versão anterior do overload (migration 021) e `DROP TRIGGER trg_cancelamento_motivo_minimo`.
- **Código do cliente:** `emitNfceForSale` continua no modo mock; reverter a guarda só se houver necessidade operacional, o que não é esperado.
- **Dados:** nenhuma migration desta etapa altera dados. Nenhum documento fiscal foi emitido.

## 8. Bloqueios e pendências de decisão

| Item | Quem decide | Bloqueia |
|---|---|---|
| Modelo fiscal (NFC-e 65 ou NF-e 55 por Ajuste SINIEF 23/2026) e venda a CNPJ | Contador | Payload (P5) e qualquer emissão |
| Contratação e autorização do provedor (Focus NFe ou outro) | Proprietário | Homologação (P8) |
| Reconciliação do banco remoto (drift e prefixos 019/020/021) e backup | Proprietário, com autorização | Aplicar 022→033 no remoto |
| Autorização específica de deploy da Edge Function | Proprietário | P9 |
| Autorização específica de testes de homologação com a Focus | Proprietário | P8 |
| Certificado A1 e CSC | Proprietário e contador, com SEFAZ-PE | Produção (fora de escopo) |

## 9. Requisitos de configuração e segurança da Focus (a validar na documentação oficial e em homologação)

- Autenticação: HTTP Basic com o token como usuário e senha vazia (implementado em `focusAdapter.ts`).
- Ambientes: homologação e produção têm hosts distintos (`homologacao.focusnfe.com.br` e `api.focusnfe.com.br`). Esta etapa usa **somente homologação**.
- Idempotência: parâmetro `ref` na URL de envio. Reenvio com a mesma referência não cria nova nota.
- Status de resposta usados pelo mapeamento: `autorizado`, `erro_autorizacao`, `processando_autorizacao`, `denegado`. **Confirmar os nomes exatos** na documentação e no ambiente de homologação antes de qualquer uso.
- Códigos HTTP tratados: 401/403 (credencial, sem retentativa), 409 (referência já enviada, consultar), 400/422 (rejeição, sem retentativa), 429/5xx (retentável).
- Segurança: token só em secret do servidor; nunca em log; rotação prevista se houver suspeita de vazamento.

### 9.1 Empacotamento para o Deno (decisão pendente, P6)

O núcleo em `src/lib/fiscal/` importa módulos sem extensão (`'./core'`), o que o Vite aceita e o Deno não. Para ligar a Edge Function ao núcleo sem duplicar código, há duas opções:
1. Mover `core.ts`, `focusAdapter.ts` e `servidor.ts` para `supabase/functions/_shared/fiscal/` com imports `.ts` explícitos, e apontar os testes para lá.
2. Gerar uma cópia com build (script) antes do deploy.

A opção 1 é a recomendada (uma só fonte). Fica para a etapa P6, junto com o ajuste de `tsconfig`.

## 10. Critérios objetivos de aprovação (para liberar P8)

Todos precisam ser verdadeiros, com evidência anexada:

1. `tsc --noEmit` sem erros e `vitest run` com todos os testes passando, incluindo os de `fiscalCore`, `fiscalFocus` e `fiscalServidor`.
2. Suíte SQL completa (`run_local_db_tests.sh`) com exit 0, incluindo `fiscal_protecao_check.sql`.
3. Edge Function testada em runtime Deno local (`supabase functions serve`) com JWT real de cada papel: caixa recebe 403, gerente recebe 501 até P6, usuário de outra empresa recebe 404.
4. Nenhum log, resposta ou arquivo contém o valor do token (busca por string do secret nos logs de teste).
5. Em homologação da Focus, com CNPJ e CSC de teste: autorização, rejeição, erro técnico e reenvio com mesma referência, cada um com evidência.
6. Contador confirmou o modelo fiscal e a regra de venda a CNPJ por escrito.
7. Proprietário autorizou por escrito o deploy e os testes de homologação.

Até lá: **FISCAL_ENABLED permanece false e produção permanece bloqueada.**

## 11. Resultado da verificação desta etapa

| Verificação | Resultado |
|---|---|
| Testes unitários fiscais (core, focus, servidor) | PASSOU (43 de 43) |
| Typecheck | PASSOU |
| Migrations 001→033 + suíte SQL | ver relatório na mensagem final |
| Edge Function em runtime Deno | NÃO TESTADO (Deno indisponível no ambiente) |
| Homologação com a Focus | NÃO TESTADO (não autorizado; sem credencial) |
| Deploy | NÃO FEITO (não autorizado) |
