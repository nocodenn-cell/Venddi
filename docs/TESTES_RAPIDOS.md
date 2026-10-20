# Guia de Testes Rápidos - Validação de Funcionalidades

**Objetivo:** Testar todos os fluxos críticos em 30 minutos  
**Data:** 2026-10-19

---

## 🚀 Teste 1: Verificar Conexão com Supabase (2 min)

### Passo 1: Verificar arquivo .env
```bash
cd C:\Naturecode\venddi-github
type .env
```

**Deve mostrar:**
```
VITE_SUPABASE_URL=https://jcvblxyzceszzehehyjd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Passo 2: Verificar tabelas no Supabase
Acesse: https://supabase.com/dashboard/project/jcvblxyzceszzehehyjd/editor

**Verifique se existem:**
- ✅ companies
- ✅ users
- ✅ products
- ✅ sales
- ✅ sale_items
- ✅ cash_registers
- ✅ product_wholesale_tiers
- ✅ company_subscriptions

**Se faltar alguma tabela:** Me avise qual está faltando.

---

## 🚀 Teste 2: Iniciar Aplicação (2 min)

```bash
npm run dev
```

**Acesse:** http://localhost:3000

**Verifique:**
- ✅ Página de login aparece
- ✅ Logo Venddi visível
- ✅ Sem erros no console (F12 → Console)

**Se der erro:** Copie a mensagem de erro e me envie.

---

## 🚀 Teste 3: Login e Cadastro (5 min)

### Teste 3.1: Login
1. Acesse http://localhost:3000/login
2. Use: `admin@venddi.com` / `admin123`
3. Clique em "Entrar"

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Redireciona para /app/pdv
- ✅ Mostra "Bem-vindo ao Venddi"

### Teste 3.2: Cadastro de Nova Empresa
1. Acesse http://localhost:3000/cadastro
2. Preencha:
   - Nome: "Loja Teste"
   - Email: "teste@loja.com"
   - Senha: "123456"
   - CNPJ: "11.111.111/0001-11"
3. Clique em "Criar conta"

**Resultado esperado:**
- ✅ Conta criada
- ✅ Trial de 30 dias ativo
- ✅ Redireciona para /app/pdv

**Se falhar:** Me envie o erro do console (F12).

---

## 🚀 Teste 4: Criar Produto (5 min)

1. Acesse /app/produtos
2. Clique em "Novo Produto"
3. Preencha:
   - Nome: "Camiseta Básica"
   - SKU: "CAM-001"
   - Custo: R$ 25,00
   - Preço: R$ 50,00
   - Estoque: 100
4. Clique em "Salvar"

**Verifique:**
- ✅ Produto aparece na lista
- ✅ Margem calculada: 50%
- ✅ Markup calculado: 100%

**Se falhar:** Me envie screenshot e erro do console.

---

## 🚀 Teste 5: Configurar Atacado (3 min)

1. No produto criado, clique em "Editar"
2. Na seção "Preço de Atacado":
   - Clique em "Adicionar Faixa"
   - Quantidade: 6
   - Preço: R$ 45,00
   - Clique em "Adicionar"
3. Adicione segunda faixa:
   - Quantidade: 12
   - Preço: R$ 40,00
   - Clique em "Adicionar"
4. Clique em "Salvar"

**Verifique:**
- ✅ Duas faixas aparecem
- ✅ Margem calculada para cada faixa
- ✅ Preços decrescentes validados

---

## 🚀 Teste 6: Abrir Caixa (2 min)

1. Acesse /app/caixas
2. Clique em "Abrir Caixa"
3. Valor inicial: R$ 100,00
4. Clique em "Confirmar"

**Verifique:**
- ✅ Caixa aberto
- ✅ Status: "Aberto"
- ✅ Valor inicial: R$ 100,00

---

## 🚀 Teste 7: Realizar Venda (5 min)

1. Acesse /app/pdv
2. Busque "Camiseta Básica"
3. Adicione 10 unidades
4. Clique em "Finalizar Venda"
5. Selecione: Dinheiro
6. Valor: R$ 450,00 (10 × R$ 45,00)
7. Clique em "Confirmar"

**Verifique:**
- ✅ Venda finalizada
- ✅ Número da venda exibido
- ✅ Preço unitário: R$ 45,00 (atacado)
- ✅ Total: R$ 450,00
- ✅ Estoque atualizado: 90 unidades

**Se falhar:** Me envie screenshot e erro.

---

## 🚀 Teste 8: Cancelar Venda (3 min)

1. Acesse /app/vendas
2. Localize a venda criada
3. Clique em "Cancelar"
4. Motivo: "Teste de cancelamento"
5. Clique em "Confirmar"

**Verifique:**
- ✅ Venda cancelada
- ✅ Status: "Cancelada"
- ✅ Estoque restaurado: 100 unidades
- ✅ Caixa estornado

---

## 🚀 Teste 9: Verificar Dashboard (2 min)

1. Acesse /app/gestao
2. Verifique:
   - ✅ Gráfico de tendência aparece
   - ✅ Alertas de estoque baixo
   - ✅ Filtros funcionam
   - ✅ Dados atualizados

---

## 📊 Checklist de Resultados

Marque cada teste:

- [ ] Teste 1: Conexão Supabase
- [ ] Teste 2: Iniciar aplicação
- [ ] Teste 3.1: Login
- [ ] Teste 3.2: Cadastro
- [ ] Teste 4: Criar produto
- [ ] Teste 5: Configurar atacado
- [ ] Teste 6: Abrir caixa
- [ ] Teste 7: Realizar venda
- [ ] Teste 8: Cancelar venda
- [ ] Teste 9: Dashboard

---

## 🐛 Registro de Bugs

Para cada bug encontrado, registre:

```markdown
### Bug #X
**Teste:** [Número do teste]
**Passos para reproduzir:**
1. ...
2. ...
3. ...

**Resultado esperado:** ...
**Resultado real:** ...
**Erro do console:** ...
**Screenshot:** [anexar]
**Severidade:** Crítica / Alta / Média / Baixa
```

---

## 📞 Próximos Passos

Após executar os testes:

1. **Me envie o checklist preenchido**
2. **Me envie os bugs encontrados**
3. **Me envie screenshots dos erros**

Com essas informações, vou:
- ✅ Corrigir bugs críticos
- ✅ Otimizar funcionalidades
- ✅ Preparar para loja piloto

---

**Tempo estimado:** 30 minutos  
**Dificuldade:** Fácil  
**Pré-requisitos:** .env configurado, migrations aplicadas
