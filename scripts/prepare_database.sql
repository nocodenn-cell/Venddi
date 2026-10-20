-- Script de Preparação do Banco de Dados Venddi
-- Execute este script no Supabase SQL Editor ANTES de aplicar as migrations
-- Data: 2026-10-19

-- ============================================
-- PASSO 1: Habilitar extensões necessárias
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Verificar se as funções estão disponíveis
DO $$
BEGIN
  RAISE NOTICE 'Testando uuid_generate_v4()...';
  PERFORM uuid_generate_v4();
  RAISE NOTICE 'uuid_generate_v4() está disponível';
  
  RAISE NOTICE 'Testando gen_random_uuid()...';
  PERFORM gen_random_uuid();
  RAISE NOTICE 'gen_random_uuid() está disponível';
  
  RAISE NOTICE 'Ambas as funções UUID estão disponíveis!';
END $$;

-- ============================================
-- PASSO 2: Criar função helper para updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PASSO 3: Verificar estado atual do banco
-- ============================================
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
  
  RAISE NOTICE 'Tabelas existentes no banco: %', table_count;
  
  IF table_count > 0 THEN
    RAISE NOTICE 'ATENÇÃO: O banco já contém tabelas. Verifique se deseja continuar.';
  ELSE
    RAISE NOTICE 'Banco vazio. Pronto para aplicar migrations.';
  END IF;
END $$;

-- ============================================
-- PASSO 4: Listar tabelas existentes (se houver)
-- ============================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- INSTRUÇÕES
-- ============================================
-- Após executar este script com sucesso:
-- 1. Verifique se não há erros nas mensagens
-- 2. Execute: supabase db push
-- 3. Ou aplique as migrations manualmente via SQL Editor
