# VENDDI — Go-live primeiro cliente (Sprint Go-Live 01)

Data da auditoria: 2026-11-05
Branch: `claude/venddi-sprint-go-live-b99233` (base: `main`)
Escopo: PDV de mercearia/mercadinho em Pernambuco — venda, pagamento, troco, desconto, estoque, caixa, multiempresa, fiscal.

## Resultado final: **NO-GO**

O VENDDI **não está pronto para cliente pagante**. Motivos, em ordem de peso:

1. **Emissão fiscal obrigatória não está ativa.** O módulo NFC-e está congelado (`FISCAL_ENABLED = false`). Para varejo a consumidor em Pernambuco a NFC-e é obrigatória (ver seção Fiscal). Vender hoje sem emitir é risco fiscal direto para o cliente.
2. **Não há validação operacional com Supabase real.** Nenhum teste E2E foi executado contra um projeto Supabase; os testes SQL de RLS/isolamento em `supabase/tests/` não foram rodados (não há banco com o schema de autenticação). Pela regra da missão, isso já impede a declaração de prontidão.
3. **Três correções P0 do PDV e a regra de desconto no banco foram feitas nesta sprint**, mas só validadas localmente (testes unitários, tipos, build e, para o desconto, Postgres descartável). Precisam de teste com leitor e impressora reais e de aplicação no banco de homologação.

O que pode ser considerado **GO CONDICIONAL para piloto controlado** só depois de fechar P0-01 e P0-07 (ver Pendências). Piloto sem NFC-e não é uma opção recomendável.

---

## 1. Funcionalidades concluídas (com evidência)

| Área | Situação | Evidência |
|---|---|---|
| Tipagem (TypeScript) | OK | `npx tsc --noEmit` sem erros |
| Testes unitários | 64/64 passam (53 antes + 11 novos) | `npx vitest run` |
| Build de produção | OK; `admin123` não aparece no bundle | `npx vite build`; busca no `dist/assets` |
| Leitor de código de barras (lógica) | Enter com código exato adiciona o item | `src/lib/pdvHelpers.ts` (`findExactProduct`), testes em `src/lib/__tests__/pdvHelpers.test.ts` |
| Troco em dinheiro (cálculo) | Valor aplicado à venda separado do troco | `applyCashTender`, 6 testes unitários |
| Regra de desconto no banco | 5% máximo e desconto só em dinheiro, por trigger | `supabase/migrations/031_regra_desconto_no_banco.sql`; 6/6 casos em Postgres 16 local |

**Não concluído / não validado:** leitor de código físico, impressora, gaveta, fluxo de caixa completo no navegador (ver seção 3).

## 2. Falhas corrigidas nesta sprint

| ID | Falha (evidência antes da correção) | Correção | Commit |
|---|---|---|---|
| P0-02 | A grade do PDV mostrava 5 produtos fixos (`src/pages/PDVPage.tsx`, ids `'1'`…`'5'`). Esses ids não existem no banco; finalizar a venda falhava. | Catálogo real da empresa (`getProducts`, ativos, até 60 itens). | `9afacb5` |
| P0-03 | Leitor de código de barras: a busca só disparava com debounce de 300 ms e Enter só selecionava se houvesse seta marcada (`selectedIndex = -1` por padrão). Leitura por Enter não adicionava nada. | Enter resolve o código na hora: código/SKU exato, ou resultado único, adiciona; caso contrário mostra a lista. | `9afacb5` |
| P0-04 | Troco inexistente: o botão Dinheiro sempre lançava exatamente o saldo; não havia campo de valor recebido, então troco nunca era calculado. | Campo "Valor recebido em dinheiro"; só o valor aplicado entra no pagamento (e no caixa); troco exibido por pagamento e no total. | `9afacb5` |
| P0-05 | Duplicidade de venda: `idempotencyKey: uuidv4()` a cada clique. Reenvio após falha de rede criava outra venda e baixava o estoque de novo. | Chave mantida na tentativa; renovada quando carrinho ou pagamentos mudam. A RPC já devolve a venda existente para a mesma chave. | `9afacb5` |
| P0-06 | Regra de desconto só no cliente. A RPC `create_atomic_sale` (migration 026, linha 146) aplicava `p_discount` sem limite; era possível dar 100% de desconto ou pagar desconto no cartão por chamada direta. | Triggers `BEFORE INSERT` em `sales` (limite 5%) e `AFTER INSERT` em `payments` (desconto só com dinheiro). Violação desfaz a venda inteira (mesma transação da RPC). | `d2531fb` |

Observação sobre P0-06: a migration 031 **não foi aplicada** em nenhum banco remoto. Aplicação exige autorização do proprietário (ver seção 8).

## 3. Evidências dos testes

### 3.1 Executados e aprovados

- `npx tsc --noEmit`: sem erros.
- `npx vitest run`: 8 arquivos, 64 testes, todos passando.
- `npx vite build`: build concluído.
- **Postgres 16 descartável (Docker local, porta 54329, removido ao final)**:
  - Schema mínimo de `sales` e `payments` criado só para o teste.
  - `031_regra_desconto_no_banco.sql` aplicada sem erro.
  - `supabase/tests/desconto_regra_banco_check.sql`:

  | Caso | Esperado | Obtido |
  |---|---|---|
  | Desconto 5% exato | ok | ok |
  | Desconto 5,01% | erro | erro |
  | Desconto negativo | erro | erro |
  | Desconto + dinheiro | ok | ok |
  | Desconto + cartão | erro | erro |
  | Sem desconto + PIX | ok | ok |

  Mensagem de erro verificada: `Desconto máximo de 5% sem autorização do gerente`.

### 3.2 Tentado, não concluído

- **Smoke test de UI no navegador (modo dev, mock):** o login funcionou. A abertura do caixa pela automação do navegador não ficou confiável (a tela do PDV seguiu em "PDV fechado" e o estado mock se perde a cada recarga). Por isso a tela de venda, o troco e o leitor **não foram conferidos na prática**. Servidor de desenvolvimento encerrado.

### 3.3 Não executado (bloqueado)

- E2E dos 12 cenários da missão (login proprietário/operador, abertura de caixa, venda com dinheiro/PIX/cartão, desconto permitido/bloqueado, cancelamento, estoque, fechamento, isolamento entre empresas, emissão fiscal). **Nenhum foi executado contra Supabase real.** Motivo: não há projeto de homologação disponível nesta sessão e a missão não autoriza alterar o banco de produção.
- Testes SQL de RLS e isolamento existentes (`supabase/tests/` — 19 arquivos `.sql`/`.sh`, incluindo `isolamento_permissoes_vendas.sql` e `rls_isolation_test.sql`): não executados. Precisam de banco com o schema `auth` do Supabase.
- Emissão fiscal em homologação: não disponível (módulo congelado).

## 4. Commits e PRs

**Commits desta sprint (branch `claude/venddi-sprint-go-live-b99233`):**

- `9afacb5` — fix(pdv): catálogo real, leitor de código de barras, troco e idempotência
- `d2531fb` — fix(venda): regra de desconto 5% e pagamento em dinheiro também no banco (migration 031)

**PRs abertos no repositório `nocodenn-cell/Venddi` (não mesclados por esta sprint):**

- [#20 — feat(caixa): operações de caixa transacionais (migration 029)](https://github.com/nocodenn-cell/Venddi/pull/20)
- [#19 — fix(dashboard): painel com dados reais da empresa](https://github.com/nocodenn-cell/Venddi/pull/19)
- [#17 — feat(estoque): inventário físico com conferência e ajuste auditável](https://github.com/nocodenn-cell/Venddi/pull/17)
- [#7 — Finalizar convites de funcionários](https://github.com/nocodenn-cell/Venddi/pull/7)
- [#4 — Fix/tenant security server authority](https://github.com/nocodenn-cell/Venddi/pull/4)
- [#3 — Update from task 9d343526…](https://github.com/nocodenn-cell/Venddi/pull/3)

Atenção: o PR #20 usa o número de migration **029**, que ainda não existe nesta branch. A migration 031 desta sprint deve ser ordenada depois dele. Ver P1-01.

PR desta sprint (aberto, não mesclado): [#21 — Go-live 01](https://github.com/nocodenn-cell/Venddi/pull/21).

## 5. Pendências fiscais (Pernambuco)

### 5.1 O que a pesquisa confirmou

Fontes encontradas nesta sprint (busca estendida; nem todas são oficiais):

- **NFC-e substitui o ECF e o cupom modelo 2** para o varejo. Base citada pela SEFAZ-PE: Decreto 44.650/2017, arts. 147 a 149, e Ajuste SINIEF 19/2016. Fonte: [SEFAZ-PE — NFC-e perguntas e respostas (PDF)](https://www.sefaz.pe.gov.br/Publicacoes/Novo%20regulamento%20ICMS/Informativos%20a%20partir%20de%2001.10.2017/NFC-e%20-%20NOTA%20FISCAL%20CONSUMIDOR%20ELETR%C3%94NICA.pdf).
- **Calendário por CNAE:** Portaria SF nº 192/2017 (primeiro prazo em 01/01/2018), com alteração pela Portaria SF 028/2018. Fonte: [Portaria SF 192/2017](https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Portarias/2017/Port192_2017.htm).
- **Regra geral:** contribuinte que vende a consumidor final não contribuinte do ICMS deve emitir NFC-e a partir de 01/10/2018, salvo exceção legal. Fonte secundária, a ser confirmada pelo contador.
- **ECF:** a SEFAZ-PE não autoriza novos ECFs desde 01/08/2017 (fonte secundária: [GranMoney — NFC-e em PE](https://granmoney.com/nfc-e/pe)).
- **Responsável técnico:** exigência de identificar o responsável técnico do software emissor a partir de 01/08/2019, conforme NT 2018.005 v1.30. Fonte: [COAD — responsável técnico na NFC-e em PE](https://www.coad.com.br/home/noticias-detalhe/94228/pernambuco-informa-sobre-a-obrigatoriedade-de-identificacao-do-responsavel-tecnico-na-nfc-e).
- **Manual técnico:** [Manual da NFC-e (SEFAZ-PE, v6)](https://www.sefaz.pe.gov.br/Servicos/Nota-Fiscal-de-Consumidor-Eletronica/Manual%20da%20Nota%20Fiscal%20de%20Consumidor%20Eletrnica%20%20NFC/Guia%20da%20Nota%20Fiscal%20de%20Consumidor%20Eletr%C3%B4nica%20-%20v6.pdf).

### 5.2 O que não foi confirmado (precisa do contador)

- **TEF para cartão:** uma fonte de fornecedor cita o Decreto 46.087/2018 como exigência de integração TEF. Não foi verificado no diário oficial. Não assumir a exigência até confirmar.
- **NF-e para operações B2B a partir de 2026:** citado em blog, sem comunicado oficial. Não se aplica diretamente ao PDV de varejo, mas precisa de confirmação.
- **Fontes desatualizadas:** páginas que dizem que PE não tem calendário de NFC-e (myRP, AARB) são anteriores à Portaria 192/2017 e não devem ser usadas.
- **Contingência em PE:** prazo para transmitir notas emitidas offline não foi confirmado na legislação estadual.
- **Credenciamento e CSC:** procedimento e canal de geração do CSC no portal da SEFAZ-PE não foram confirmados.

### 5.3 Estado do código fiscal

- Existe `src/lib/services/fiscalService.ts`, `src/lib/services/focusNFeProvider.ts` (com `MockFiscalProvider`) e migrations `009` e `010`. **Não estão validados.** O XML gerado não significa integração pronta.
- O PDV não chama emissão fiscal (`emitNfceForSale` importado, sem uso efetivo; `FISCAL_ENABLED = false`).
- Não há tratamento de rejeição, retransmissão, contingência nem armazenamento seguro de certificado/CSC comprovados.

### 5.4 Arquitetura proposta (para decisão, não implementada)

1. **Tabela `fiscal_documents`** (uma linha por venda, `UNIQUE(company_id, sale_id)`): status `pendente` → `autorizada` | `rejeitada` | `contingencia` | `cancelada`; chave de acesso, protocolo, XML e DANFE-NFC-e guardados; número e série. Idempotência pela chave única.
2. **Emissão assíncrona fora do navegador:** Edge Function que lê `fiscal_documents` pendentes, envia ao provedor/SEFAZ, grava o retorno e reprocessa com backoff. O PDV nunca fala direto com a SEFAZ.
3. **Credenciais no servidor:** certificado A1 e CSC só em secrets da Edge Function (ou cofre do Supabase), nunca no frontend nem em tabela legível por usuário. Logs sem dados do certificado.
4. **Homologação primeiro:** ambiente de homologação da SEFAZ-PE (ou do provedor) com CNPJ de teste; flag por empresa `fiscal_ambiente = homologacao | producao`.
5. **Rejeições:** rejeição de regra de negócio vai para fila de correção do operador; rejeição técnica alerta o proprietário.
6. **Contingência:** venda registrada com status `contingencia` e transmissão posterior; prazo a confirmar com o contador.
7. **Provedor:** escolha entre emissão direta (SEFAZ com certificado próprio) e provedor (Focus NFe já citado no código). Decisão do proprietário, com custo.

## 6. Riscos de segurança

| ID | Risco | Evidência | Situação |
|---|---|---|---|
| S-01 | Isolamento entre empresas nas RPCs de venda/cancelamento | `supabase/migrations/026_isolamento_e_permissoes_vendas.sql`: `create_atomic_sale` e `cancel_sale_with_reversal` comparam empresa e operador com a sessão | Lido, **não executado** (sem banco). Abrir item de teste na seção 3.3. |
| S-02 | Regra de desconto só no cliente | Corrigido por migration 031 (aguarda aplicação) | P0-06 |
| S-03 | Credencial demo no código | `src/lib/services/auth.ts` (`admin123`) só é definida com `import.meta.env.DEV` | Verificado: **ausente do bundle de produção** |
| S-04 | `service_role` no frontend | Busca em `src/`: nenhuma ocorrência | OK |
| S-05 | Segredos commitados | `.env` está no `.gitignore`; busca por chaves em `src/` sem achados; documentos citam só o formato de chaves | OK, sem rotação necessária até a busca completa de histórico |
| S-06 | Dados mock em produção | `products.ts`, `financial.ts`, `cashRegister.ts` têm ramos mock que só rodam sem Supabase; `main.tsx` bloqueia a tela de produção sem configuração | Baixo; limpar (P2-01) |
| S-07 | Dependência de projeto Vercel de terceiros para a landing | `vercel.json` reescreve `/` e `/obrigado` para `landing-jinlong.vercel.app` | Médio; ver P1-07 |
| S-08 | Convites de funcionário e escalada de papel | PR #7 aberto | Pendente de merge e teste |
| S-09 | Isolamento entre tenants em tabelas de caixa/estoque | PRs #17 e #20 abertos com novas RPCs | Pendente de revisão de segurança |

## 7. Dependências externas

- **Supabase:** projeto de produção em plano pago com backup, hoje o projeto está no plano Free (PROXIMOS_PASSOS P1). Custo e recursos do plano: a confirmar pelo proprietário na tabela de preços atual.
- **Domínio `venddipdv.com`** e configuração de Redirect URLs e `APP_URL` no painel do Supabase.
- **SMTP próprio** com domínio validado (convites e recuperação de senha).
- **Certificado digital A1** da empresa (ICP-Brasil, pago, emitido pelo proprietário). Sem ele não há emissão própria.
- **CSC e credenciamento** na SEFAZ-PE, feitos pelo proprietário ou contador.
- **Provedor fiscal**, se escolhido (ex.: Focus NFe): contrato e custo por nota, decisão do proprietário.
- **Contador:** confirmação dos pontos da seção 5.2.
- **Hardware de caixa:** leitor de código de barras (modo teclado), impressora térmica e gaveta. Os módulos existem em `src/lib/hardware/`, mas o PDV não os usa (P1-08).
- **Revisão jurídica:** termos de uso e política de privacidade (LGPD), PROXIMOS_PASSOS P1.

## 8. Autorizações necessárias (ações bloqueadas pela missão)

Para cada item, a ação fica preparada e não foi executada.

| Ação | Autorização necessária | Quem |
|---|---|---|
| Aplicar migrations 029 (PR #20) e 030 no banco de homologação | Confirmação de qual projeto é homologação e aprovação da ordem 028 → 029 → 030 | Proprietário |
| Aplicar migrations em produção | Plano de rollback e janela de manutenção | Proprietário |
| Mesclar os PRs em `main` | Revisão e aprovação do proprietário | Proprietário |
| Ativar `FISCAL_ENABLED` | Homologação fiscal concluída + decisão de provedor | Proprietário e contador |
| Emitir NFC-e de teste em homologação | CNPJ de teste, certificado de homologação e CSC de homologação | Proprietário e contador |
| Emitir NFC-e real | Certificado A1, credenciamento, CSC de produção | Proprietário e contador |
| Contratar plano Supabase Pro, provedor fiscal, SMTP | Aprovação de custo | Proprietário |

## 9. Checklist de instalação (computador de caixa)

**Antes de vender**

- [ ] Projeto Supabase de produção criado (plano definido), URL e anon key configuradas no build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Sem elas o app mostra tela de indisponibilidade.
- [ ] Migrations aplicadas na ordem, após `supabase migration list` para confirmar o histórico (ver P1-01).
- [ ] Redirect URLs e `APP_URL=https://venddipdv.com` no painel do Supabase.
- [ ] SMTP próprio com teste de entrega na caixa de entrada.
- [ ] Usuário proprietário criado, trial de 15 dias ativo.
- [ ] Cadastro da loja: CNPJ, razão social, endereço (NFC-e exige, quando ativa).
- [ ] Funcionários criados por convite; papel de operador testado (não consegue cancelar venda nem abrir caixa com fundo fora da gerência).
- [ ] Produtos cadastrados com código de barras e SKU; estoque inicial lançado.

**No computador de caixa**

- [ ] Navegador em tela cheia, zoom 100%, atalhos testados.
- [ ] Leitor de código de barras em modo teclado: ler um código, conferir que o produto entra com Enter.
- [ ] Impressora térmica: **não ligada ao PDV** (P1-08). Conferência manual até corrigir.
- [ ] Gaveta: não integrada; abrir manualmente.
- [ ] Caixa aberto com fundo de troco; venda de teste com dinheiro com troco; fechamento de caixa conferido.

**Antes de liberar para o cliente**

- [ ] Backup testado: restauração em projeto separado (PROXIMOS_PASSOS P1).
- [ ] Canal de suporte definido (contato, horário, tempo de resposta).
- [ ] Mensagens de erro revisadas com o operador.
- [ ] NFC-e: decisão e homologação concluídas (P0-01).

## 10. Matriz de riscos P0 / P1 / P2

**P0 — Quebrado ou bloqueante para cliente**

| ID | Item | Estado |
|---|---|---|
| P0-01 | NFC-e obrigatória para varejo em PE; módulo fiscal congelado | **Bloqueado** — decisão e homologação do proprietário/contador |
| P0-02 | Grade do PDV com produtos fictícios | Corrigido (`9afacb5`) |
| P0-03 | Leitor de código de barras não adicionava com Enter | Corrigido (`9afacb5`); **falta teste com leitor físico** |
| P0-04 | Troco não calculado e valor recebido não registrado | Corrigido na tela (`9afacb5`); troco não persistido no banco (P1-02) |
| P0-05 | Venda duplicada em reenvio | Corrigido (`9afacb5`); **falta teste de falha de rede real** |
| P0-06 | Regra de desconto só no cliente | Corrigido no banco (`d2531fb`, migration 031); **não aplicado** |
| P0-07 | Sem validação operacional com Supabase real; RLS não executado | **Bloqueado** — precisa de projeto de homologação |

**P1 — Falta para lançar (MVP)**

| ID | Item | Evidência |
|---|---|---|
| P1-01 | Migrations com prefixo duplicado: `020_caixa_fechamento_cancelamento` e `020_stock_non_negative_guard`; `021_fix_sale_number_lock` e `021_security_followups`; salto em 023–025 | `ls supabase/migrations`. **Não renomear** os já aplicados: isso quebra o histórico. Confirmar com `supabase migration list`. |
| P1-02 | Troco não é gravado no banco (`payments` não tem valor recebido nem troco) | `supabase/migrations/003_sales_customers.sql`, tabela `payments` |
| P1-03 | Botões Dinheiro / Cartão / PIX do carrinho sem ação | `src/pages/PDVPage.tsx`, bloco "Finalizar" do carrinho (sem `onClick`) |
| P1-04 | Autorização do gerente para desconto acima de 5% não existe | Trigger da migration 031 bloqueia; sem fluxo de autorização |
| P1-05 | PRs abertos mexem em caixa, estoque e dashboard e não estão na `main`: #17, #19, #20 | Lista de PRs, seção 4 |
| P1-06 | Impressão de cupom não integrada ao PDV | `src/lib/hardware/thermalPrinter.ts` existe; PDV não o usa |
| P1-07 | Landing servida por reescrita para projeto Vercel externo | `vercel.json` |
| P1-08 | Leitor, impressora e gaveta sem teste em hardware real | `src/lib/hardware/` |
| P1-09 | Confirmação de venda usa `alert()` e não mostra o troco no cupom | `src/pages/PDVPage.tsx` |
| P1-10 | Pagamento PIX sem integração (registro manual) | Escopo do PDV; decidir antes do piloto |

**P2 — Melhoria**

| ID | Item |
|---|---|
| P2-01 | Dados mock (`products.ts`, `financial.ts`, `cashRegister.ts`) no bundle de produção; remover em limpeza |
| P2-02 | Sangrias e suprimentos gravam `balance_after = 0` (PROXIMOS_PASSOS P2) |
| P2-03 | Cadastro de funcionário sem convite (PROXIMOS_PASSOS P2) |

## 11. Próximos passos (ordem recomendada)

1. Proprietário escolhe o caminho fiscal (emissão própria ou provedor) e autoriza homologação.
2. Criar projeto Supabase de homologação e aplicar 028 → 029 (PR #20) → 030, depois rodar `supabase/tests/*.sql` e o teste de desconto.
3. Escrever o E2E dos 12 cenários contra esse projeto.
4. Ligar impressão de cupom e conferir leitor físico no computador de caixa.
5. Revisar PRs #17, #19, #20 e mesclar em `main` com aprovação.
6. Reavaliar este documento: GO CONDICIONAL só com P0-01 e P0-07 fechados.
