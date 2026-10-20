# Venddi — Plano de Homologação Local

**Data:** 2026-10-19  
**Versão:** 1.0  
**Ambiente:** Windows com Docker e Supabase CLI

---

## 📋 Visão Geral

Este documento fornece instruções passo a passo para homologar o Venddi em ambiente local Windows, utilizando Docker Desktop e Supabase CLI.

**Objetivo:** Validar todas as funcionalidades críticas antes de deploy em produção.

---

## 🔧 Pré-requisitos

### Software Necessário

| Software | Versão | Status |
|----------|--------|--------|
| Windows | 10/11 | ✅ |
| Docker Desktop | 4.x+ | ✅ |
| Supabase CLI | 2.117.0 | ✅ |
| Git | 2.55.0 | ✅ |
| Node.js | 18+ | ✅ |
| npm | 9+ | ✅ |

### Hardware Recomendado

- **CPU:** 4 cores ou mais
- **RAM:** 8GB ou mais
- **Disco:** 10GB livres
- **Rede:** Conexão estável para download de imagens Docker

---

## 🚀 Passo a Passo

### 1. Preparação do Ambiente

#### 1.1 Verificar Docker Desktop

```powershell
# Abrir PowerShell como Administrador
docker --version
# Esperado: Docker version 24.x.x

docker info
# Esperado: Informações do Docker sem erros
```

**Se Docker não estiver rodando:**
1. Abrir Docker Desktop
2. Aguardar inicialização completa
3. Verificar ícone na barra de tarefas

#### 1.2 Verificar Supabase CLI

```powershell
supabase --version
# Esperado: 2.117.0 ou superior
```

**Se Supabase CLI não estiver instalado:**
```powershell
npm install -g supabase
```

#### 1.3 Verificar Git

```powershell
git --version
# Esperado: git version 2.55.0
```

---

### 2. Transferência do Código

#### Opção A: Via Página de Exportação (Recomendado)

1. Acessar a aplicação no navegador
2. Navegar para `/export`
3. Clicar em "Gerar ZIP"
4. Aguardar download de `BLUM-ERP.zip`
5. Extrair em `C:\Naturecode\BLUM-ERP`

```powershell
# Usando PowerShell para extrair
Expand-Archive -Path "$env:USERPROFILE\Downloads\BLUM-ERP.zip" -DestinationPath "C:\Naturecode\BLUM-ERP" -Force
```

#### Opção B: Via Git

```powershell
cd C:\Naturecode
git clone [url-do-repositorio] BLUM-ERP
cd BLUM-ERP
```

---

### 3. Instalação das Dependências

```powershell
cd C:\Naturecode\BLUM-ERP

# Instalar dependências
npm install

# Verificar instalação
npm list --depth=0
```

**Tempo estimado:** 2-5 minutos

---

### 4. Configuração das Variáveis de Ambiente

#### 4.1 Iniciar Supabase Local

```powershell
cd C:\Naturecode\BLUM-ERP

# Iniciar Supabase
supabase start
```

**Aguardar mensagem:**
```
Started Supabase local development setup.

You can now view your projects in the browser:
- Studio: http://localhost:54323
- API: http://localhost:54321
```

#### 4.2 Anotar Credenciais

Após iniciar, o Supabase exibirá:

```
API URL: http://localhost:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANTE:** Anotar a `anon key` (NÃO usar `service_role` no frontend!)

#### 4.3 Criar Arquivo .env

Criar arquivo `C:\Naturecode\BLUM-ERP\.env`:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Substituir** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` pela `anon key` real.

**⚠️ SEGURANÇA:** Nunca commitar o arquivo `.env`!

---

### 5. Aplicação das Migrations

#### Opção A: Automático (Recomendado)

```powershell
supabase db reset
```

Este comando:
1. Reseta o banco de dados
2. Aplica todas as migrations em ordem
3. Cria as tabelas, índices e funções

#### Opção B: Manual

```powershell
# Conectar ao banco
psql -h localhost -p 54322 -U postgres -d postgres

# Aplicar migrations em ordem
\i supabase/migrations/001_foundation.sql
\i supabase/migrations/002_products_stock.sql
\i supabase/migrations/003_sales_customers.sql
\i supabase/migrations/004_cashier_financial.sql
\i supabase/migrations/005_rls_policies.sql
\i supabase/migrations/006_atomic_sale_rpc.sql
\i supabase/migrations/007_sale_enhancements.sql
\i supabase/migrations/008_critical_fixes.sql

# Sair
\q
```

#### 5.1 Verificar Aplicação

```powershell
# Conectar ao banco
psql -h localhost -p 54322 -U postgres -d postgres

# Listar tabelas
\dt

# Esperado:
# audit_logs
# cash_movements
# cash_registers
# categories
# companies
# customers
# financial_accounts
# financial_categories
# payments
# products
# sale_items
# sales
# stock_movements
# suppliers
# users

# Listar funções
\df

# Esperado:
# calculate_cash_balance
# cancel_sale_with_reversal
# create_atomic_sale
# create_company_rls_policies
# get_next_sale_number
# get_user_company_id
# update_updated_at_column

# Sair
\q
```

---

### 6. Execução dos Testes RLS

```powershell
# Conectar ao banco
psql -h localhost -p 54322 -U postgres -d postgres

# Executar testes
\i supabase/tests/rls_integration_tests.sql
```

**Resultados esperados:**
- Todos os 10 testes devem passar
- Nenhum erro de RLS violation inesperado
- Mensagens de erro claras quando apropriado

**Se algum teste falhar:**
1. Anotar o número do teste
2. Verificar a mensagem de erro
3. Consultar `docs/VENDDI_SPRINT_04_REPORT.md`
4. Verificar se todas as migrations foram aplicadas

---

### 7. Execução dos Testes Unitários

```powershell
cd C:\Naturecode\BLUM-ERP

# Executar testes
npm run test
```

**Resultados esperados:**
- 13 testes passando
- 0 falhas
- Cobertura de validações de pagamento, troco e totais

---

### 8. Inicialização da Aplicação

```powershell
cd C:\Naturecode\BLUM-ERP

# Iniciar servidor de desenvolvimento
npm run dev
```

**Aguardar mensagem:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

Acessar: `http://localhost:3000`

---

### 9. Validação Ponta a Ponta

#### Cenário 1: Fluxo Completo de Venda

**Objetivo:** Validar venda simples com pagamento em dinheiro

**Passos:**

1. **Login**
   - Acessar `http://localhost:3000`
   - Clicar em "Entrar"
   - Email: `admin@venddi.com`
   - Senha: `admin123`
   - Clicar em "Entrar"

2. **Abrir Caixa**
   - Menu lateral: "Caixas"
   - Clicar em "Abrir Caixa"
   - Valor inicial: `100.00`
   - Clicar em "Abrir Caixa"
   - Verificar: Caixa aberto com saldo R$ 100,00

3. **Realizar Venda**
   - Menu lateral: "PDV"
   - Buscar produto: "Camiseta"
   - Clicar no produto para adicionar ao carrinho
   - Verificar: Produto no carrinho com quantidade 1
   - Clicar em "Finalizar Venda"
   - Selecionar forma de pagamento: "Dinheiro"
   - Verificar: Total pago = Total da venda
   - Clicar em "Confirmar Venda"
   - Verificar: Mensagem de sucesso com número da venda

4. **Verificar Resultados**
   - Menu lateral: "Caixas"
   - Verificar: Total de vendas atualizado
   - Menu lateral: "Produtos"
   - Verificar: Estoque do produto reduzido
   - Menu lateral: "Painel"
   - Verificar: Faturamento atualizado

**Checklist:**
- [ ] Login funcionou
- [ ] Caixa abriu com sucesso
- [ ] Produto encontrado na busca
- [ ] Produto adicionado ao carrinho
- [ ] Pagamento em dinheiro registrado
- [ ] Venda finalizada com sucesso
- [ ] Estoque atualizado
- [ ] Caixa atualizado
- [ ] Dashboard atualizado

#### Cenário 2: Cancelamento de Venda

**Objetivo:** Validar cancelamento com estorno completo

**Passos:**

1. **Localizar Venda**
   - Menu lateral: "Vendas" (ou histórico no PDV)
   - Localizar venda realizada no Cenário 1
   - Clicar em "Cancelar"

2. **Cancelar Venda**
   - Informar motivo: "Teste de cancelamento"
   - Clicar em "Confirmar Cancelamento"
   - Verificar: Mensagem de sucesso

3. **Verificar Estorno**
   - Menu lateral: "Produtos"
   - Verificar: Estoque restaurado
   - Menu lateral: "Caixas"
   - Verificar: Total de vendas reduzido
   - Verificar: Movimentação de estorno registrada

**Checklist:**
- [ ] Venda localizada
- [ ] Cancelamento confirmado
- [ ] Estoque restaurado
- [ ] Caixa estornado
- [ ] Movimentação registrada
- [ ] Status da venda = 'cancelled'

#### Cenário 3: Pagamento Dividido

**Objetivo:** Validar pagamento com múltiplas formas

**Passos:**

1. **Preparar Venda**
   - Menu lateral: "PDV"
   - Adicionar múltiplos produtos ao carrinho
   - Verificar: Total > R$ 50,00

2. **Pagamento Dividido**
   - Clicar em "Finalizar Venda"
   - Selecionar "Dinheiro" - R$ 30,00
   - Selecionar "Cartão" - R$ 20,00 (ou valor restante)
   - Verificar: Total pago = Total da venda
   - Clicar em "Confirmar Venda"

3. **Verificar Resultados**
   - Verificar: Venda registrada
   - Verificar: Dois pagamentos registrados
   - Verificar: Caixa atualizado apenas com valor em dinheiro

**Checklist:**
- [ ] Múltiplos produtos no carrinho
- [ ] Pagamento em dinheiro registrado
- [ ] Pagamento com cartão registrado
- [ ] Total pago = Total da venda
- [ ] Venda finalizada com sucesso
- [ ] Caixa atualizado corretamente

#### Cenário 4: Multi-tenancy

**Objetivo:** Validar isolamento entre empresas

**Passos:**

1. **Criar Segunda Empresa**
   - Acessar `/cadastro`
   - Preencher dados de nova empresa
   - Nome: "Empresa Teste B"
   - CNPJ: "22.222.222/0001-22"
   - Clicar em "Criar conta"

2. **Verificar Isolamento**
   - Login com usuário da Empresa B
   - Menu lateral: "Produtos"
   - Verificar: Não vê produtos da Empresa A
   - Menu lateral: "Caixas"
   - Verificar: Não vê caixas da Empresa A

3. **Tentar Acessar Dados da Empresa A**
   - Tentar acessar URL direta de produto da Empresa A
   - Verificar: Acesso negado ou produto não encontrado

**Checklist:**
- [ ] Segunda empresa criada
- [ ] Login com Empresa B funcionou
- [ ] Produtos da Empresa A não visíveis
- [ ] Caixas da Empresa A não visíveis
- [ ] Acesso direto negado

#### Cenário 5: Permissões

**Objetivo:** Validar RBAC (Role-Based Access Control)

**Passos:**

1. **Criar Usuário Cashier**
   - Login como owner
   - Menu lateral: "Funcionários" (ou "Configurações")
   - Criar novo usuário com role "cashier"
   - Email: `cashier@test.com`
   - Senha: `cashier123`

2. **Login como Cashier**
   - Logout
   - Login com `cashier@test.com` / `cashier123`

3. **Verificar Permissões**
   - Menu lateral: Verificar menus disponíveis
   - Esperado: PDV, Caixas (limitado)
   - NÃO esperado: Configurações, Funcionários, Financeiro
   - Tentar acessar `/app/configuracoes`
   - Verificar: Redirecionado ou acesso negado

4. **Tentar Elevar Role**
   - Tentar alterar próprio role via API (se possível)
   - Verificar: Operação negada

**Checklist:**
- [ ] Usuário cashier criado
- [ ] Login como cashier funcionou
- [ ] Menus limitados corretamente
- [ ] Rotas protegidas bloqueadas
- [ ] Auto-elevação impedida

---

### 10. Verificação de Segurança

```powershell
# Verificar se não há credenciais no código
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern "service_role" -Recurse
# Esperado: Nenhum resultado

# Verificar se .env está no .gitignore
Select-String -Path ".gitignore" -Pattern "\.env"
# Esperado: .env listado

# Verificar se .env existe e tem credenciais
if (Test-Path ".env") {
    Write-Host ".env existe - OK"
    # Verificar conteúdo (NÃO mostrar no terminal!)
    # Get-Content .env
} else {
    Write-Host ".env não existe - CRIAR!"
}
```

---

### 11. Limpeza e Encerramento

#### 11.1 Parar Aplicação

```powershell
# No terminal do npm run dev
# Pressionar Ctrl+C
```

#### 11.2 Parar Supabase

```powershell
supabase stop
```

#### 11.3 Limpar Dados (Opcional)

```powershell
# Remover banco de dados local
supabase stop --no-backup

# Remover imagens Docker (liberar espaço)
docker system prune -a
```

---

## 📊 Checklist Final de Homologação

### Infraestrutura
- [ ] Docker Desktop rodando
- [ ] Supabase CLI instalado
- [ ] Supabase local iniciado
- [ ] Variáveis de ambiente configuradas
- [ ] Migrations aplicadas sem erros

### Testes
- [ ] Testes RLS executados (10 cenários)
- [ ] Testes unitários executados (13 testes)
- [ ] Todos os testes passando

### Funcionalidades
- [ ] Fluxo completo de venda validado
- [ ] Cancelamento com estorno validado
- [ ] Pagamento dividido validado
- [ ] Multi-tenancy validado
- [ ] Permissões validadas

### Segurança
- [ ] Credenciais não expostas no código
- [ ] .env no .gitignore
- [ ] RLS policies funcionando
- [ ] RPCs com search_path seguro

### Documentação
- [ ] Relatório de auditoria lido
- [ ] Plano de homologação seguido
- [ ] Problemas documentados

---

## 🐛 Solução de Problemas

### Problema: Docker não inicia

**Sintoma:** Erro ao executar `docker info`

**Solução:**
1. Abrir Docker Desktop
2. Aguardar inicialização completa
3. Verificar se WSL 2 está instalado
4. Reiniciar computador se necessário

### Problema: Supabase não inicia

**Sintoma:** Erro ao executar `supabase start`

**Solução:**
```powershell
# Parar containers existentes
docker ps -a | grep supabase | awk '{print $1}' | xargs docker rm -f

# Limpar volumes
docker volume prune

# Tentar novamente
supabase start
```

### Problema: Migrations falham

**Sintoma:** Erro ao aplicar migrations

**Solução:**
1. Verificar ordem das migrations
2. Verificar se há dependências circulares
3. Resetar banco: `supabase db reset`
4. Aplicar manualmente uma por uma

### Problema: Testes RLS falham

**Sintoma:** Testes de isolamento não passam

**Solução:**
1. Verificar se migration 005 foi aplicada
2. Verificar se migration 008 foi aplicada
3. Verificar se funções RPC existem: `\df`
4. Recriar policies se necessário

### Problema: Aplicação não conecta ao Supabase

**Sintoma:** Erro de conexão no navegador

**Solução:**
1. Verificar arquivo `.env`
2. Verificar se `VITE_SUPABASE_URL` está correto
3. Verificar se `VITE_SUPABASE_ANON_KEY` está correto
4. Reiniciar servidor: `npm run dev`
5. Limpar cache do navegador: Ctrl+Shift+R

### Problema: Porta já em uso

**Sintoma:** Erro "Port 3000 already in use"

**Solução:**
```powershell
# Encontrar processo usando a porta
netstat -ano | findstr :3000

# Matar processo (substituir PID)
taskkill /PID [PID] /F

# Ou usar outra porta
npm run dev -- --port 3001
```

---

## 📞 Suporte

### Documentação Interna
- `docs/VENDDI_SPRINT_04_REPORT.md` — Relatório de auditoria
- `docs/ARCHITECTURE.md` — Arquitetura do sistema
- `docs/DATABASE.md` — Schema do banco
- `docs/SECURITY.md` — Políticas de segurança

### Documentação Externa
- [Supabase Docs](https://supabase.com/docs)
- [Docker Docs](https://docs.docker.com)
- [React Docs](https://react.dev)

### Contato
- Equipe Venddi: [inserir contato]
- Suporte técnico: [inserir contato]

---

## ✅ Conclusão

Este plano de homologação fornece todas as instruções necessárias para validar o Venddi em ambiente local Windows. Seguindo os passos descritos, é possível:

1. ✅ Configurar ambiente de desenvolvimento
2. ✅ Aplicar todas as migrations
3. ✅ Executar testes automatizados
4. ✅ Validar funcionalidades críticas
5. ✅ Verificar segurança e multi-tenancy

**Próximo passo após homologação:** Deploy em ambiente de staging com Supabase Cloud.

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Versão:** 1.0  
**Status:** ✅ Pronto para execução
