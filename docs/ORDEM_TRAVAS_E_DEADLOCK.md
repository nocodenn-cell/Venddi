# Ordem de travas e deadlock — operações de venda, estoque e inventário

Objetivo: garantir que nenhum par de operações concorrentes possa formar um ciclo de espera.
Regra adotada: toda operação que trava produtos o faz por `product_id` crescente, e a trava da
empresa é `FOR NO KEY UPDATE` (não conflita com a checagem de chave estrangeira, que pede `KEY SHARE`).

## 1. Ordem de travas por operação (versão atual, migrations 021/026/028)

| Operação | Ordem |
|---|---|
| Venda (`create_atomic_sale`) | 1. `companies` `FOR NO KEY UPDATE` (serializa numeração e vendas da empresa); 2. `products` por `product_id` crescente (UPDATE); 3. inserts (sales, sale_items, payments, cash_movements), com `KEY SHARE` nas chaves estrangeiras |
| Estorno (`cancel_sale_with_reversal`) | 1. `sales` (UPDATE); 2. `products` por `product_id` crescente; 3. insert em cash_movements |
| Conclusão de inventário (`concluir_inventario`) | 1. `inventory_counts` `FOR UPDATE`; 2. `products` por `product_id` crescente; 3. inserts em stock_movements |
| Registrar contagem (`registrar_contagem_item`) | 1. `inventory_counts` `FOR SHARE`; 2. `products` `FOR UPDATE` (um produto) |
| Entrada de estoque (`registrar_entrada_estoque`) | 1. `products` (UPDATE, um produto); 2. insert em stock_movements, com `KEY SHARE` na empresa e no produto |
| Iniciar inventário | Inserts em inventory_counts e items (`KEY SHARE` nas chaves estrangeiras) |

## 2. Análise dos pares (qualquer par que trave o mesmo recurso)

| Par | Análise | Resultado |
|---|---|---|
| Venda × Venda | Ambas tomam `NO KEY UPDATE` na empresa como primeiro passo: serializam | Sem ciclo |
| Venda × Entrada | Entrada segura produto P e depois pede `KEY SHARE` na empresa. Venda segura `NO KEY UPDATE` na empresa, que é compatível com `KEY SHARE`; a entrada não espera a venda pela empresa | Sem ciclo. Medido com RPC real: concluem, saldo 19 |
| Venda × Conclusão | Ambas travam produtos por `product_id` crescente. Sem ordem inversa, não há ciclo | Sem ciclo. Medido: 40 rodadas, 0 deadlock (com 028); 2 deadlocks em 40 (sem 028) |
| Venda × Estorno | Ambas travam produtos por `product_id` crescente. A venda trava a empresa antes, o estorno não | Sem ciclo |
| Estorno × Conclusão | Ambas por `product_id` crescente | Sem ciclo |
| Conclusão × Entrada | Conclusão trava produtos em ordem; a entrada trava um produto e depois só pede `KEY SHARE` (livre) | Sem ciclo |
| Registrar contagem × Conclusão | Registrar pede `FOR SHARE` no inventário; conclusão pede `FOR UPDATE` nele. Quem chega primeiro bloqueia o outro antes de travar produtos | Sem ciclo |
| Entrada × Entrada (mesmo produto) | Um produto por transação, serializam | Sem ciclo |

## 3. O que foi reproduzido antes desta correção

- Deadlock venda × entrada com `FOR UPDATE` na empresa: `concorrencia_chave_estrangeira.sh "FOR UPDATE"`
  dá `deadlock detected` na entrada. Com `FOR NO KEY UPDATE` passa.
- Deadlock venda × conclusão com ordem do carrinho (P2,P1): medido em 2 de 40 rodadas sem 028, 0 de 40 com 028.
  Na versão sem 028 há também um efeito secundário: a conclusão abortada deixa o inventário em
  conferência, e as rodadas seguintes falham ao abrir outro (o script registra isso separadamente).
  O operador vê o inventário ainda em andamento e pode concluir de novo.

## 4. Limites e riscos residuais

- A análise cobre as operações desta versão. Operação futura que trave produtos fora de ordem reintroduz o risco.
  Regra para revisão: travar produtos sempre por `product_id` crescente.
- O estresse mede 40 rodadas. Não é prova formal de ausência de deadlock; é evidência de que a ordem é respeitada na prática.
- Testes com o Postgres local (17). A ordem é uma propriedade do código, não da versão, mas a
  homologação remota deve repetir `bash supabase/tests/stress_venda_inventario.sh`.
