# Segurança multiempresa: migration 012

Base: `main` @ `61668bd`. Complementa o PR #2 (`fix/auth-operational-identity`), que corrige o lado do cliente (login real, sessão e identidade nas chamadas). Este PR corrige o servidor.

## Causas raiz (main)

| # | Evidência | Problema |
|---|---|---|
| 1 | `src/lib/api/sales.ts:82` `p_company_id: 'cmp_001'`; `:154-155` `'cmp_001'`/`'usr_001'` | A empresa e o operador vinham do navegador. Além disso, `'cmp_001'` nem é UUID, então a RPC real falharia. |
| 2 | `006_atomic_sale_rpc.sql:4-18` e `008_critical_fixes.sql:39-55` | `create_atomic_sale(p_company_id, ...)` confia no parâmetro. Ela também tem parâmetro obrigatório depois de um com DEFAULT, o que dá erro no PostgreSQL, então a função **nunca foi criada** (aplicação local da cadeia). |
| 3 | `008:24` `DROP FUNCTION get_user_company_id()` | Falha porque há policies dependentes. Por isso o `search_path` nunca foi fixado. |
| 4 | `005:117-118` policies genéricas em `sale_items`/`payments` | Essas tabelas não têm `company_id`, então a 005 falha no meio. |
| 5 | `005:64-74` policy em `users` consulta `users` | Recursão infinita de RLS. |
| 6 | `008:180-183` `MAX(...) FOR UPDATE` | Inválido. O número da venda corre risco de corrida. |
| 7 | `008:344` | `cash_movements.user_id` é NOT NULL e não é preenchido, então a venda em dinheiro falharia. |
| 8 | `010:138-170` | Usa CHECK com subconsulta, o que é inválido. |
| 9 | `011:182-205` | O dono podia inserir ou atualizar a própria assinatura, inclusive estender o teste. |
| 10 | `src/lib/store/auth.ts:59-120` | Login e cadastro simulados. O cadastro gerava `cmp_${Date.now()}` no navegador. O PR #2 trata o login; este PR trata o cadastro. |
| 11 | `src/lib/featureFlags.ts:73-77,198` | `TRIAL_15_DAYS: true` e `backendValidationGuard` rodam no navegador, então não são controle de segurança. |

Consequência: com a CLI do Supabase, `db reset`/`db push` param na 005. O estado real do banco de produção é **desconhecido**. Confira antes de aplicar (ver "Produção").

## O que a 012 faz (idempotente e defensiva)
- **Identidade:** `get_user_company_id()`, `current_app_user_id()` e `current_user_role()` são SECURITY DEFINER com `search_path` fixo e consideram só usuário e empresa ativos.
- **Policies:** são recriadas em todas as tabelas de empresa, com `FORCE RLS` e sem acesso para `anon`.
  - Escrita direta é mantida onde o app já escreve (catálogo, caixa, financeiro), sempre presa à empresa do token, com `WITH CHECK`.
  - `sales`, `sale_items`, `payments` e `company_subscriptions` não aceitam escrita pelo navegador, só pelas RPCs.
  - `audit_logs` só aceita inserção.
  - Gatilhos impedem trocar status, plano ou CNPJ da empresa, e impedem trocar o `company_id` ou o `auth_id` do usuário.
- **`create_atomic_sale` / `cancel_sale_with_reversal`:**
  - empresa e operador vêm de `auth.uid()`;
  - `p_company_id`/`p_operator_id` continuam aceitos (compatível com o PR #2), mas são recusados se divergirem;
  - a venda trava a linha da empresa;
  - a baixa de estoque é condicional;
  - a idempotência vale por empresa;
  - bloqueia empresa sem liberação.
  - O contrato `{success, error}` foi mantido.
- **Cadastro:**
  - um gatilho em `auth.users` (que funciona com confirmação de e-mail) e a RPC `bootstrap_my_company` criam a empresa, o usuário `owner` e a assinatura `pending`;
  - a operação é idempotente e valida o CNPJ;
  - o navegador não escolhe empresa nem papel.
- **Assinatura e funcionalidades no servidor:**
  - `platform_feature_flags` (`FISCAL_ENABLED=false`, `AUTO_TRIAL=false`);
  - `get_company_entitlements()`;
  - `company_can_operate()`;
  - `approve_company_evaluation()`, só para service_role, que libera a avaliação depois do contato comercial;
  - empresas sem linha de assinatura (anteriores à 011) continuam operando.
- **Privilégios:** revoga `EXECUTE` de PUBLIC/anon e das funções internas para `authenticated`, porque o Supabase concede isso por padrão.

## Testes
`supabase/tests/012_tenant_isolation_test.sql` cobre duas empresas: leitura e escrita cruzadas, spoof de `company_id`/`operator_id`, idempotência, estoque, cancelamento, empresa pendente, usuário sem empresa e anônimo. Tudo roda numa transação com ROLLBACK no fim.

Para rodar sem a stack do Supabase (Postgres puro):
```
psql -d teste -f supabase/tests/local_auth_stub.sql
# aplicar 001..011 (com erros, como hoje) e depois 012 com ON_ERROR_STOP
psql -d teste -v ON_ERROR_STOP=1 -f supabase/tests/012_tenant_isolation_test.sql
```

## Produção (precisa de autorização)
1. Inventariar o banco: `select version from supabase_migrations.schema_migrations`, `\df create_atomic_sale` e `select * from pg_policies`.
2. Fazer backup e aplicar a 012 em homologação, rodar o teste e depois o fluxo real de login, cadastro e venda.
3. Aplicar em produção. Antes disso, liberar as empresas existentes que já tiverem linha `trial` vencida.
4. Rodar `approve_company_evaluation(company_id, dias)` para cada loja aprovada comercialmente.

## Pendências fora deste PR
- O preço unitário ainda vem do cliente (atacado e margem, ver auditoria do PR #2).
- `cost_price` continua legível por `select *` em `sale_items`/`products`.
- O cancelamento não exige papel de gerente (mantido para não regredir; decisão do negócio).
- Caixa e produtos ainda usam IDs fictícios no cliente (itens 7 e 8 da auditoria do PR #2).
- As migrations 005/006/008/010 continuam quebradas para instalação limpa. Decidir se serão reparadas, o que só é seguro se nunca tiverem sido aplicadas em produção.
