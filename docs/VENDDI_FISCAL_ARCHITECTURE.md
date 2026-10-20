# Arquitetura do Módulo Fiscal — Venddi

**Data:** 2026-10-19  
**Status:** ✅ Concluído  
**Provedor:** Focus NFe  
**Documento:** NFC-e (Modelo 65)

---

## 📋 Visão Geral

O módulo fiscal da Venddi é responsável pela emissão de documentos fiscais eletrônicos (NFC-e) através da API Focus NFe. O módulo foi projetado para ser:

- **Independente:** Não acopla o PDV ao provedor fiscal
- **Seguro:** Credenciais armazenadas com segurança
- **Auditável:** Histórico completo de eventos
- **Resiliente:** Suporte a contingência e reconciliação
- **Multi-tenant:** Isolamento por empresa

---

## 🏗️ Arquitetura

### Camadas

```
┌─────────────────────────────────────────┐
│         Interface (React)               │
│  - Configuração Fiscal                  │
│  - Emissão de NFC-e                     │
│  - Consulta e Cancelamento              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Serviço de Domínio (FiscalService) │
│  - Lógica de negócio                    │
│  - Validações                           │
│  - Orquestração                         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Adaptador (FocusNFeProvider)          │
│  - Comunicação com API externa          │
│  - Mapeamento de dados                  │
│  - Tratamento de erros                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      API Focus NFe (Externa)            │
│  - Emissão de documentos                │
│  - Consulta de status                   │
│  - Cancelamento                         │
│  - Webhooks                             │
└─────────────────────────────────────────┘
```

### Componentes

#### 1. FiscalService (Camada de Domínio)

**Responsabilidades:**
- Orquestrar emissão de NFC-e
- Validar dados fiscais
- Gerar referência única (idempotência)
- Criar registros de documentos fiscais
- Registrar eventos de auditoria

**Métodos principais:**
- `emitNfceForSale()` - Emitir NFC-e para uma venda
- `cancelNfce()` - Cancelar NFC-e
- `consultNfce()` - Consultar status
- `buildNfceRequest()` - Construir payload para API

#### 2. FocusNFeProvider (Adaptador)

**Responsabilidades:**
- Comunicar com API Focus NFe
- Autenticar requisições (Basic Auth)
- Mapear dados entre formatos
- Tratar erros e respostas

**Métodos:**
- `emitNfce()` - POST /v2/nfce
- `consultNfce()` - GET /v2/nfce/{ref}
- `cancelNfce()` - DELETE /v2/nfce/{ref}
- `inutilizeNumbers()` - POST /v2/nfce/inutilizacao
- `sendNfceByEmail()` - POST /v2/nfce/{ref}/email

#### 3. MockFiscalProvider (Testes)

**Responsabilidades:**
- Simular comportamento da API
- Permitir testes sem credenciais reais
- Retornar respostas previsíveis

---

## 🗄️ Modelo de Dados

### Tabelas

#### 1. fiscal_configurations

**Propósito:** Configuração fiscal por empresa

**Campos principais:**
- `company_id` - Vínculo com empresa
- `provider` - Provedor fiscal (focus_nfe)
- `environment` - Ambiente (homologacao/producao)
- `api_token` - Token da API (criptografado)
- `cnpj` - CNPJ do emitente
- `tax_regime` - Regime tributário
- `csc` - Código de Segurança do Contribuinte
- `nfce_series` - Série da NFC-e

**Índices:**
- `company_id` - Busca por empresa
- `cnpj` - Busca por CNPJ
- `is_active` - Filtro de configurações ativas

#### 2. product_fiscal_data

**Propósito:** Dados fiscais dos produtos

**Campos principais:**
- `product_id` - Vínculo com produto
- `ncm` - NCM (8 dígitos)
- `cfop` - CFOP (4 dígitos)
- `icms_origin` - Origem da mercadoria
- `icms_cst` - CST/CSOSN do ICMS
- `pis_cst` - CST do PIS
- `cofins_cst` - CST do COFINS

**Índices:**
- `product_id` - Busca por produto
- `ncm` - Busca por NCM
- `cfop` - Busca por CFOP

#### 3. fiscal_documents

**Propósito:** Registro de documentos fiscais emitidos

**Campos principais:**
- `sale_id` - Vínculo com venda
- `document_type` - Tipo (nfce)
- `reference` - Referência única (UUID)
- `number` - Número da NFC-e
- `series` - Série
- `access_key` - Chave de acesso
- `status` - Status (pending, authorized, cancelled, etc.)
- `sefaz_status` - Status na SEFAZ
- `protocol_number` - Protocolo de autorização
- `xml_path` - Caminho do XML
- `danfe_path` - Caminho do DANFE
- `qrcode_url` - URL do QR Code

**Índices:**
- `sale_id` - Busca por venda
- `reference` - Busca por referência (idempotência)
- `access_key` - Busca por chave de acesso
- `status` - Filtro por status

#### 4. fiscal_events

**Propósito:** Log de eventos fiscais (auditoria)

**Campos principais:**
- `fiscal_document_id` - Vínculo com documento
- `event_type` - Tipo de evento
- `status` - Status após evento
- `sefaz_status` - Status SEFAZ
- `error_message` - Mensagem de erro
- `webhook_payload` - Payload do webhook

**Índices:**
- `fiscal_document_id` - Busca por documento
- `event_type` - Filtro por tipo
- `created_at` - Ordenação cronológica

---

## 🔐 Segurança

### Credenciais

1. **Token da API Focus NFe**
   - Armazenado criptografado no banco
   - Nunca exposto no frontend
   - Usado apenas no backend (Edge Functions)

2. **CSC (Código de Segurança do Contribuinte)**
   - Armazenado criptografado
   - Obtido na SEFAZ
   - Obrigatório para NFC-e

### Multi-tenancy

- Todas as tabelas têm `company_id`
- RLS policies garantem isolamento
- Validações de propriedade em todas as operações

### Idempotência

- Cada emissão usa `reference` único (UUID)
- Previne emissões duplicadas
- Permite reconciliação

---

## 🔄 Fluxos de Negócio

### Fluxo 1: Emissão de NFC-e

```
1. Venda finalizada no PDV
   ↓
2. FiscalService.emitNfceForSale()
   ↓
3. Validar dados fiscais dos produtos
   ↓
4. Gerar referência única (UUID)
   ↓
5. Construir payload NFC-e
   ↓
6. FocusNFeProvider.emitNfce()
   ↓
7. API Focus NFe processa
   ↓
8. Resposta síncrona (autorizado/erro)
   ↓
9. Criar registro em fiscal_documents
   ↓
10. Registrar evento em fiscal_events
    ↓
11. Retornar resultado ao PDV
```

### Fluxo 2: Cancelamento de NFC-e

```
1. Usuário solicita cancelamento
   ↓
2. Validar prazo (30 minutos)
   ↓
3. FiscalService.cancelNfce()
   ↓
4. FocusNFeProvider.cancelNfce()
   ↓
5. API Focus NFe processa
   ↓
6. Resposta síncrona
   ↓
7. Atualizar fiscal_documents (status = cancelled)
   ↓
8. Registrar evento
   ↓
9. Reverter estoque e financeiro
```

### Fluxo 3: Contingência Offline

```
1. SEFAZ indisponível
   ↓
2. Emitir com forma_emissao=offline
   ↓
3. Informar numero, serie, codigo_unico
   ↓
4. NFC-e emitida localmente
   ↓
5. Status = contingency
   ↓
6. Posterior efetivação na SEFAZ
```

### Fluxo 4: Webhook

```
1. Focus NFe envia webhook
   ↓
2. Edge Function recebe
   ↓
3. Validar assinatura
   ↓
4. Buscar fiscal_document por reference
   ↓
5. Atualizar status
   ↓
6. Registrar evento
```

---

## 🧪 Testes

### Testes Unitários

**Arquivo:** `src/lib/__tests__/fiscal.test.ts`

**Cobertura:**
- Validação de CNPJ
- Mapeamento de formas de pagamento
- Construção de payload NFC-e
- Tratamento de erros

### Testes de Integração

**Arquivo:** `supabase/tests/fiscal_integration_tests.sql`

**Cenários:**
- Emissão de NFC-e com dados válidos
- Consulta de status
- Cancelamento dentro do prazo
- Cancelamento fora do prazo (erro)
- Inutilização de numeração
- Idempotência (mesma referência)
- Isolamento multi-tenant

### Testes com Mock

**Provider:** `MockFiscalProvider`

**Uso:**
- Testes unitários sem API real
- Desenvolvimento local
- CI/CD

---

## 📊 Monitoramento

### Métricas

- Taxa de sucesso de emissão
- Tempo médio de resposta da API
- Número de cancelamentos
- Erros mais comuns
- Uso de contingência

### Logs

- Todas as chamadas à API são logadas
- Erros são registrados com detalhes
- Webhooks recebidos são auditados

### Alertas

- Falha consecutiva na emissão
- Tempo de resposta elevado
- Erros de validação frequentes

---

## 🚀 Deploy

### Pré-requisitos

1. **Conta Focus NFe**
   - Cadastro em https://focusnfe.com.br
   - Obter token de homologação
   - Configurar certificado digital

2. **CSC (Código de Segurança)**
   - Solicitar na SEFAZ do estado
   - Configurar no painel Focus NFe

3. **Variáveis de Ambiente**
   ```env
   FOCUS_NFE_TOKEN_HOMOLOGACAO=xxx
   FOCUS_NFE_TOKEN_PRODUCAO=xxx
   ```

### Checklist de Deploy

- [ ] Conta Focus NFe criada
- [ ] Token de homologação obtido
- [ ] CSC configurado
- [ ] Migrations aplicadas
- [ ] Edge Functions deployadas
- [ ] Webhooks configurados
- [ ] Testes em homologação aprovados
- [ ] Token de produção obtido
- [ ] Testes em produção aprovados

---

## 💰 Custos

### Focus NFe

| Volume | Custo por NFC-e |
|--------|-----------------|
| 1-1.000 | R$ 0,30 |
| 1.001-5.000 | R$ 0,25 |
| 5.001-10.000 | R$ 0,20 |
| 10.001+ | R$ 0,15 |

### Estimativa Venddi

**Cenário:** Loja com 100 vendas/dia

- **Mensal:** 3.000 NFC-e
- **Custo Focus:** R$ 750,00
- **Custo por venda:** R$ 0,25

**Modelo de cobrança Venddi:**
- Plano Starter (R$ 79): 500 NFC-e inclusas
- Plano Professional (R$ 149): 2.000 NFC-e inclusas
- Plano Business (R$ 249): 5.000 NFC-e inclusas
- Acima do limite: R$ 0,30 por NFC-e

---

## 📝 Próximos Passos

### Imediatos

1. **Criar conta Focus NFe** (homologação)
2. **Obter token de teste**
3. **Implementar testes com MockFiscalProvider**
4. **Testar fluxo completo em homologação**

### Curto Prazo

1. **Integrar com PDV**
2. **Implementar interface de configuração**
3. **Testar com loja piloto**
4. **Ajustar configuração tributária**

### Médio Prazo

1. **Migrar para produção**
2. **Implementar webhooks**
3. **Configurar monitoramento**
4. **Treinar equipe de suporte**

---

## 📚 Referências

- **Documentação Focus NFe:** https://doc.focusnfe.com.br
- **API Reference:** https://doc.focusnfe.com.br/reference/introducao
- **Guides:** https://doc.focusnfe.com.br/docs/por-onde-comecar.md
- **Suporte:** suporte@focusnfe.com.br

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ✅ Arquitetura concluída
