# Guia de Resolução - Erro uuid_generate_v4()

**Data:** 2026-10-19  
**Problema:** `ERROR: function uuid_generate_v4() does not exist`

---

## 🔍 Diagnóstico

O erro ocorre porque a extensão `uuid-ossp` não está habilitada no banco de dados Supabase Cloud. Esta extensão fornece a função `uuid_generate_v4()`, mas o Supabase moderno recomenda usar `gen_random_uuid()` (nativa do PostgreSQL 13+).

---

## ✅ Solução Rápida (5 minutos)

### Opção A: Executar Script de Preparação (Recomendado)

1. **Acessar Supabase SQL Editor**
   - URL: https://supabase.com/dashboard/project/jcvblxyzceszzehehyjd/sql
   
2. **Copiar e colar o conteúdo do arquivo:**
   ```
   scripts/prepare_database.sql
   ```

3. **Clicar em "Run"**

4. **Verificar mensagens:**
   - ✅ "uuid_generate_v4() está disponível"
   - ✅ "gen_random_uuid() está disponível"
   - ✅ "Ambas as funções UUID estão disponíveis!"

5. **Após sucesso, executar:**
   ```bash
   supabase db push
   ```

---

### Opção B: Aplicar Migration 000 Manualmente

1. **Acessar Supabase SQL Editor**
   - URL: https://supabase.com/dashboard/project/jcvblxyzceszzehehyjd/sql

2. **Copiar e colar o conteúdo do arquivo:**
   ```
   supabase/migrations/000_extensions.sql
   ```

3. **Clicar em "Run"**

4. **Após sucesso, executar:**
   ```bash
   supabase db push
   ```

---

### Opção C: Habilitar Extensão Diretamente

Se as opções acima não funcionarem, execute este SQL mínimo:

```sql
-- Habilitar extensão uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Testar se funcionou
SELECT uuid_generate_v4();
```

Se retornar um UUID (ex: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`), está funcionando.

---

## 🔧 Solução Alternativa: Usar gen_random_uuid()

Se preferir não usar a extensão `uuid-ossp`, podemos modificar todas as migrations para usar `gen_random_uuid()` (nativo do PostgreSQL).

**Vantagens:**
- Não depende de extensão
- Mais moderno
- Performance melhor

**Desvantagens:**
- Requer modificar todas as migrations
- Pode quebrar compatibilidade com código existente

**Para implementar esta solução:**
```bash
# Substituir todas as ocorrências de uuid_generate_v4() por gen_random_uuid()
# nas migrations 001 a 013
```

---

## 📋 Verificação Pós-Correção

Após aplicar a solução, verifique:

### 1. Extensões Habilitadas
```sql
SELECT * FROM pg_extension;
```

**Esperado:**
- `plpgsql`
- `uuid-ossp`
- `pgcrypto`

### 2. Funções Disponíveis
```sql
SELECT uuid_generate_v4();
SELECT gen_random_uuid();
```

**Esperado:** Ambos retornam UUIDs válidos.

### 3. Aplicar Migrations
```bash
supabase db push
```

**Esperado:** Todas as migrations aplicadas sem erros.

---

## 🚨 Se o Erro Persistir

### Erro: "permission denied to create extension"

**Solução:** Você precisa ser owner do banco. No Supabase Cloud, isso é automático.

### Erro: "extension uuid-ossp does not exist"

**Solução:** A extensão não está disponível no seu plano Supabase. Use `gen_random_uuid()` ao invés.

### Erro: "function uuid_generate_v4() still does not exist"

**Solução:** 
1. Reinicie o Supabase SQL Editor
2. Execute novamente o script de preparação
3. Verifique se a extensão foi criada:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';
   ```

---

## 📞 Suporte

**Documentação Supabase:**
- https://supabase.com/docs/guides/database/extensions

**Problemas comuns:**
- Extensões não habilitadas
- Permissões insuficientes
- Search_path incorreto

---

## ✅ Checklist de Resolução

- [ ] Acessar Supabase SQL Editor
- [ ] Executar script de preparação
- [ ] Verificar mensagens de sucesso
- [ ] Testar funções UUID
- [ ] Executar `supabase db push`
- [ ] Verificar se todas as migrations foram aplicadas
- [ ] Testar aplicação (`npm run dev`)

---

**Status:** Aguardando execução do script de preparação  
**Próximo passo:** Executar `scripts/prepare_database.sql` no Supabase SQL Editor
