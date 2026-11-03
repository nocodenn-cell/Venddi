# Próximos passos — Venddi

## P0 — Quebrado/travado

- Oversell na venda: duas vendas simultâneas deixaram saldo -1 (reproduzido). Guarda mínima em PR #18 (`CHECK stock_quantity >= 0`, migration 020); falta a correção completa da RPC (`FOR UPDATE`, mensagem "Estoque insuficiente", ordenação por `product_id`). Aplicar a guarda só após checar saldos negativos.
- Deadlock venda × conclusão de inventário (reproduzido): o banco aborta uma das transações; a correção é a ordenação da RPC de venda (mesmo PR de cima).

## P1 — Falta para lançar (MVP)

- Homologar a migration 019 (inventário físico) em projeto Supabase de homologação e executar o roteiro de `docs/INVENTARIO_FISICO.md` seção 5.
- E2E automatizado de navegador (Playwright) para o inventário, com usuários de teste em homologação.
- Paginação/busca no servidor para inventários com catálogo grande.

## P2 — Melhoria

- Histórico de inventários com autor e ajustes detalhados na própria tela.
- Deadlock possível entre conclusão de inventário e venda (ordem de travamento diferente); avaliar ordenação consistente na venda.

## Feito

- 2026-11-03 — Inventário físico: migration 019 (contagem, conclusão idempotente, ajuste auditável, RLS), tela Estoque e testes unit/banco/concorrência (#16)
