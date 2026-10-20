# Venddi: identidade operacional antes de atacado e margem

Base inspecionada: commit 61668bd6ce97c59def91197acee477e0343629a3.
Escopo desta alteração: autenticação da interface e identidade nas APIs de vendas.
Status: rascunho, sem homologação. Não pronto para produção.

## Comportamento corrigido no código

- O store utilizado pela tela agora chama o serviço de autenticação com email e senha.
- Com Supabase configurado, o login usa Auth e busca perfil ativo e empresa ativa no banco.
- Flags, perfis e empresa do antigo localStorage venddi-auth não são restaurados como autenticação.
- A sessão é restaurada pelo SDK com verificação via getUser.
- Logout invalida restaurações pendentes e chama o serviço de saída.
- Evento SIGNED_OUT limpa o estado da interface sem chamadas Auth reentrantes.
- A API de venda e cancelamento usa identidade verificada, substituindo IDs de demonstração.
- Consultas de venda incluem escopo da empresa; leitura dos itens não solicita o custo.
- O login redireciona para /app/pdv; /app/dashboard não existia.
- Dados de demonstração na tela de login aparecem apenas sem Supabase configurado.
- Cadastro real retorna indisponibilidade antes de criar Auth/empresa/usuário parcialmente.
  Cadastro de demonstração permanece apenas no ambiente sem Supabase.
- A troca de empresa não aceita outra empresa nem atributos fornecidos pelo chamador.

Isso NÃO substitui autenticação, autorização e proteção de custos no servidor.
As RPCs e policies precisam de uma etapa própria de correção.

## Bloqueadores confirmados por inspeção

1. Migration 005 usa create_company_rls_policies em sale_items e payments.
   A migration 003 cria ambas sem company_id. As policies precisam derivar o vínculo
   pela venda ou usar uma modelagem validada equivalente. Uma instalação limpa não
   deve ser considerada válida antes de executar toda a cadeia.

2. Migration 008 usa DROP FUNCTION get_user_company_id() sem tratar as policies
   dependentes criadas na 005. Verificar aplicação limpa e dependências.
   Também utiliza parâmetros obrigatórios após parâmetro com DEFAULT nas RPCs de venda;
   PostgreSQL exige defaults para os parâmetros de entrada subsequentes.

3. create_atomic_sale aceita preços do cliente e não valida auth.uid() como identidade
   do operador. cancel_sale_with_reversal também precisa de autorização real no banco.
   Grants para authenticated não revogam automaticamente EXECUTE herdado de PUBLIC.

4. MAX(sale_number) com FOR UPDATE sobre agregação é inválido.
   Estoque, idempotência e cancelamento exigem testes reais de concorrência.

5. Policies genéricas autorizam escrita ampla dentro da empresa. Revisar papéis,
   acesso direto a vendas/estoque/caixa/auditoria e proteção de custos por coluna/API.

6. Cadastro real requer bootstrap transacional autenticado e idempotente.
   As policies atuais não permitem o INSERT inicial de empresa pelo cliente.
   Não corrigir abrindo INSERT público ou permitindo escolha de papel pelo cliente.

7. Caixa ainda possui IDs fictícios, atualização não atômica de totais e uso de
   supabase.rpc como valor de coluna. Não foi corrigido neste lote.

8. createProduct não fornece company_id; filtro de estoque mínimo usa RPC como
   operando de coluna. Revisar CRUD real de produtos antes da precificação.

9. Atacado e margem ainda não implementados. Prioridade posterior à correção do banco:
   faixas por produto, soma das linhas repetidas, preço calculado no servidor,
   custo/preço/regra preservados por item e rateio exato de desconto geral.

10. Sessões de outras abas com troca de usuário, recuperação de senha, expiração
    operacional e retorno do onboarding precisam de testes completos no navegador.

## Validação

Foram adicionados testes Vitest para store, contexto autenticado e identidade
das APIs. Esses testes usam mocks e NÃO comprovam RLS, concorrência ou execução SQL.

O terminal não iniciou por erro de configuração de sandbox:
invalid sandbox permission path URI: file:///workspace is invalid on windows.

Por isso NÃO foram executados:
- npm ci
- npm run typecheck
- npm run test:run
- npm run build
- migrations em PostgreSQL
- testes no navegador

Nenhum banco remoto foi alterado. Nenhuma infraestrutura foi contratada.
Não fazer merge antes de executar os comandos acima e revisar o diff.
Revisar login real com usuário já provisionado, senha inválida, usuário inativo,
empresa suspensa, reload, logout e falha de rede. Verificar também signOut em
falha de rede: a limpeza visual não é prova de revogação da sessão remota.

## Próxima entrega

Reparar e executar migrations em ambiente local; fechar autorização das RPCs e
escritas diretas; implementar bootstrap seguro e caixa transacional.
Depois integrar atacado e margem conforme especificação discutida.
