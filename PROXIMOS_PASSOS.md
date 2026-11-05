# Próximos passos — Venddi

## P0 — Quebrado/travado

- Reconciliar o drift do remoto (auditoria adc8085: 019–021 registradas sem tabelas/triggers) antes de aplicar 022→032. Só com backup e autorização do proprietário.
- Emissão fiscal: confirmar com o contador a regra de modelo (NFC-e 65 ou NF-e 55 por Ajuste SINIEF 23/2026) e a venda a CNPJ; depois Edge Function com token em secret. Ver docs/GO_LIVE_02.md, seção 3.
- E2E de interface com stack Supabase completo (hoje a validação é de banco, em Postgres local).
- Remover o caminho morto de emissão no cliente (focusNFeProvider.ts, fiscalService.ts) quando a Edge Function existir.
- Migrations 026–030 ainda não estão no projeto remoto de homologação. Aplicar só com backup e pelo roteiro de `docs/PROCEDIMENTO_MIGRATIONS_HOMOLOGACAO.md`.

## P1 — Falta para lançar (MVP)

- Executar o roteiro de caixa (`docs/CAIXA_TRANSACIONAL.md`, seção 5) no projeto remoto de homologação.
- Teste de interface para duplo clique em sangria e para dois caixas simultâneos (CX-29, CX-30).
- Produtos fracionados: quantidade é inteira no banco e na tela (PDV-04). Decidir se entra no escopo do MVP.
- Gravar valor recebido e troco em `payments`, se o troco precisar de auditoria (ver `docs/CAIXA_TRANSACIONAL.md`, seção 8).
- Homologar a migration 019 (inventário físico) e executar o roteiro de `docs/INVENTARIO_FISICO.md`, seção 5.
- E2E automatizado de navegador (Playwright) para inventário e caixa.
- Paginação e busca no servidor para inventários com catálogo grande.

## P2 — Melhoria

- Histórico de inventários com autor e ajustes detalhados na própria tela.
- Registrar vendas também em `cash_operation_log` (hoje a auditoria de venda fica em `sales`).
- Mostrar o nome do operador ao recarregar o caixa (o banco não traz o nome; a tela usa o usuário logado).

## Feito

- 2026-11-05 — Integração PR #20 + PR #21 em `integracao/go-live-02`; cadeia de migrations 001→032 sobe num banco limpo; cancelamento pela tela corrigido; golden flow e reenvio concorrente testados; camada fiscal com proteção de credenciais (032).
- 2026-11-03 — Tela de Vendas com histórico e cancelamento pela interface (dono, admin e gerente); corrigido o operador fixo e a mensagem genérica da API de cancelamento
- 2026-11-03 — Validação operacional do PDV e do caixa: desconto, pagamento dividido, troco e chave de venda corrigidos; estorno com sinal negativo; detalhamento por meio de pagamento; jornada completa pela interface conferida no banco (migration 030 e testes de integridade)
- 2026-11-03 — Segurança: políticas de escrita direta em vendas, pagamentos, itens, auditoria e caixa removidas (migration 030)
- 2026-11-03 — PDV: grade de produtos carrega produtos reais do banco (antes era lista fixa com ids inválidos); venda pela grade verificada no banco (CX-31)
- 2026-11-03 — Caixa transacional: RPCs de abertura, sangria, suprimento e fechamento com idempotência, log imutável, trava de status e de caixa fechado (migration 029); testes SQL, concorrência e E2E
- 2026-11-03 — Venda e estorno travam o caixa antes dos produtos (ordem de travas, migrations 028 e 029)
- 2026-11-03 — Inventário físico: migration 019 (contagem, conclusão idempotente, ajuste auditável, RLS), tela Estoque e testes unit, banco e concorrência (#16)
- 2026-11-03 — Venda e estoque: guarda de saldo, `FOR NO KEY UPDATE` na numeração, isolamento e permissões de venda e cancelamento (migrations 020–026)
- 2026-11-03 — Painel com métricas reais e filtro de estoque baixo no servidor (migrations 023–025)
