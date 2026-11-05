# Próximos passos — Venddi

## P0 — Quebrado/travado

- Emissão NFC-e obrigatória para varejo a consumidor em PE: módulo fiscal segue congelado (`FISCAL_ENABLED = false`). Decidir caminho (emissão própria ou provedor) e homologar com o contador. Ver `docs/GO_LIVE_PRIMEIRO_CLIENTE.md` seção 5.
- Sem validação operacional com Supabase real: rodar os 12 cenários da missão e os testes em `supabase/tests/` num projeto de homologação (RLS e isolamento entre empresas ainda não executados).
- Aplicar em homologação, nesta ordem: 028 → 029 (PR #20) → 030 (`030_regra_desconto_no_banco.sql`). Antes, conferir `supabase migration list` (ver P1 sobre prefixos duplicados).
- Testar no computador de caixa com leitor físico: leitura por Enter, reenvio após queda de rede (não pode duplicar venda).
- Validar em uso real o convite de funcionário (convidar, abrir o link, definir senha, entrar) — depende de SMTP configurado e do link `/convite` no domínio de produção.
- Confirmar `APP_URL` = `https://venddipdv.com` e as Redirect URLs no painel do Supabase.
- Publicar o app em `venddipdv.com`: `/convite` respondia 404.
- Verificar a checagem pendente do PR #6 (estado UNSTABLE no GitHub).

## P1 — Falta para lançar (MVP)

- Migrations 020 e 021 com prefixo duplicado (`020_caixa_fechamento_cancelamento` / `020_stock_non_negative_guard`, `021_fix_sale_number_lock` / `021_security_followups`), e salto em 023–025. Não renomear os já aplicados; confirmar o histórico antes de qualquer `db push`.
- Troco não gravado no banco: `payments` não guarda valor recebido nem troco (o caixa já recebe só o valor aplicado).
- Botões Dinheiro / Cartão / PIX do carrinho sem ação (`PDVPage.tsx`).
- Autorização do gerente para desconto acima de 5% (hoje o banco recusa; falta o fluxo de autorização).
- Integrar impressão de cupom ao PDV (`src/lib/hardware/thermalPrinter.ts` existe, não é usado). Gaveta e leitor sem teste em hardware real.
- Mesclar ou fechar PRs abertos que mexem em caixa, estoque e dashboard: #17, #19, #20.
- Landing servida por reescrita do `vercel.json` para projeto externo (`landing-jinlong.vercel.app`): definir dono e migrar para o domínio próprio.
- SMTP próprio com domínio validado e teste real de entrega (caixa de entrada, não spam).
- Backup e restauração testados; projeto de produção em plano pago (o atual está no plano Free).
- Revisão jurídica dos termos e da política de privacidade (LGPD).
- Cobrança manual do piloto combinada por escrito (não há integração de pagamento).
- Teste ponta a ponta com o app real: cadastro, login, venda, fechamento de caixa e relatório.
- Texto de trial de 15 dias conferido na landing nova (`landing/`, Next.js).

## P2 — Melhoria

- Remover dados mock do bundle de produção (`products.ts`, `financial.ts`, `cashRegister.ts`); hoje só rodam sem Supabase, então estão inertes.
- Sangrias e suprimentos gravam `balance_after = 0` no cliente; o histórico de saldo fica incompleto (o fechamento não é afetado).
- Cadastro de funcionário sem convite (hoje o convite é o único caminho).
- Retomar BI (módulo escolhido para a próxima sprint depois do caixa).
- Módulo de estoque com inventário e ajustes auditáveis (roadmap P0 ainda aberto; PR #17).

## Feito

- 2026-11-05 — Regra de desconto (5% e só em dinheiro) no banco, migration 030, testada em Postgres local com 6/6 casos (`d2531fb`).
- 2026-11-05 — PDV: catálogo real no lugar de produtos fictícios, leitor de código com Enter, troco em dinheiro e chave de idempotência por tentativa (`9afacb5`).
- 2026-10-21 — Migration 021 aplicada no Supabase e Edge Function `invite-employee` publicada (versão 4).
- 2026-10-21 — Sprint do caixa: fechamento por caixa/período e cancelamento de venda com auditoria (PR #8).
- 2026-10-21 — Convites de funcionários: reenvio, cancelamento, status e bloqueio de escalada (PR #7).
- 2026-10-21 — Central de Funcionários com comissão e desconto de 5% em dinheiro no PDV.
- 2026-10-21 — PDV fechado por padrão; início é a tela pós-login.
- 2026-10-21 — Trial de 15 dias com expiração no banco e no login; entrada de estoque.
- 2026-10-21 — Correções de segurança apontadas nos PRs #6 e #8 (migrations 014 a 021).
- 2026-10-29 — Merge de `main` resolvido nos PRs #6, #7 e #8 (landing antiga removida no SPA).
