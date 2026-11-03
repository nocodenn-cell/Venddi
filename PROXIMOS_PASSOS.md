# Próximos passos — Venddi

## P0 — Quebrado/travado

- PDV: a grade de produtos usa lista fixa (ids `'1'`..`'5'`), não produtos do banco. Venda pela grade não é segura até trocar por `getProducts` (`docs/CAIXA_TRANSACIONAL.md`, CX-31).
- Migrations 026–029 ainda não estão no projeto remoto de homologação. Aplicar só com backup e pelo roteiro de `docs/PROCEDIMENTO_MIGRATIONS_HOMOLOGACAO.md`.

## P1 — Falta para lançar (MVP)

- Executar o roteiro de caixa (`docs/CAIXA_TRANSACIONAL.md`, seção 5) no projeto remoto de homologação.
- Teste de interface para duplo clique em sangria e para dois caixas simultâneos (CX-29, CX-30).
- Homologar a migration 019 (inventário físico) e executar o roteiro de `docs/INVENTARIO_FISICO.md`, seção 5.
- E2E automatizado de navegador (Playwright) para inventário e caixa.
- Paginação e busca no servidor para inventários com catálogo grande.

## P2 — Melhoria

- Histórico de inventários com autor e ajustes detalhados na própria tela.
- Registrar vendas também em `cash_operation_log` (hoje a auditoria de venda fica em `sales`).
- Mostrar o nome do operador ao recarregar o caixa (o banco não traz o nome; a tela usa o usuário logado).

## Feito

- 2026-11-03 — Caixa transacional: RPCs de abertura, sangria, suprimento e fechamento com idempotência, log imutável, trava de status e de caixa fechado (migration 029); testes SQL, concorrência e E2E
- 2026-11-03 — Venda e estorno travam o caixa antes dos produtos (ordem de travas, migrations 028 e 029)
- 2026-11-03 — Inventário físico: migration 019 (contagem, conclusão idempotente, ajuste auditável, RLS), tela Estoque e testes unit, banco e concorrência (#16)
- 2026-11-03 — Venda e estoque: guarda de saldo, `FOR NO KEY UPDATE` na numeração, isolamento e permissões de venda e cancelamento (migrations 020–026)
- 2026-11-03 — Painel com métricas reais e filtro de estoque baixo no servidor (migrations 023–025)
