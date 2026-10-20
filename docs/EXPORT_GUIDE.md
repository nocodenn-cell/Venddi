# Guia de Exportação — BLUM ERP

## 🎯 Método Recomendado: Página de Exportação

O BLUM ERP inclui uma página dedicada para exportação do projeto:

### Passo a Passo

1. **Acesse a aplicação** no navegador
2. **Navegue até:** `/export`
3. **Clique em "Gerar ZIP"**
4. **Aguarde** o processamento (barra de progresso)
5. **Download automático** do arquivo `BLUM-ERP.zip`

### URL Direta

```
https://[seu-dominio]/export
```

---

## 📦 Conteúdo do ZIP

O arquivo `BLUM-ERP.zip` contém:

### ✅ Incluído
- **src/** — Todo o código-fonte (React, TypeScript, componentes, páginas)
- **supabase/migrations/** — 5 migrations SQL versionadas
- **supabase/tests/** — Testes de isolamento RLS
- **docs/** — Documentação completa (arquitetura, progresso, relatórios)
- **Configurações** — package.json, tsconfig.json, vite.config.js
- **Arquivos raiz** — README.md, index.html, .env.example, .gitignore

### ❌ Excluído (por segurança)
- `node_modules/` — Dependências (reinstalar com `npm install`)
- `dist/` — Build de produção (gerar com `npm run build`)
- `.env` — Credenciais reais (configurar manualmente)
- Caches e arquivos temporários

---

## 🖥️ Após Extração no Windows

### 1. Extrair o ZIP

```powershell
# Usando PowerShell
Expand-Archive -Path BLUM-ERP.zip -DestinationPath C:\projetos\blum-erp

# Ou clique direito → Extrair tudo...
```

### 2. Instalar Dependências

```powershell
cd C:\projetos\blum-erp
npm install
```

### 3. Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Onde encontrar:**
- Acesse [supabase.com](https://supabase.com)
- Selecione seu projeto
- Vá em **Settings** → **API**
- Copie **Project URL** e **anon public key**

### 4. Iniciar o Servidor

```powershell
npm run dev
```

A aplicação estará disponível em: `http://localhost:3000`

---

## 🔧 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Gera build de produção |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run test` | Executa testes unitários (Vitest) |
| `npm run preview` | Visualiza build de produção |

---

## 🗄️ Configurar Supabase

### Opção A: Supabase Cloud (Recomendado)

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Aplique as migrations em `supabase/migrations/` (001 a 005)
4. Copie as credenciais para `.env`

### Opção B: Supabase Local (Docker)

```powershell
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase start

# Aplicar migrations
supabase db reset

# Executar testes RLS
psql -f supabase/tests/rls_isolation_test.sql
```

---

## 📋 Estrutura do Projeto

```
blum-erp/
├── src/
│   ├── components/
│   │   ├── forms/          # Formulários (ProductForm)
│   │   ├── layout/         # Layout (AdminLayout, Sidebar)
│   │   └── ui/             # Design system (Button, Input, etc.)
│   ├── lib/
│   │   ├── __tests__/      # Testes unitários
│   │   ├── api/            # API layer (products)
│   │   ├── services/       # Serviços (auth)
│   │   ├── store/          # Zustand stores
│   │   ├── router.tsx      # Rotas
│   │   ├── schemas.ts      # Validações Zod
│   │   ├── supabase.ts     # Cliente Supabase
│   │   └── utils.ts        # Utilitários
│   ├── pages/              # Páginas (Dashboard, Products, etc.)
│   ├── App.tsx             # Componente raiz
│   ├── main.tsx            # Entry point
│   └── index.css           # Estilos globais
├── supabase/
│   ├── migrations/         # Migrations SQL (001-005)
│   └── tests/              # Testes RLS
├── docs/                   # Documentação
├── package.json
├── tsconfig.json
├── vite.config.js
└── README.md
```

---

## 🔐 Segurança

### Credenciais

**NUNCA commite o arquivo `.env`** com credenciais reais.

O `.gitignore` já exclui:
- `.env`
- `.env.local`
- `node_modules/`
- `dist/`

### Modo Mock

O BLUM ERP possui um modo mock para desenvolvimento sem Supabase:
- **Desenvolvimento:** Modo mock ativo se Supabase não configurado
- **Produção:** Modo mock bloqueado (exige Supabase real)

---

## 🐛 Solução de Problemas

### Erro: "Supabase is not configured"

**Causa:** Variáveis de ambiente não configuradas em produção.

**Solução:**
```bash
# Verificar se .env existe
cat .env

# Configurar variáveis
echo "VITE_SUPABASE_URL=https://seu-projeto.supabase.co" > .env
echo "VITE_SUPABASE_ANON_KEY=sua-chave-aqui" >> .env
```

### Erro: "Cannot find module"

**Causa:** Dependências não instaladas.

**Solução:**
```bash
npm install
```

### Erro: "Port 3000 already in use"

**Causa:** Outra aplicação usando a porta 3000.

**Solução:**
```bash
# Usar porta diferente
npm run dev -- --port 3001
```

### Erro: "Module not found: Can't resolve '@/'"

**Causa:** Aliases do TypeScript não configurados.

**Solução:** Verificar `tsconfig.json` e `vite.config.js` (já configurados).

---

## 📞 Suporte

### Documentação

- **Arquitetura:** `docs/ARCHITECTURE.md`
- **Banco de Dados:** `docs/DATABASE.md`
- **Segurança:** `docs/SECURITY.md`
- **Roadmap:** `docs/ROADMAP.md`
- **Progresso:** `docs/PROGRESS.md`

### Relatórios de Sprint

- **Sprint 01:** `docs/SPRINT_01_1_REPORT.md`
- **Sprint 01.2:** `docs/SPRINT_01_2_REPORT.md`

---

## 🚀 Próximos Passos

Após exportar e configurar:

1. **Executar testes:** `npm run test`
2. **Aplicar migrations:** Via Supabase Dashboard ou CLI
3. **Testar autenticação:** Login com `admin@blum.com`
4. **Explorar módulos:** Dashboard, Produtos, PDV, etc.
5. **Consultar documentação:** `docs/` para detalhes

---

## 📊 Estatísticas do Projeto

- **Arquivos fonte:** 47 arquivos
- **Migrations SQL:** 5 arquivos
- **Testes:** 3 arquivos (Vitest)
- **Documentação:** 9 arquivos
- **Total no ZIP:** ~60 arquivos

---

**Última atualização:** 2026-10-19  
**Versão:** Sprint 01.2
