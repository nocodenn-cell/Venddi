# Próximos passos — Venddi

## P0 — Quebrado/travado

- Projeto remoto `jcvblxyzceszzehehyjd` está INACTIVE (pausado, visto em 2026-11-14). Bloqueia a reconciliação do schema e pode deixar o app de produção fora do ar. Reativação é ação do dono no painel do Supabase.
- Main não monta banco do zero: migration 022 falha (GRANT sem assinatura ambígua, `cancel_sale_with_reversal`); a go-live corrige com assinatura explícita em 022/026/028/029 e com a 033.
- Prefixos duplicados nas migrations da main (019, 020, 021) e também na go-live (019, 020, 021 com dois arquivos cada). O Supabase CLI recusa. Renomear sem mexer no histórico remoto exige ler `supabase_migrations.schema_migrations` antes (ainda não feito).
- Falta `supabase/config.toml` na main e na go-live.
- Remoto com drift (ver `docs/AUDITORIA_REMOTA_HOMOLOGACAO.md`): 019–021 registradas sem efeito no schema; políticas de escrita direta em sales/caixa ativas em produção.
- Tela de caixa da main grava `cash_registers.operator_id`, coluna inexistente: "Erro ao abrir caixa". A go-live resolve pela 029 (RPCs `abrir_caixa`, `fechar_caixa`) e pela 030 (fecha gravações diretas).

## P1 — Falta para lançar (MVP)

- Decidir o caminho da go-live (`integracao/go-live-02`, 30 commits sobre a main, inclui inventário, painel, fiscal e caixa transacional): PR único grande ou PRs menores.
- Teste manual pela interface no banco local (cadastro de conta, abrir caixa, venda, cancelamento): não feito. O SQL cobre as RPCs, não a tela.
- Decidir o PR da branch `fix/migrations-do-zero` (ainda sem push).
- Rodar typecheck, testes e build do app apontando para o banco local.
- Teste manual no banco local: cadastro de conta, abrir caixa, venda e cancelamento de venda.
- SMTP próprio com domínio validado e teste real de entrega (caixa de entrada, não spam).
- Backup e restauração testados; projeto de produção no plano Pro (o projeto atual está no plano Free).
- Revisão jurídica dos termos e da política de privacidade (LGPD).
- Cobrança manual do piloto combinada por escrito (não há integração de pagamento).
- Autorização do gerente para desconto acima de 5% (hoje o banco recusa).
- Texto de trial de 15 dias conferido na landing nova (`landing/`, Next.js).
- Validar em uso real o convite de funcionário (convidar, abrir o link, definir senha, entrar).
- Confirmar `APP_URL` = `https://venddipdv.com` e as Redirect URLs no painel do Supabase.
- Publicar o app em `venddipdv.com`: `/convite` respondia 404.
- Verificar a checagem pendente do PR #6 (estado UNSTABLE no GitHub).

## P2 — Melhoria

- README assina "Proprietário — Mature Code"; o nome correto é NatureCode (linha 132).
- Sangrias e suprimentos gravam `balance_after = 0` no cliente; o histórico de saldo fica incompleto (o fechamento não é afetado). Resolvido na go-live pela 029, mas confirmar após o merge.
- Cadastro de funcionário sem convite (hoje o convite é o único caminho).
- Retomar BI (módulo escolhido para a próxima sprint depois do caixa).

## Feito

- 2026-11-14 — `supabase db reset` aplicou as 35 migrations do zero no Supabase local, sem erro (branch `fix/migrations-do-zero`, sem push). Os 24 testes SQL passaram; typecheck, 139 testes unitários e build OK.
- 2026-11-14 — Comparação main × `integracao/go-live-02` (somente leitura): go-live contém a main e corrige GRANT e operator_id, mas não corrige prefixos duplicados nem config.toml.
- 2026-10-21 — Migration 021 aplicada no Supabase e Edge Function `invite-employee` publicada (versão 4).
- 2026-10-21 — Sprint do caixa: fechamento por caixa/período e cancelamento de venda com auditoria (PR #8).
- 2026-10-21 — Convites de funcionários: reenvio, cancelamento, status e bloqueio de escalada (PR #7).
- 2026-10-21 — Central de Funcionários com comissão e desconto de 5% em dinheiro no PDV.
- 2026-10-21 — PDV fechado por padrão; início é a tela pós-login.
- 2026-10-21 — Trial de 15 dias com expiração no banco e no login; entrada de estoque.
- 2026-10-21 — Correções de segurança apontadas nos PRs #6 e #8 (migrations 014 a 021).
- 2026-10-29 — Merge de `main` resolvido nos PRs #6, #7 e #8 (landing antiga removida no SPA).
