# Proposta: baixa de estoque concorrente (venda)

Status: implementada como guarda mínima (migration 020). A correção completa na RPC de venda
é o passo seguinte, descrito abaixo.

## Problema reproduzido

Experimento com duas sessões psql, saldo 9, duas baixas de 5 unidades ao mesmo tempo, sem a guarda:

- resultado: saldo final **-1** (oversell). Ambas as transações foram confirmadas.

Causa: a RPC `create_atomic_sale` (migrations 006/008) valida o saldo com
`SELECT stock_quantity FROM products ...` sem lock e depois faz
`UPDATE products SET stock_quantity = stock_quantity - qty WHERE id = ...` sem condição
de saldo. Duas transações leem o mesmo saldo antes de qualquer uma gravar.

## Guarda mínima (implementada, migration 020)

`ALTER TABLE products ADD CONSTRAINT ... CHECK (stock_quantity >= 0)`.

- A segunda baixa espera o lock da linha, reavalia o SET sobre a versão já baixada e viola o CHECK.
- Resultado no experimento: uma baixa confirmada, uma recusada, saldo final 4. Nunca negativo.
- Evidência: `supabase/tests/sale_stock_guard_check.sh`. Regressão: as 10 suites SQL existentes passam.
- Pré-condição: nenhum produto com saldo negativo. A migration recusa aplicar se houver.

Limite: o cliente recebe a mensagem genérica do banco (violação de CHECK), não "estoque insuficiente".

## Correção completa (próximo PR)

1. **Lock e validação na mesma transação.** Trocar o `SELECT` de validação por
   `SELECT ... FOR UPDATE` e validar `stock_quantity >= qty` com erro explícito
   `Estoque insuficiente para <produto>`. Mantém o CHECK como defesa em profundidade.
2. **Ordem de travamento determinística.** Processar os itens do carrinho ordenados por
   `product_id` (também a ordem usada pela conclusão de inventário). Isso elimina o deadlock
   cruzado descrito abaixo.
3. **Testes**: concorrência com duas sessões (mesmo produto), carrinho com dois produtos
   em ordens opostas (sem deadlock), e cancelamento de venda concorrente com venda.

## Risco de deadlock (medido)

Experimento: venda com itens na ordem P2→P1 contra conclusão de inventário (que trava por
`product_id`, P1→P2).

- resultado: **`deadlock detected`** na conclusão. A venda foi confirmada. Os saldos ficaram
  consistentes (P1=3, P2=9) e nenhum ajuste parcial foi aplicado. O inventário continuou em
  `counting` e pode ser concluído de novo.
- Conclusão: deadlock aborta uma transação inteira (sem dano parcial), mas gera erro para o
  usuário. Corrigir pela ordenação do item 2 acima.

## Fora deste PR

Alterar `create_atomic_sale`, `cancel_sale_with_reversal` e a tela de vendas. Foram deixados
para o PR da correção completa, para manter esta mudança pequena e revisável.
