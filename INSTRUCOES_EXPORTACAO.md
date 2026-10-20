# 📦 Exportação do BLUM ERP — Instruções

## ✅ Solução Implementada

Criei uma **página de exportação dedicada** que gera o arquivo ZIP diretamente no navegador.

---

## 🚀 Como Exportar

### Passo 1: Acessar a Página de Exportação

Abra no navegador:

```
/export
```

**Exemplo completo:**
```
https://seu-dominio.com/export
```

### Passo 2: Gerar o ZIP

1. Clique no botão **"Gerar ZIP"**
2. Aguarde o processamento (barra de progresso)
3. O download do arquivo `BLUM-ERP.zip` iniciará automaticamente

### Passo 3: Extrair no Windows

```powershell
# Usando PowerShell
Expand-Archive -Path BLUM-ERP.zip -DestinationPath C:\projetos\blum-erp

# Ou clique direito no arquivo → "Extrair Tudo..."
```

### Passo 4: Instalar e Configurar

```powershell
cd C:\projetos\blum-erp

# Instalar dependências
npm install

# Criar arquivo .env com suas credenciais Supabase
notepad .env

# Iniciar servidor
npm run dev
```

---

## 📦 Conteúdo do ZIP

### ✅ Incluído (47+ arquivos)

**Código Fonte:**
- `src/` — Todo o código React/TypeScript
  - Componentes UI (Button, Input, Card, etc.)
  - Páginas (Dashboard, Products, Login, etc.)
  - Serviços (auth, supabase, products API)
  - Testes unitários (Vitest)

**Banco de Dados:**
- `supabase/migrations/` — 5 migrations SQL
- `supabase/tests/` — Testes de isolamento RLS

**Documentação:**
- `docs/` — 9 arquivos de documentação
  - Arquitetura, Segurança, Roadmap
  - Relatórios das Sprints 01.1 e 01.2
  - Guia de exportação

**Configurações:**
- `package.json`, `package-lock.json`
- `tsconfig.json`, `vite.config.js`
- `index.html`, `README.md`
- `.env.example`, `.gitignore`

### ❌ Excluído (por segurança)

- `node_modules/` — Dependências (reinstalar com `npm install`)
- `dist/` — Build de produção (gerar com `npm run build`)
- `.env` — Credenciais reais (configurar manualmente)
- Caches e arquivos temporários

---

## 🔧 Após Extração

### 1. Instalar Dependências

```powershell
npm install
```

### 2. Configurar Supabase

Crie o arquivo `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Onde encontrar as credenciais:**
1. Acesse [supabase.com](https://supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie **Project URL** e **anon public key**

### 3. Aplicar Migrations

**Opção A: Via Supabase Dashboard**
1. Acesse o SQL Editor no dashboard
2. Copie o conteúdo de cada migration (001 a 005)
3. Execute em ordem

**Opção B: Via Supabase CLI (local)**
```powershell
supabase start
supabase db reset
```

### 4. Iniciar o Servidor

```powershell
npm run dev
```

A aplicação estará disponível em: `http://localhost:3000`

---

## 📋 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Gera build de produção |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run test` | Executa testes unitários |

---

## 🔐 Login de Demonstração

Após configurar Supabase, use:

```
Email: admin@blum.com
Senha: admin123
```

**Nota:** Em modo de desenvolvimento sem Supabase, o sistema usa autenticação mock.

---

## 📚 Documentação Completa

Após extração, consulte:

- **Guia de Exportação:** `docs/EXPORT_GUIDE.md`
- **Arquitetura:** `docs/ARCHITECTURE.md`
- **Banco de Dados:** `docs/DATABASE.md`
- **Segurança:** `docs/SECURITY.md`
- **Roadmap:** `docs/ROADMAP.md`
- **Progresso:** `docs/PROGRESS.md`

---

## 🐛 Solução de Problemas

### Erro: "Supabase is not configured"

**Causa:** Variáveis de ambiente não configuradas.

**Solução:**
```powershell
# Verificar se .env existe
type .env

# Se não existir, criar com suas credenciais
notepad .env
```

### Erro: "Cannot find module"

**Causa:** Dependências não instaladas.

**Solução:**
```powershell
npm install
```

### Erro: "Port 3000 already in use"

**Solução:**
```powershell
npm run dev -- --port 3001
```

---

## 📊 Estatísticas do Projeto

- **Arquivos no ZIP:** ~60 arquivos
- **Código fonte:** 47 arquivos TypeScript/React
- **Migrations SQL:** 5 arquivos
- **Testes:** 3 arquivos (Vitest)
- **Documentação:** 9 arquivos Markdown
- **Tamanho estimado:** ~2-3 MB (compactado)

---

## ✅ Checklist de Exportação

- [x] Página de exportação criada (`/export`)
- [x] JSZip e FileSaver instalados
- [x] Lista completa de arquivos (47+)
- [x] Barra de progresso visual
- [x] Tratamento de erros
- [x] Guia de exportação completo
- [x] Instruções para Windows
- [x] Build de produção aprovado

---

## 🎯 Resumo

**Para exportar o BLUM ERP:**

1. Acesse `/export` no navegador
2. Clique em "Gerar ZIP"
3. Aguarde o download
4. Extraia no Windows
5. Execute `npm install`
6. Configure `.env` com credenciais Supabase
7. Execute `npm run dev`

**Pronto!** O BLUM ERP estará rodando no seu computador Windows.

---

**Dúvidas?** Consulte `docs/EXPORT_GUIDE.md` para instruções detalhadas.
