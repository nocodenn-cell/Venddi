# Homologação local — inventário físico (#17) e proteção de estoque (#18)

Data: 2026-11-03. Ambiente: **Supabase CLI local** (Docker), PostgreSQL 17.11, portas 59320–59329.
Nenhuma escrita remota. Nenhum projeto Supabase de produção foi acessado. Sem merge e sem deploy.

Branches usadas:
- `claude/venddi-physical-inventory-b9599c` (PR #17): inventário físico.
- `fix/venda-baixa-estoque-concorrente` (PR #18): guarda de saldo (020), correções da venda (021, 022) e teste de regressão.
- `validacao/homolog-local`: local, combina os dois (017 → 018 → 019 → 020 → 021 → 022). Não enviada ao remoto.

Dependência: 019 (PR #17) e 020–022 (PR #18) são independentes entre si, mas o fluxo "venda durante inventário" só funciona com as correções de venda (021, 022).

## 1. Matriz de testes

Legenda: PASSOU · FALHOU · NÃO TESTADO. Quando um item foi exercitado só na camada do banco (RPC), a coluna "Camada" diz isso.

### Etapa 3 — fluxos (UI = navegador; RPC = chamada real ao banco como o usuário)

| # | Teste | Camada | Resultado | Evidência |
|---|---|---|---|---|
| 1 | Login owner (Loja A) | UI | PASSOU | Entra em `/app/inicio`, menu completo |
| 2 | Login gerente (Loja A) | UI | PASSOU | Vê Estoque e o histórico de inventários |
| 3 | Login operador/caixa (Loja A) | UI | PASSOU | Sem item "Estoque" no menu |
| 4 | Login owner (Loja B) | UI | PASSOU | Entra em `/app/estoque` e `/app/produtos` |
| 5 | Iniciar inventário (só ativos) | UI | PASSOU | "Inventário Homologação A": 3 produtos; o inativo (Meia) fica de fora |
| 6 | Contagem de produtos | UI | PASSOU | Contados 3 / pendentes 0 |
| 7 | Contagem zero | UI | PASSOU | Boné contado 0 → "Falta 1" |
| 8 | Falta | UI | PASSOU | Camiseta 8 → "Falta 2" |
| 9 | Sobra | UI | PASSOU | "Inventário Sobra": Camiseta 4 (sistema 3) e Calça 6 (sistema 5) → "Sobra 1" em ambas |
| 10 | Sem divergência | UI | PASSOU | Calça 5 = sistema 5 |
| 11 | Salvar e retomar | UI | PASSOU | Recarregou a página; contagens e resumo mantidos |
| 12 | Atualizar contagem | UI | PASSOU | Camiseta 8 → 7: "Falta 3" |
| 13 | Venda durante inventário | RPC | PASSOU | `create_atomic_sale` de 2 Camisetas enquanto o inventário estava aberto (venda #1, R$ 40,00) |
| 14 | Entrada durante inventário | RPC | PASSOU | `registrar_entrada_estoque` de 4 Bonés como gerente |
| 15 | Conclusão e auditoria | UI + banco | PASSOU | Dois movimentos `adjustment` com motivo "Inventário: …" e `balance_after` |
| 16 | Cancelamento de inventário | UI | PASSOU | Status "cancelado", saldos inalterados, nenhum movimento novo |
| 17 | Conclusão repetida (idempotência) | RPC | PASSOU | Segunda conclusão: `already_completed = true`, sem movimento novo |
| 18 | Outra empresa não vê dados | UI + banco | PASSOU | Owner B vê só "Produto Outra Loja" e só o próprio inventário; RLS retorna 0 linhas da Loja A |
| 19 | Outra empresa não age sobre inventário alheio | RPC | PASSOU | `registrar_contagem_item`/`concluir`/`cancelar` → "Inventário não encontrado nesta empresa" |
| 20 | Operador sem permissão (UI) | UI | PASSOU | `/app/estoque` redireciona para `/app/inicio` |
| 21 | Operador sem permissão (RPC) | RPC | PASSOU | As 4 RPCs de inventário → "Papel sem permissão para realizar inventário" |
| 22 | Venda pelo PDV (tela) durante inventário | UI | NÃO TESTADO | A venda foi feita pela RPC, não pela tela do PDV |
| 23 | Entrada pela tela de Produtos | UI | NÃO TESTADO | A entrada foi feita pela RPC |

### Etapa 4 — concorrência (duas sessões reais no banco)

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| C1 | Duas vendas simultâneas no último estoque, **com** guarda (020) | PASSOU | Saldo 4, venda A de 3 confirmada, venda B recusada: `violates check constraint`. Saldo final 1 |
| C1b | Mesmo cenário, **sem** guarda | FALHOU (defeito reproduzido) | Ambas confirmadas. Saldo final **−2** (oversell). Guarda restaurada depois |
| C2 | Venda simultânea à conclusão do inventário | PASSOU | Venda de 2 Camisetas segura a linha; conclusão aguarda. Saldos: Camiseta 3, Calça 4, Bonés 1 |
| C3 | Duas conclusões simultâneas do mesmo inventário | PASSOU | Uma aplicou o ajuste (`already_completed = false`), a outra é idempotente (`true`). 1 movimento. Saldo 5 |
| C4 | Entrada simultânea à conclusão | PASSOU | Entrada de 3 Calças aguarda; conclusão aplica diferença −1 sobre o saldo atual. Saldo final 6 |

### Correções de venda (encontradas na homologação)

| # | Teste | Antes | Depois |
|---|---|---|---|
| V1 | Venda com dinheiro via `create_atomic_sale` | FALHOU: `FOR UPDATE is not allowed with aggregate functions` | PASSOU (021, parte 1) |
| V2 | Mesma venda, após V1 | FALHOU: `null value in column "user_id" of relation "cash_movements"` | PASSOU (021, parte 2) |
| V3 | Estorno de venda via `cancel_sale_with_reversal` | FALHOU: mesmo erro de `user_id` | PASSOU (022). Venda `cancelled`, Camiseta 4 → 6, estorno de caixa com `user_id` |
| V4 | Regressão das vendas | — | `sale_rpc_regression_check.sql`: PASSOU (venda, saldo 10 → 8, estorno, saldo 8 → 10) |

## 2. Saldos antes e depois

**Inventário "Homologação A"** (Loja A)

| Produto | Antes | Contagem | Movimento na janela | Ajuste | Depois |
|---|---|---|---|---|---|
| Camiseta (CAM-001) | 10 | 7 (falta 3) | venda −2 → 8 | −3 → 5 | **5** |
| Calça (CAL-002) | 5 | 5 (sem div.) | — | 0 | **5** |
| Boné (BON-004) | 1 | 0 (falta 1) | entrada +4 → 5 | −1 → 4 | **4** |

Movimentos gerados (`stock_movements`):
- `BON-004 in +4 → 5` (entry, "Reposicao durante inventario")
- `CAM-001 out −2 → 8` (sale, "Venda #1")
- `CAM-001 adjustment −3 → 5` (inventory_count, "Inventário: Inventário Homologação A (contado 7, sistema 10)")
- `BON-004 adjustment −1 → 4` (inventory_count, "Inventário: Inventário Homologação A (contado 0, sistema 1)")

**Cenários de concorrência** (saldos antes → depois)

| Cenário | Antes | Depois | Movimentos de ajuste |
|---|---|---|---|
| C1 (com guarda) | Bonés 4 | Bonés 1 | 2 vendas, 1 recusada |
| C1b (sem guarda) | Bonés 4 | **−2** | — |
| C2 | CAM 5, CAL 5, BON 1 | CAM 3, CAL 4, BON 1 | CAL −1 → 4 |
| C3 | CAL 6 | CAL 5 | CAL −1 → 5 (1 só) |
| C4 | CAL 4 (+3 entrada) | CAL 6 | CAL −1 → 6 (entrada +3 → 7 antes do ajuste) |

**Inventário "Sobra"** (Gerente): CAM 3 → 4 (+1), CAL 5 → 6 (+1), BON 1 → 1.

**Cancelamento**: "Inventário Cancelamento" → saldos inalterados e nenhum movimento novo.

## 3. Erros encontrados

| # | Gravidade | Descrição | Situação |
|---|---|---|---|
| E1 | P0 | `create_atomic_sale` (migration 008, `main`) falha sempre: `SELECT MAX(...) ... FOR UPDATE` com agregado. Toda venda falhava. | **Corrigido** no PR #18 (021). Não consegui confirmar se a produção usa essa definição; ver riscos |
| E2 | P0 | Venda com dinheiro: `cash_movements.user_id` NOT NULL não preenchido. Toda venda com caixa falhava. | **Corrigido** no PR #18 (021) |
| E3 | P0 | Estorno de venda: mesmo problema de `user_id`. Estorno nunca funcionava. | **Corrigido** no PR #18 (022) |
| E4 | P0 | Oversell: duas vendas no último estoque deixam saldo negativo (−2 reproduzido). | **Corrigido** no PR #18 (020, CHECK). Testado (C1, C1b) |
| E5 | P1 | Dashboard `/app/inicio` mostra números fixos de exemplo (Maria Silva, R$ 2.450,00, "Estoque baixo: 5", "Pedidos Hoje: 12") que não vêm do banco. Só o gráfico e "Total de Vendas" refletem dados reais. | **Não corrigido.** Fora do escopo; precisa de decisão de produto |
| E6 | P1 | Quando a guarda recusa uma venda, o operador recebe a mensagem técnica do banco (`new row for relation "products" violates check constraint`). | **Não corrigido.** Recomendo mapear para "Estoque insuficiente" no RPC (ver proposta, PR #18) |
| E7 | P2 | Após uma venda concorrente, a lista e o modal de conclusão mostram "saldo atual" antigo até recarregar a página. O ajuste aplicado está correto. | Não corrigido (UX) |
| E8 | P2 | Botão "Sair" fica fora da área visível da barra lateral em telas de até ~870 px de altura; sem atalho óbvio para encerrar a sessão. Usei teclado para sair. | Não corrigido (UX) |
| E9 | P2 | Tour de boas-vindas reaparece a cada carregamento em algumas navegações. | Não corrigido (UX) |

Observação: durante os testes criei um inventário de teste na Loja B (`x`, por um teste de permissão meu, não por defeito do sistema). Foi cancelado ao final e não gerou movimento.

## 4. Riscos que continuam

1. **Só ambiente local.** Os resultados são do Supabase CLI local (PostgreSQL 17.11). Produção pode ter outra versão, outros dados, outros grants ou outra definição da RPC de venda.
2. **Produção pode estar com a RPC quebrada (E1, E2, E3).** Se a produção usa a definição da migration 008 do `main`, nenhuma venda com caixa e nenhum estorno funcionam lá. Verificar em modo leitura (sem escrita) antes de qualquer deploy: `select pg_get_functiondef('create_atomic_sale'::regproc)` e checar se contém `FOR UPDATE` após `MAX(`.
3. **Migration 020 exige saldo não negativo.** Se houver produto com saldo negativo, a migration recusa. Checar antes: `select count(*) from products where stock_quantity < 0`.
4. **Venda pela tela do PDV** e **entrada pela tela de Produtos** durante o inventário não foram testadas pela interface (C2 e C4 usaram as RPCs reais).
5. **Concorrência real de navegador** não foi testada (duas abas). A concorrência foi validada com duas sessões no banco.
6. **E5 (dados de exemplo no dashboard)** pode confundir o comerciante sobre o estoque e as vendas.
7. **Deadlock venda × conclusão** foi medido antes (ver `docs/INVENTARIO_FISICO.md`). Não reapareceu nos cenários desta rodada, mas segue possível pela ordem de travamento.

## 5. Recomendação

**Ordem sugerida:** PR #18 primeiro (corrige a venda e traz a guarda), depois PR #17 (inventário).

- **PR #18 (proteção de estoque e correções de venda): GO para revisão e merge, após checagem de saldo negativo e da definição da RPC em produção.** Corrige três defeitos P0 que impedem qualquer venda com caixa e qualquer estorno, e impede oversell.
- **PR #17 (inventário físico): GO para merge, depois do PR #18.** Todos os fluxos críticos do inventário passaram localmente (contagem, zero, falta, sobra, salvar/retomar, atualizar, venda e entrada durante a contagem, conclusão idempotente, cancelamento, isolamento entre empresas, permissões). A parte de venda só funciona com o PR #18.
- **Produção: NO-GO por enquanto.** Antes de qualquer deploy: (a) validar o PR #18 e o PR #17 em um ambiente remoto de homologação; (b) confirmar em produção (somente leitura) a definição de `create_atomic_sale` e a ausência de saldo negativo; (c) decidir sobre os dados de exemplo do dashboard (E5).

Sem merge, sem deploy e sem escrita remota nesta rodada.
