# Sprint 07 - Backup e Restauração

**Data:** 2026-10-19  
**Status:** ⏳ Preparado (Aguardando Execução)  
**Projeto Supabase:** jcvblxyzceszzehehyjd

---

## 📋 Resumo Executivo

Este documento fornece instruções completas para backup e restauração do banco de dados Supabase da Venddi.

**IMPORTANTE:** 
- ⚠️ NÃO execute backup/restauração sem autorização do proprietário
- ⚠️ NÃO restaure sobre produção sem backup prévio
- ⚠️ Mantenha backups criptografados e fora do repositório

---

## 🎯 Objetivos

1. Criar backup lógico completo do banco de dados
2. Documentar processo de restauração
3. Validar integridade do backup
4. Preparar ambiente de teste isolado

---

## 🔒 Pré-requisitos

### Ferramentas Necessárias

1. **PostgreSQL Client (pg_dump/pg_restore)**
   ```bash
   # Verificar instalação
   pg_dump --version
   pg_restore --version
   ```

2. **Credenciais Administrativas**
   - Database password (não anon key!)
   - Host: `db.jcvblxyzceszzehehyjd.supabase.co`
   - Port: `5432`
   - User: `postgres`
   - Database: `postgres`

3. **Espaço em Disco**
   - Mínimo: 2GB livre
   - Recomendado: 5GB livre

---

## 📦 Procedimento de Backup

### Passo 1: Obter Credenciais do Banco

**NO Supabase Dashboard:**

1. Acesse: https://supabase.com/dashboard/project/jcvblxyzceszzehehyjd/settings/database
   
2. Role até **"Connection string"**
   
3. Copie a connection string URI:
   ```
   postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres
   ```

4. **IMPORTANTE:** 
   - Esta é a senha do banco de dados (DIFERENTE da anon key)
   - Mantenha esta senha em local seguro
   - NÃO compartilhe em chats ou commits

### Passo 2: Executar Backup Completo

```bash
# Criar diretório para backups
mkdir -p ~/venddi-backups
cd ~/venddi-backups

# Data timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup completo (schema + data)
pg_dump \
  "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  --format=custom \
  --file=venddi_backup_${TIMESTAMP}.dump \
  --verbose \
  --no-owner \
  --no-privileges

# Verificar arquivo criado
ls -lh venddi_backup_${TIMESTAMP}.dump
```

**Parâmetros explicados:**
- `--format=custom` - Formato compressível e restaurável
- `--no-owner` - Não preserva ownership (útil para restaurar em outro ambiente)
- `--no-privileges` - Não preserva privilégios
- `--verbose` - Mostra progresso detalhado

### Passo 3: Backup de Dados Específicos (Opcional)

#### Backup Apenas do Schema

```bash
pg_dump \
  "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  --schema-only \
  --file=venddi_schema_${TIMESTAMP}.sql \
  --verbose
```

#### Backup Apenas de Dados

```bash
pg_dump \
  "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  --data-only \
  --format=custom \
  --file=venddi_data_${TIMESTAMP}.dump \
  --verbose
```

#### Backup de Tabelas Específicas

```bash
# Backup apenas de empresas e usuários
pg_dump \
  "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  --table=companies \
  --table=users \
  --format=custom \
  --file=venddi_companies_users_${TIMESTAMP}.dump \
  --verbose
```

### Passo 4: Criptografar Backup

```bash
# Criptografar com GPG
gpg --cipher-algo AES256 --symmetric --output venddi_backup_${TIMESTAMP}.dump.gpg venddi_backup_${TIMESTAMP}.dump

# Ou com OpenSSL
openssl enc -aes-256-cbc -salt -in venddi_backup_${TIMESTAMP}.dump -out venddi_backup_${TIMESTAMP}.dump.enc

# Verificar arquivo criptografado
ls -lh venddi_backup_${TIMESTAMP}.dump.gpg
```

### Passo 5: Verificar Integridade do Backup

```bash
# Verificar arquivo de backup
pg_restore --list venddi_backup_${TIMESTAMP}.dump | head -20

# Contar tabelas no backup
pg_restore --list venddi_backup_${TIMESTAMP}.dump | grep "TABLE" | wc -l

# Esperado: 20+ tabelas
```

### Passo 6: Armazenar Backup em Local Seguro

**Opções recomendadas:**

1. **Storage Local Criptografado**
   ```bash
   # Mover para diretório seguro
   mv venddi_backup_${TIMESTAMP}.dump.gpg ~/secure-backups/venddi/
   
   # Definir permissões restritas
   chmod 600 ~/secure-backups/venddi/venddi_backup_${TIMESTAMP}.dump.gpg
   ```

2. **Cloud Storage (S3, Google Drive, Dropbox)**
   ```bash
   # Exemplo com AWS S3
   aws s3 cp venddi_backup_${TIMESTAMP}.dump.gpg s3://your-bucket/venddi-backups/
   
   # Exemplo com Google Drive (usando rclone)
   rclone copy venddi_backup_${TIMESTAMP}.dump.gpg gdrive:venddi-backups/
   ```

3. **Múltiplas Cópias (Recomendado)**
   - Cópia local criptografada
   - Cópia em cloud storage
   - Cópia em HD externo

---

## 🔄 Procedimento de Restauração

### ⚠️ AVISO CRÍTICO

**NUNCA restaure sobre produção sem:**
1. Backup atualizado do estado atual
2. Autorização expressa do proprietário
3. Ambiente de teste isolado
4. Plano de rollback documentado

### Passo 1: Preparar Ambiente de Teste

**Opção A: Banco Local PostgreSQL**

```bash
# Instalar PostgreSQL local (se necessário)
# Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib

# macOS:
brew install postgresql

# Windows: Download em https://www.postgresql.org/download/windows/

# Criar banco de dados de teste
createdb venddi_test

# Ou via psql
psql -U postgres -c "CREATE DATABASE venddi_test;"
```

**Opção B: Supabase Local (Docker)**

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase start

# Anotar as credenciais
# URL: http://localhost:54322
# User: postgres
# Password: postgres
# Database: postgres
```

### Passo 2: Descriptografar Backup (se necessário)

```bash
# Com GPG
gpg --output venddi_backup_${TIMESTAMP}.dump --decrypt venddi_backup_${TIMESTAMP}.dump.gpg

# Com OpenSSL
openssl enc -aes-256-cbc -d -in venddi_backup_${TIMESTAMP}.dump.enc -out venddi_backup_${TIMESTAMP}.dump
```

### Passo 3: Restaurar no Ambiente de Teste

```bash
# Restaurar no banco local
pg_restore \
  --dbname=postgresql://postgres:postgres@localhost:5432/venddi_test \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  venddi_backup_${TIMESTAMP}.dump
```

**Parâmetros explicados:**
- `--clean` - Remove objetos antes de criar
- `--if-exists` - Não erro se objeto não existir
- `--no-owner` - Não tenta mudar ownership
- `--no-privileges` - Não tenta mudar privilégios

### Passo 4: Validar Restauração

```bash
# Conectar ao banco restaurado
psql -U postgres -d venddi_test

# Verificar tabelas
\dt

# Esperado: 20+ tabelas

# Verificar contagem de registros
SELECT 'companies' as table_name, COUNT(*) as count FROM companies
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales;

# Verificar funções
\df

# Esperado: 12+ funções

# Sair
\q
```

### Passo 5: Testar Aplicação com Banco Restaurado

```bash
# Atualizar .env para apontar para banco de teste
cat > .env.test << EOF
VITE_SUPABASE_URL=http://localhost:54322
VITE_SUPABASE_ANON_KEY=your-anon-key-here
EOF

# Iniciar aplicação
npm run dev

# Testar fluxos críticos:
# 1. Login
# 2. Criar produto
# 3. Realizar venda
# 4. Verificar relatórios
```

---

## 🧪 Validação de Integridade

### Checklist de Validação

- [ ] Todas as tabelas restauradas (20+)
- [ ] Todos os índices criados
- [ ] Todas as funções criadas (12+)
- [ ] Todos os triggers funcionando
- [ ] Policies RLS ativas
- [ ] Dados íntegros (contagens conferem)
- [ ] Foreign keys válidas
- [ ] Constraints funcionando
- [ ] Aplicação conecta ao banco
- [ ] Fluxos críticos funcionam

### Script de Validação Automática

```sql
-- validar_restauracao.sql

-- Verificar tabelas
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
  
  RAISE NOTICE 'Tabelas encontradas: %', table_count;
  
  IF table_count < 20 THEN
    RAISE EXCEPTION 'Número de tabelas insuficiente: %', table_count;
  END IF;
END $$;

-- Verificar funções
DO $$
DECLARE
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION';
  
  RAISE NOTICE 'Funções encontradas: %', function_count;
  
  IF function_count < 12 THEN
    RAISE EXCEPTION 'Número de funções insuficiente: %', function_count;
  END IF;
END $$;

-- Verificar dados críticos
SELECT 
  (SELECT COUNT(*) FROM companies) as companies_count,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM sales) as sales_count;

-- Verificar RLS policies
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public';
```

**Executar validação:**
```bash
psql -U postgres -d venddi_test -f validar_restauracao.sql
```

---

## 📊 Comparação: Backup vs Restauração

### Verificar se Dados Conferem

```bash
# No banco original
psql "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  -c "SELECT 'companies' as table_name, COUNT(*) as count FROM companies
      UNION ALL SELECT 'users', COUNT(*) FROM users
      UNION ALL SELECT 'products', COUNT(*) FROM products
      UNION ALL SELECT 'sales', COUNT(*) FROM sales;" \
  > original_counts.txt

# No banco restaurado
psql -U postgres -d venddi_test \
  -c "SELECT 'companies' as table_name, COUNT(*) as count FROM companies
      UNION ALL SELECT 'users', COUNT(*) FROM users
      UNION ALL SELECT 'products', COUNT(*) FROM products
      UNION ALL SELECT 'sales', COUNT(*) FROM sales;" \
  > restored_counts.txt

# Comparar
diff original_counts.txt restored_counts.txt
```

---

## 🚨 Procedimentos de Emergência

### Cenário 1: Restauração Falhou

**Sintomas:**
- Erros durante pg_restore
- Tabelas faltando
- Dados inconsistentes

**Ação:**
```bash
# 1. Limpar banco de teste
psql -U postgres -c "DROP DATABASE IF EXISTS venddi_test;"
psql -U postgres -c "CREATE DATABASE venddi_test;"

# 2. Tentar restauração novamente com --clean
pg_restore \
  --dbname=postgresql://postgres:postgres@localhost:5432/venddi_test \
  --clean \
  --if-exists \
  --verbose \
  venddi_backup_${TIMESTAMP}.dump

# 3. Se falhar novamente, verificar integridade do backup
pg_restore --list venddi_backup_${TIMESTAMP}.dump | head -50
```

### Cenário 2: Dados Corrompidos Após Restauração

**Sintomas:**
- Aplicação conecta mas dados inconsistentes
- Queries retornam resultados errados
- Foreign keys violadas

**Ação:**
```bash
# 1. Verificar integridade
psql -U postgres -d venddi_test -c "REINDEX DATABASE venddi_test;"

# 2. Verificar constraints
psql -U postgres -d venddi_test << EOF
ALTER TABLE sales VALIDATE CONSTRAINT sales_company_id_fkey;
ALTER TABLE products VALIDATE CONSTRAINT products_company_id_fkey;
-- Repetir para todas as foreign keys
EOF

# 3. Se problemas persistirem, restaurar de backup anterior
```

### Cenário 3: Perda Total do Banco de Produção

**Sintomas:**
- Banco inacessível
- Dados perdidos
- Aplicação não conecta

**Ação:**
```bash
# 1. NÃO PANIC!

# 2. Restaurar backup mais recente
pg_restore \
  --dbname="postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  --clean \
  --if-exists \
  --verbose \
  venddi_backup_${TIMESTAMP}.dump

# 3. Aplicar migrations pendentes (se houver)
supabase db push

# 4. Validar restauração
# (Usar script de validação acima)

# 5. Notificar usuários sobre interrupção
```

---

## 📅 Política de Retenção de Backups

### Recomendação

| Tipo de Backup | Frequência | Retenção | Local |
|----------------|------------|----------|-------|
| **Completo** | Diário | 30 dias | Cloud + Local |
| **Semanal** | Semanal | 12 semanas | Cloud + Local + HD Externo |
| **Mensal** | Mensal | 12 meses | Cloud + HD Externo |
| **Pré-Migration** | Antes de cada migration | Indefinido | Cloud + Local |

### Automação (Cron Job)

```bash
# Crontab: Backup diário às 2h da manhã
0 2 * * * /path/to/backup_script.sh

# backup_script.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/venddi-backups

pg_dump \
  "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres" \
  --format=custom \
  --file=${BACKUP_DIR}/venddi_backup_${TIMESTAMP}.dump \
  --verbose

gpg --cipher-algo AES256 --symmetric \
  --output ${BACKUP_DIR}/venddi_backup_${TIMESTAMP}.dump.gpg \
  ${BACKUP_DIR}/venddi_backup_${TIMESTAMP}.dump

rm ${BACKUP_DIR}/venddi_backup_${TIMESTAMP}.dump

# Remover backups antigos (> 30 dias)
find ${BACKUP_DIR} -name "venddi_backup_*.dump.gpg" -mtime +30 -delete

# Upload para cloud (exemplo com AWS S3)
aws s3 cp ${BACKUP_DIR}/venddi_backup_${TIMESTAMP}.dump.gpg \
  s3://your-bucket/venddi-backups/
```

---

## 📋 Checklist de Backup

### Antes do Backup

- [ ] Verificar espaço em disco (mínimo 2GB)
- [ ] Verificar conexão com banco
- [ ] Notificar usuários (se necessário)
- [ ] Preparar diretório de destino

### Durante o Backup

- [ ] Monitorar progresso (verbose)
- [ ] Verificar não há erros
- [ ] Aguardar conclusão completa

### Após o Backup

- [ ] Verificar tamanho do arquivo
- [ ] Verificar integridade (pg_restore --list)
- [ ] Criptografar backup
- [ ] Armazenar em local seguro
- [ ] Criar cópia adicional (cloud/HD externo)
- [ ] Documentar em log de backups
- [ ] Testar restauração em ambiente isolado

---

## 📊 Métricas de Backup

| Métrica | Valor Esperado |
|---------|----------------|
| **Tamanho do backup** | 10-100 MB (depende dos dados) |
| **Tempo de backup** | 1-5 minutos |
| **Tempo de restauração** | 2-10 minutos |
| **Taxa de compressão** | 60-80% |

---

## 🎯 Próximos Passos

### Imediatos

1. **Obter credenciais do banco**
   - Acessar Supabase Dashboard
   - Copiar connection string
   - Armazenar em local seguro

2. **Executar backup inicial**
   ```bash
   # Seguir Passo 2 do procedimento
   ```

3. **Validar backup**
   ```bash
   # Seguir Passo 5 do procedimento
   ```

4. **Testar restauração**
   ```bash
   # Seguir procedimento de restauração
   ```

### Futuros

5. **Automatizar backups**
   - Configurar cron job
   - Implementar rotação de backups
   - Configurar upload para cloud

6. **Documentar procedimentos**
   - Criar runbook de emergência
   - Treinar equipe em restauração
   - Realizar drills periódicos

---

## 📞 Contato e Suporte

**Problemas com backup:**
- Verificar conexão com banco
- Verificar espaço em disco
- Verificar permissões de arquivo

**Problemas com restauração:**
- Verificar versão do PostgreSQL
- Verificar compatibilidade do backup
- Consultar logs do pg_restore

**Emergências:**
- Restaurar de backup mais recente
- Aplicar migrations pendentes
- Validar integridade dos dados

---

## 📚 Referências

- [PostgreSQL Documentation - pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL Documentation - pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [Supabase Backups](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL Backup Strategies](https://www.postgresql.org/docs/current/backup.html)

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ⏳ Preparado (Aguardando Execução)  
**Próximo passo:** Obter credenciais e executar backup inicial
