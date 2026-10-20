# Guia Rápido de Sincronização - Sprints 06 e 07

**Tempo estimado:** 15-20 minutos  
**Dificuldade:** Fácil

---

## 🚀 Passo a Passo Rápido

### 1. Preparar Ambiente (2 min)

```bash
# No Windows, abrir PowerShell ou CMD
cd C:\Naturecode\venddi-github

# Verificar branch atual
git branch

# Mudar para main e atualizar
git checkout main
git pull origin main
```

### 2. Criar Branch de Recuperação (1 min)

```bash
git checkout -b recovery/sprints-06-07
```

### 3. Copiar Arquivos (5-10 min)

**Opção Mais Fácil: Via Explorador de Arquivos**

1. Abrir dois Exploradores de Arquivos:
   - **Janela 1:** Ambiente de desenvolvimento atual (onde está o código completo)
   - **Janela 2:** `C:\Naturecode\venddi-github`

2. Na Janela 1, selecionar todos os arquivos e pastas:
   - `src/` (pasta completa)
   - `docs/` (pasta completa)
   - `supabase/` (pasta completa)
   - `public/` (pasta completa)
   - Arquivos raiz: `README.md`, `package.json`, `tsconfig.json`, `vite.config.js`, `index.html`
   - Arquivos de manifesto: `RECOVERY_MANIFEST.md`, `RELATORIO_SINCRONIZACAO.md`

3. Copiar (Ctrl+C)

4. Na Janela 2, colar em `C:\Naturecode\venddi-github` (Ctrl+V)

5. Quando perguntado, selecionar **"Substituir os arquivos existentes"**

### 4. Verificar Integridade (2 min)

```bash
# Verificar status
git status

# Deve mostrar muitos arquivos modificados e novos

# Verificar build
npm run build

# Deve completar sem erros em ~8-9 segundos

# Verificar typecheck
npm run typecheck

# Deve completar sem erros
```

### 5. Commit (2 min)

```bash
# Adicionar todos os arquivos
git add .

# Commit com mensagem
git commit -m "feat: Recovery Sprints 06-07

- Sprint 06: Consolidação MVP (trial automático, cancelamento, company ID)
- Sprint 07: Conexão Supabase (auditoria, backup, homologação)
- Melhorias UX: Dashboard expandido, PDV otimizado, hardware integration
- 140 arquivos recuperados
- Build aprovado (8.49s)

Ver: RECOVERY_MANIFEST.md e RELATORIO_SINCRONIZACAO.md"
```

### 6. Push (1 min)

```bash
git push origin recovery/sprints-06-07
```

### 7. Criar Pull Request (2 min)

1. Acessar: https://github.com/nocodenn-cell/Venddi
2. Clicar em **"Pull requests"** → **"New pull request"**
3. Configurar:
   - **base:** `main`
   - **compare:** `recovery/sprints-06-07`
4. Clicar em **"Create pull request"**
5. Preencher:
   - **Título:** `Recovery: Sprints 06-07 - Consolidação MVP e Melhorias UX`
   - **Descrição:** Copiar do arquivo `RELATORIO_SINCRONIZACAO.md`
6. Clicar em **"Create pull request"**

---

## ✅ Checklist Rápido

- [ ] Branch `recovery/sprints-06-07` criada
- [ ] Arquivos copiados (140 arquivos)
- [ ] Build aprovado (`npm run build`)
- [ ] Typecheck aprovado (`npm run typecheck`)
- [ ] Commit realizado
- [ ] Push executado
- [ ] Pull Request criado

---

## 🐛 Solução de Problemas

### Problema: "fatal: not a git repository"

**Solução:**
```bash
cd C:\Naturecode\venddi-github
git init
git remote add origin https://github.com/nocodenn-cell/Venddi.git
git fetch origin
git checkout main
```

### Problema: "error: failed to push some refs"

**Solução:**
```bash
git pull origin recovery/sprints-06-07 --rebase
git push origin recovery/sprints-06-07
```

### Problema: Build falha

**Solução:**
```bash
# Limpar cache
rm -rf node_modules
rm package-lock.json

# Reinstalar
npm install

# Tentar build novamente
npm run build
```

### Problema: Conflitos de merge

**Solução:**
```bash
# Ver arquivos com conflito
git status

# Resolver conflitos manualmente
# Depois:
git add .
git commit
git push
```

---

## 📊 Verificação Final

Após o push, verificar no GitHub:

1. Acessar: https://github.com/nocodenn-cell/Venddi/branches
2. Verificar se branch `recovery/sprints-06-07` aparece
3. Acessar: https://github.com/nocodenn-cell/Venddi/pulls
4. Verificar se Pull Request foi criado
5. Verificar se todos os 140 arquivos estão presentes

---

## 🎯 Resultado Esperado

Após a sincronização:

- ✅ Branch `recovery/sprints-06-07` no GitHub
- ✅ Pull Request aberto para `main`
- ✅ 140 arquivos recuperados
- ✅ Build funcionando
- ✅ Documentação completa
- ✅ Pronto para revisão e merge

---

## 📞 Suporte

**Se precisar de ajuda:**

1. Consultar `RECOVERY_MANIFEST.md` - Lista completa de arquivos
2. Consultar `RELATORIO_SINCRONIZACAO.md` - Relatório detalhado
3. Consultar documentação em `docs/` - Relatórios de cada sprint

**Contato:**
- Repositório: https://github.com/nocodenn-cell/Venddi
- Issues: https://github.com/nocodenn-cell/Venddi/issues

---

**Tempo total estimado:** 15-20 minutos  
**Dificuldade:** Fácil  
**Status:** ✅ Pronto para executar
