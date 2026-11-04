# Hotfix VENDDI-SEC-01 — como testar

Este diretório **não** é de migrations. Não entra no `supabase migration up`. O hotfix só vai a produção com aprovação explícita (ver `docs/SEC01_RELATORIO.md`, seção 8).

## Arquivos

- `sec01_hotfix_escrita_direta.sql`: o hotfix (políticas de escrita direta, grants e isolamento de `update_subscription_statuses`).
- `sec01_rollback.sql`: desfaz o hotfix, restaurando o estado anterior.
- `tests/sec01_autorizacao.sql`: testes de autorização e isolamento. Grupos A (ataques), L (legítimos) e K (defeitos conhecidos fora do escopo).

## Replicar o schema remoto localmente (somente leitura no remoto)

1. Gerar o dump do schema remoto com o CLI (não altera nada):

   ```bash
   supabase db dump --linked -f <pasta-privada>/remote_schema.sql
   ```

   Guarde a pasta fora do repositório.

2. Subir um Postgres local e carregar stubs mínimos de `auth` e papéis:

   ```bash
   docker run -d --name venddi-remote-sim -e POSTGRES_PASSWORD=test postgres:16-alpine
   ```

   Os stubs estão no bloco `CREATE SCHEMA auth ... GRANT USAGE` de `supabase/tests/run_local_db_tests.sh`, com os papéis `anon`, `authenticated` e `service_role`.

3. Carregar o dump. Três erros são esperados: schema `extensions`, `supabase_vault` e a publicação `supabase_realtime`, que são do ambiente gerenciado.

## Rodar os testes

```bash
# Antes do hotfix: os grupos A devem FALHAR (brecha presente)
docker exec -i venddi-remote-sim psql -U postgres < supabase/hotfix/tests/sec01_autorizacao.sql

# Aplicar o hotfix
docker exec -i venddi-remote-sim psql -U postgres -v ON_ERROR_STOP=1 < supabase/hotfix/sec01_hotfix_escrita_direta.sql

# Depois do hotfix: A e L devem passar; K1 continua como defeito conhecido
docker exec -i venddi-remote-sim psql -U postgres < supabase/hotfix/tests/sec01_autorizacao.sql
```

Ciclo de validação do rollback: `sec01_rollback.sql` deve devolver os grupos A para FALHOU; reaplicar o hotfix deve devolver para OK.

## Limitações conhecidas

- O K1 (`create_atomic_sale` com `FOR UPDATE` sobre agregado) não é corrigido pelo hotfix. Vendas via RPC falham no remoto até a migração corretiva C-01.
- A escrita direta de caixa (`cash_registers`, `cash_movements`) não é removida pelo hotfix, porque o app publicado depende dela.
- O teste não substitui homologação em ambiente isolado com o app em execução.
