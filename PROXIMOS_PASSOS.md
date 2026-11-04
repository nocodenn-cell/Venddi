# Próximos passos — Venddi

## P0 — Quebrado/travado

- Aplicar a migration 021 no Supabase: já feito em 2026-10-21 (ver Feito). Confirmar com `npx supabase migration list`.
- Validar em uso real o convite de funcionário (convidar, abrir o link, definir senha, entrar) — depende de SMTP configurado e do link `/convite` no domínio de produção.
- Confirmar `APP_URL` = `https://venddipdv.com` e as Redirect URLs no painel do Supabase.
- Publicar o app em `venddipdv.com`: `/convite` respondia 404.
- Verificar a checagem pendente do PR #6 (estado UNSTABLE no GitHub).

## P1 — Falta para lançar (MVP)

- SMTP próprio com domínio validado e teste real de entrega (caixa de entrada, não spam).
- Backup e restauração testados; projeto de produção no plano Pro (o projeto atual está no plano Free).
- Revisão jurídica dos termos e da política de privacidade (LGPD).
- Cobrança manual do piloto combinada por escrito (não há integração de pagamento).
- Teste ponta a ponta com o app real: cadastro, login, venda, fechamento de caixa e relatório.
- Autorização do gerente para desconto acima de 5% (hoje o banco recusa).
- Texto de trial de 15 dias conferido na landing nova (`landing/`, Next.js).

## P2 — Melhoria

- Sangrias e suprimentos gravam `balance_after = 0` no cliente; o histórico de saldo fica incompleto (o fechamento não é afetado).
- Cadastro de funcionário sem convite (hoje o convite é o único caminho).
- Retomar BI (módulo escolhido para a próxima sprint depois do caixa).
- Módulo de estoque com inventário e ajustes auditáveis (roadmap P0 ainda aberto).

## Feito

- 2026-10-21 — Migration 021 aplicada no Supabase e Edge Function `invite-employee` publicada (versão 4).
- 2026-10-21 — Sprint do caixa: fechamento por caixa/período e cancelamento de venda com auditoria (PR #8).
- 2026-10-21 — Convites de funcionários: reenvio, cancelamento, status e bloqueio de escalada (PR #7).
- 2026-10-21 — Central de Funcionários com comissão e desconto de 5% em dinheiro no PDV.
- 2026-10-21 — PDV fechado por padrão; início é a tela pós-login.
- 2026-10-21 — Trial de 15 dias com expiração no banco e no login; entrada de estoque.
- 2026-10-21 — Correções de segurança apontadas nos PRs #6 e #8 (migrations 014 a 021).
- 2026-10-29 — Merge de `main` resolvido nos PRs #6, #7 e #8 (landing antiga removida no SPA).
