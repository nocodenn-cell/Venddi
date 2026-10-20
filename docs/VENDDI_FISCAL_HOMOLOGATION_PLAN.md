# Plano de Homologação — Módulo Fiscal Venddi

**Data:** 2026-10-19  
**Status:** ✅ Pronto para Execução  
**Provedor:** Focus NFe  
**Documento:** NFC-e (Modelo 65)

---

## 📋 Objetivo

Validar o módulo fiscal da Venddi em ambiente de homologação antes de migrar para produção.

---

## 🔧 Pré-requisitos

### 1. Conta Focus NFe

- [ ] Criar conta em https://focusnfe.com.br
- [ ] Obter token de homologação
- [ ] Configurar CNPJ de teste (12345678000123)
- [ ] Configurar CSC de homologação

### 2. Ambiente Local

- [ ] Docker Desktop instalado
- [ ] Supabase CLI instalado
- [ ] Supabase local rodando
- [ ] Migrations 001-009 aplicadas

### 3. Configuração Venddi

- [ ] Token de homologação configurado em `.env`
- [ ] Página de configuração fiscal acessível
- [ ] Dados da empresa preenchidos

---

## 🧪 Cenários de Teste

### Teste 1: Configuração Inicial

**Objetivo:** Validar configuração do provedor fiscal

**Passos:**
1. Acessar `/app/configuracoes/fiscal`
2. Selecionar provedor: Focus NFe
3. Selecionar ambiente: Homologação
4. Informar token da API
5. Preencher dados da empresa
6. Salvar configuração

**Resultado esperado:**
- ✅ Configuração salva com sucesso
- ✅ Status muda para "Configurado"
- ✅ Badge mostra "Homologação"

---

### Teste 2: Emissão de NFC-e Simples

**Objetivo:** Validar emissão básica de NFC-e

**Pré-requisitos:**
- Caixa aberto
- Pelo menos 1 produto com dados fiscais configurados

**Passos:**
1. Abrir caixa
2. Ir para PDV
3. Adicionar 1 produto ao carrinho
4. Finalizar venda (pagamento em dinheiro)
5. Aguardar emissão da NFC-e

**Resultado esperado:**
- ✅ Venda finalizada com sucesso
- ✅ NFC-e emitida (status = autorizado)
- ✅ Chave de acesso gerada
- ✅ QR Code disponível
- ✅ XML e DANFE acessíveis

**Validações:**
```sql
-- Verificar documento fiscal
SELECT * FROM fiscal_documents 
WHERE sale_id = '[sale_id]' 
AND status = 'authorized';

-- Verificar eventos
SELECT * FROM fiscal_events 
WHERE fiscal_document_id = '[document_id]'
ORDER BY created_at DESC;
```

---

### Teste 3: Emissão com Múltiplos Produtos

**Objetivo:** Validar emissão com vários itens

**Passos:**
1. Adicionar 3-5 produtos diferentes
2. Finalizar venda
3. Verificar NFC-e

**Resultado esperado:**
- ✅ Todos os itens na NFC-e
- ✅ Cálculo correto de totais
- ✅ NCM e CFOP corretos para cada item

---

### Teste 4: Pagamento Dividido

**Objetivo:** Validar múltiplas formas de pagamento

**Passos:**
1. Adicionar produtos (total R$ 100,00)
2. Finalizar venda
3. Selecionar pagamento dividido:
   - Dinheiro: R$ 50,00
   - Cartão: R$ 50,00
4. Confirmar

**Resultado esperado:**
- ✅ NFC-e com 2 formas de pagamento
- ✅ Valores corretos
- ✅ Códigos corretos (01 = dinheiro, 03 = cartão)

---

### Teste 5: Consulta de Status

**Objetivo:** Validar consulta de NFC-e emitida

**Passos:**
1. Emitir NFC-e (Teste 2)
2. Consultar status via API
3. Verificar dados retornados

**Resultado esperado:**
- ✅ Status = autorizado
- ✅ Dados completos (completa=1)
- ✅ XML e DANFE acessíveis

---

### Teste 6: Cancelamento de NFC-e

**Objetivo:** Validar cancelamento dentro do prazo

**Pré-requisitos:**
- NFC-e emitida há menos de 30 minutos

**Passos:**
1. Localizar NFC-e emitida
2. Solicitar cancelamento
3. Informar justificativa (mínimo 15 caracteres)
4. Confirmar

**Resultado esperado:**
- ✅ NFC-e cancelada (status = cancelled)
- ✅ Protocolo de cancelamento gerado
- ✅ XML de cancelamento disponível
- ✅ Estoque restaurado
- ✅ Financeiro estornado

**Validações:**
```sql
-- Verificar cancelamento
SELECT status, cancellation_date, cancellation_justification
FROM fiscal_documents
WHERE id = '[document_id]';

-- Verificar evento
SELECT * FROM fiscal_events
WHERE fiscal_document_id = '[document_id]'
AND event_type = 'cancellation_completed';
```

---

### Teste 7: Cancelamento Fora do Prazo

**Objetivo:** Validar erro ao cancelar após 30 minutos

**Pré-requisitos:**
- NFC-e emitida há mais de 30 minutos (ou simular)

**Passos:**
1. Tentar cancelar NFC-e antiga
2. Verificar mensagem de erro

**Resultado esperado:**
- ❌ Erro: "Prazo de cancelamento expirado"
- ✅ Status permanece "authorized"
- ✅ Evento de erro registrado

---

### Teste 8: Inutilização de Numeração

**Objetivo:** Validar inutilização de faixa de números

**Passos:**
1. Acessar configuração fiscal
2. Solicitar inutilização
3. Informar série: 1
4. Informar faixa: 100-105
5. Informar justificativa

**Resultado esperado:**
- ✅ Inutilização autorizada
- ✅ Protocolo gerado
- ✅ XML disponível

---

### Teste 9: Contingência Offline

**Objetivo:** Validar emissão em contingência

**Pré-requisitos:**
- Simular indisponibilidade da SEFAZ

**Passos:**
1. Emitir NFC-e com forma_emissao=offline
2. Informar numero, serie, codigo_unico
3. Verificar resposta

**Resultado esperado:**
- ✅ NFC-e emitida em contingência
- ✅ Status = contingency
- ✅ contingencia_offline = true
- ✅ Posterior efetivação possível

---

### Teste 10: Idempotência

**Objetivo:** Validar prevenção de emissão duplicada

**Passos:**
1. Emitir NFC-e com reference = "test_123"
2. Tentar emitir novamente com mesma reference
3. Verificar resposta

**Resultado esperado:**
- ✅ Primeira emissão: sucesso
- ✅ Segunda emissão: retorna mesma NFC-e
- ✅ Status = "already_processed" ou similar

---

### Teste 11: Erros de Validação

**Objetivo:** Validar tratamento de erros

**Cenários:**

**11.1 - CNPJ inválido:**
- Informar CNPJ inválido
- Resultado: Erro de validação

**11.2 - NCM inválido:**
- Produto com NCM fora do formato
- Resultado: Erro de validação

**11.3 - CFOP inválido:**
- Produto com CFOP inválido
- Resultado: Erro de validação

**11.4 - Data de emissão futura:**
- Manipular data_emissao para futuro
- Resultado: Rejeição SEFAZ (código 704)

---

### Teste 12: Multi-tenancy

**Objetivo:** Validar isolamento entre empresas

**Passos:**
1. Criar Empresa A e Empresa B
2. Emitir NFC-e para Empresa A
3. Tentar consultar com token da Empresa B

**Resultado esperado:**
- ✅ Empresa A vê apenas suas NFC-e
- ✅ Empresa B não vê NFC-e da Empresa A
- ✅ Erro de permissão se tentar acessar

---

### Teste 13: Webhooks

**Objetivo:** Validar recepção de webhooks

**Pré-requisitos:**
- Webhook configurado na Focus NFe
- Endpoint público acessível

**Passos:**
1. Configurar webhook URL
2. Emitir NFC-e
3. Aguardar webhook
4. Verificar recepção

**Resultado esperado:**
- ✅ Webhook recebido
- ✅ Status atualizado
- ✅ Evento registrado

---

### Teste 14: Reconciliação

**Objetivo:** Validar reconciliação de documentos

**Passos:**
1. Emitir 10 NFC-e
2. Consultar todas via API
3. Comparar com banco local
4. Identizar divergências

**Resultado esperado:**
- ✅ Todos os documentos conciliados
- ✅ Status consistente
- ✅ Nenhuma divergência

---

### Teste 15: Performance

**Objetivo:** Validar performance sob carga

**Passos:**
1. Emitir 50 NFC-e em sequência
2. Medir tempo médio de resposta
3. Verificar taxa de sucesso

**Resultado esperado:**
- ✅ Tempo médio < 5 segundos
- ✅ Taxa de sucesso > 95%
- ✅ Sem erros de rate limit

---

## 📊 Critérios de Aceite

### Funcionais

- [ ] Emissão de NFC-e funcionando
- [ ] Consulta de status funcionando
- [ ] Cancelamento funcionando (dentro do prazo)
- [ ] Inutilização de numeração funcionando
- [ ] Contingência offline funcionando
- [ ] Webhooks recebidos corretamente
- [ ] Idempotência garantida
- [ ] Multi-tenancy isolado

### Não-funcionais

- [ ] Tempo de resposta < 5 segundos
- [ ] Taxa de sucesso > 95%
- [ ] Logs sem credenciais
- [ ] Erros tratados adequadamente
- [ ] Auditoria completa

### Segurança

- [ ] Tokens criptografados
- [ ] RLS policies funcionando
- [ ] Validação de propriedade
- [ ] Sem exposição de credenciais

---

## 🐛 Bugs Conhecidos e Workarounds

### Bug 1: Timeout em Emissões Lentas
**Sintoma:** API demora mais de 30 segundos  
**Workaround:** Implementar retry com backoff

### Bug 2: Webhook Perdido
**Sintoma:** Webhook não recebido  
**Workaround:** Endpoint de reconciliação para consultar status

---

## 📝 Checklist Final

### Antes de Migrar para Produção

- [ ] Todos os 15 testes aprovados
- [ ] Performance validada
- [ ] Segurança auditada
- [ ] Documentação atualizada
- [ ] Equipe treinada
- [ ] Token de produção obtido
- [ ] CSC de produção configurado
- [ ] Plano de rollback definido

---

## 🚀 Plano de Rollback

### Cenário: Falha Crítica em Produção

**Passos:**
1. Desativar emissão de NFC-e
2. Reverter para modo não-fiscal
3. Notificar clientes
4. Investigar causa raiz
5. Corrigir e testar em homologação
6. Reativar em produção

---

## 📞 Contato e Suporte

- **Focus NFe Suporte:** suporte@focusnfe.com.br
- **Documentação:** https://doc.focusnfe.com.br
- **Status Page:** https://status.focusnfe.com.br

---

**Plano elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ✅ Pronto para execução
