# Próximos passos — Venddi

## P0 — Quebrado/travado

- Race condition na venda: a RPC de venda valida saldo com `SELECT` sem lock e faz `UPDATE` sem `WHERE stock_quantity >= qty`; duas vendas simultâneas podem deixar saldo negativo (identificado por leitura de código, não reproduzido).

## P1 — Falta para lançar (MVP)

- Homologar a migration 019 (inventário físico) em projeto Supabase de homologação e executar o roteiro de `docs/INVENTARIO_FISICO.md` seção 5.
- E2E automatizado de navegador (Playwright) para o inventário, com usuários de teste em homologação.
- Paginação/busca no servidor para inventários com catálogo grande.

## P2 — Melhoria

- Histórico de inventários com autor e ajustes detalhados na própria tela.
- Deadlock possível entre conclusão de inventário e venda (ordem de travamento diferente); avaliar ordenação consistente na venda.

## Feito

- 2026-11-03 — Inventário físico: migration 019 (contagem, conclusão idempotente, ajuste auditável, RLS), tela Estoque e testes unit/banco/concorrência (#16)
