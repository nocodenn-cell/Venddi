# Configuração de e-mail dos convites (Venddi)

Objetivo: enviar o convite de funcionário com link para `https://venddipdv.com/convite`,
sem custo adicional e sem credenciais no repositório.

## Estado a verificar no painel (Supabase → Authentication)

| Item | Onde | Esperado |
|---|---|---|
| URL de produção | URL Configuration → Site URL | `https://venddipdv.com` |
| Redirect URLs | URL Configuration → Redirect URLs | `https://venddipdv.com/**` e `http://localhost:5173/**` |
| SMTP próprio | SMTP Settings | Ativado, com remetente de domínio validado |
| Template do convite | Email Templates → Invite user | Conteúdo de `convite-template.html` |
| Segredo da função | `npx supabase secrets list` | `APP_URL` = `https://venddipdv.com` (o valor aparece em hash; confirme pelo painel ou redefinindo com `secrets set`) |

## Limites do envio padrão

O envio embutido do Supabase serve só para testes: tem limite baixo de e-mails por hora e
os e-mails costumam cair no spam. Não use para clientes pagantes.

## Opção gratuita recomendada: SMTP com plano gratuito

Requisitos para qualquer provedor escolhido:

1. Conta no provedor (plano gratuito), criada pelo proprietário.
2. Domínio do remetente validado (registros DNS SPF, DKIM e, se pedido, DMARC) em `venddipdv.com`.
3. Credenciais SMTP geradas no painel do provedor (host, porta, usuário, senha).
4. Remetente como `nao-responda@venddipdv.com`, nome `Venddi`.

Provedores com plano gratuito compatíveis (verifique limites atuais no site do fornecedor antes de usar):
Brevo, Resend e SendGrid. Os limites mudam, então confirme antes de depender deles.

No Supabase: Authentication → SMTP Settings → Enable custom SMTP → preencher host, porta,
usuário, senha, e-mail e nome do remetente → Save → Send test email.

As credenciais SMTP ficam só no painel do Supabase. Não as escreva em arquivos do repositório.

## Teste real de entrega (obrigatório antes de considerar pronto)

1. Convide um e-mail que você consiga abrir, de preferência Gmail e Outlook.
2. Confirme: chegou na caixa de entrada (não no spam), o remetente é `Venddi`, o botão funciona.
3. O clique leva a `https://venddipdv.com/convite` com a sessão do convite.
4. Defina a senha, entre pela tela de login e confirme que cai na empresa certa.
5. Espere o link expirar e confirme a mensagem de convite expirado e o reenvio pela Central.

## Dependências do proprietário

- Criar a conta no provedor SMTP e validar o domínio (DNS).
- Colocar as credenciais no painel do Supabase.
- Publicar o app em `venddipdv.com` (hoje `https://venddipdv.com/convite` responde 404).
- Autorizar o deploy da função `invite-employee` e a alteração de segredos, se for o caso.
