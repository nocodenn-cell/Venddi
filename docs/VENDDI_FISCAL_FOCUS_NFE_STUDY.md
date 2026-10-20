# Estudo Técnico — API Focus NFe

**Data:** 2026-10-19  
**Status:** ✅ Concluído  
**Foco:** NFC-e (Nota Fiscal de Consumidor Eletrônica)

---

## 📋 Resumo Executivo

A Focus NFe é uma API REST que permite emitir documentos fiscais eletrônicos sem necessidade de certificado digital local. A API cuida da assinatura digital e comunicação com a SEFAZ.

**Vantagens para a Venddi:**
- ✅ Não precisa gerenciar certificado digital A1
- ✅ API síncrona para NFC-e (resposta imediata)
- ✅ Suporte a contingência offline
- ✅ Webhooks para notificações
- ✅ Ambientes de homologação e produção
- ✅ Documentação completa e examples

---

## 🔐 Autenticação

### Método: HTTP Basic Auth

```
Authorization: Basic base64(token:)
```

- **Usuário:** Token da empresa (gerado no painel Focus NFe)
- **Senha:** Vazia (string vazia)

### Exemplo cURL
```bash
curl -u 'SEU_TOKEN_AQUI:' \
  https://api.focusnfe.com.br/v2/nfce?ref=12345
```

### Exemplo JavaScript
```javascript
const token = 'SEU_TOKEN_AQUI';
const auth = btoa(token + ':');

fetch('https://api.focusnfe.com.br/v2/nfce?ref=12345', {
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 🌐 Ambientes

| Ambiente | URL Base | Uso |
|----------|----------|-----|
| **Homologação** | `https://homologacao.focusnfe.com.br/v2` | Testes (sem validade fiscal) |
| **Produção** | `https://api.focusnfe.com.br/v2` | Emissão real (validade fiscal) |

**Importante:** O token é diferente para cada ambiente.

---

## 📄 NFC-e — Nota Fiscal de Consumidor Eletrônica

### Características

- **Processamento:** Síncrono (resposta imediata)
- **Prazo de cancelamento:** 30 minutos após emissão
- **Modelo:** 65
- **Numeração:** Automática (ou manual)
- **Contingência:** Offline suportada

### Endpoints Principais

#### 1. Emitir NFC-e

**Endpoint:** `POST /v2/nfce?ref={referencia}`

**Parâmetros Query:**
- `ref` (obrigatório): Referência única no seu sistema
- `completa` (opcional): 0 ou 1 (retorna dados completos)
- `forma_emissao` (opcional): "offline" para contingência

**Campos Obrigatórios do Body:**

```json
{
  "cnpj_emitente": "12345678000123",
  "data_emissao": "2026-10-19T13:54:31-03:00",
  "presenca_comprador": "1",
  "modalidade_frete": "9",
  "local_destino": "1",
  "natureza_operacao": "VENDA AO CONSUMIDOR",
  "items": [...],
  "formas_pagamento": [...]
}
```

**Estrutura do Item:**

```json
{
  "numero_item": "1",
  "codigo_ncm": "62044200",
  "codigo_produto": "251887",
  "descricao": "CAMISETA BASICA",
  "quantidade_comercial": 1,
  "quantidade_tributavel": 1,
  "cfop": "5102",
  "valor_unitario_comercial": 79.00,
  "valor_unitario_tributavel": 79.00,
  "valor_bruto": 79.00,
  "unidade_comercial": "UN",
  "unidade_tributavel": "UN",
  "icms_origem": "0",
  "icms_situacao_tributaria": "102"
}
```

**Estrutura da Forma de Pagamento:**

```json
{
  "forma_pagamento": "01",
  "valor_pagamento": 79.00
}
```

**Códigos de Forma de Pagamento:**
- `01` - Dinheiro
- `02` - Cheque
- `03` - Cartão de Crédito
- `04` - Cartão de Débito
- `05` - Crédito Loja
- `10` - Vale Alimentação
- `11` - Vale Refeição
- `12` - Vale Presente
- `13` - Vale Combustível
- `14` - Boleto Bancário
- `15` - Depósito Bancário
- `16` - PIX
- `17` - Transferência Bancária
- `18` - Cartão de Crédito (aplicativo)
- `19` - Cartão de Débito (aplicativo)
- `90` - Sem Pagamento (brinde, cortesia)
- `99` - Outros

**Resposta de Sucesso (201):**

```json
{
  "cnpj_emitente": "12345678000123",
  "ref": "venda_12345",
  "status": "autorizado",
  "status_sefaz": "100",
  "mensagem_sefaz": "Autorizado o uso da NF-e",
  "chave_nfe": "NFe41190612345678000123650010000000121743484310",
  "numero": "12",
  "serie": "1",
  "caminho_xml_nota_fiscal": "/arquivos/...",
  "caminho_danfe": "/notas_fiscais_consumidor/...",
  "qrcode_url": "http://www.fazenda.pr.gov.br/nfce/qrcode/?...",
  "url_consulta_nf": "http://www.fazenda.pr.gov.br/nfce/consulta"
}
```

**Resposta de Erro (422):**

```json
{
  "cnpj_emitente": "12345678000123",
  "ref": "venda_12345",
  "status": "erro_autorizacao",
  "status_sefaz": "704",
  "mensagem_sefaz": "Rejeição: NFC-e com Data-Hora de emissão atrasada"
}
```

#### 2. Consultar NFC-e

**Endpoint:** `GET /v2/nfce/{referencia}`

**Parâmetros Query:**
- `completa` (opcional): 0 ou 1

**Resposta:**

```json
{
  "cnpj_emitente": "12345678000123",
  "ref": "venda_12345",
  "status": "autorizado",
  "status_sefaz": "100",
  "mensagem_sefaz": "Autorizado o uso da NF-e",
  "chave_nfe": "NFe41190612345678000123650010000000121743484310",
  "numero": "12",
  "serie": "1",
  "caminho_xml_nota_fiscal": "/arquivos/...",
  "caminho_danfe": "/notas_fiscais_consumidor/...",
  "qrcode_url": "http://...",
  "url_consulta_nf": "http://..."
}
```

**Status Possíveis:**
- `autorizado` - NFC-e autorizada pela SEFAZ
- `erro_autorizacao` - NFC-e rejeitada
- `denegado` - NFC-e denegada
- `cancelado` - NFC-e cancelada
- `processando_autorizacao` - Em processamento

#### 3. Cancelar NFC-e

**Endpoint:** `DELETE /v2/nfce/{referencia}`

**Body:**

```json
{
  "justificativa": "Cancelamento por erro de digitação"
}
```

**Restrições:**
- Apenas NFC-e autorizadas
- Prazo máximo: 30 minutos após emissão
- Justificativa: 15 a 255 caracteres

**Resposta:**

```json
{
  "status": "cancelado",
  "status_sefaz": "135",
  "mensagem_sefaz": "Evento registrado e vinculado a NF-e",
  "caminho_xml_cancelamento": "/arquivos/...",
  "numero_protocolo": "123456789"
}
```

#### 4. Inutilizar Numeração

**Endpoint:** `POST /v2/nfce/inutilizacao`

**Body:**

```json
{
  "cnpj": "12345678000123",
  "serie": "1",
  "numero_inicial": "100",
  "numero_final": "105",
  "justificativa": "Numeração não utilizada"
}
```

**Uso:** Quando números foram pulados ou não utilizados

#### 5. Enviar por Email

**Endpoint:** `POST /v2/nfce/{referencia}/email`

**Body:**

```json
{
  "emails": ["cliente@email.com"]
}
```

**Limite:** 10 emails por requisição

---

## 🏷️ Campos Fiscais dos Produtos

### NCM (Nomenclatura Comum do Mercosul)

- **Obrigatório:** Sim
- **Formato:** 8 dígitos
- **Exemplo:** `62044200` (Vestuário)
- **Consulta:** API Focus NFe possui endpoint `/ncm`

### CFOP (Código Fiscal de Operações e Prestações)

- **Obrigatório:** Sim
- **Formato:** 4 dígitos
- **Exemplos comuns:**
  - `5102` - Venda de mercadoria (SP)
  - `6102` - Venda de mercadoria (outro estado)
  - `5405` - Venda de mercadoria sujeita a ST
  - `5949` - Outras saídas

### CST/CSOSN (Código de Situação Tributária)

**Para empresas do Simples Nacional (CSOSN):**
- `101` - Tributada com permissão de crédito
- `102` - Tributada sem permissão de crédito
- `103` - Isenção do ICMS para faixa de receita
- `201` - Tributada com permissão de crédito e com cobrança do ICMS por ST
- `202` - Tributada sem permissão de crédito e com cobrança do ICMS por ST
- `300` - Imune
- `400` - Não tributada pela SEFAZ
- `500` - ICMS cobrado anteriormente por ST ou por antecipação
- `900` - Outros

**Para empresas do Lucro Presumido/Real (CST):**
- `00` - Tributada integralmente
- `10` - Tributada e com cobrança do ICMS por ST
- `20` - Com redução de base de cálculo
- `30` - Isenta ou não tributada e com cobrança do ICMS por ST
- `40` - Isenta
- `41` - Não tributada
- `50` - Suspensão
- `51` - Diferimento
- `60` - ICMS cobrado anteriormente por ST
- `70` - Com redução de base de cálculo e cobrança do ICMS por ST
- `90` - Outras

### ICMS Origem

- `0` - Nacional (exceto TI I)
- `1` - Estrangeira (importação direta)
- `2` - Estrangeira (adquirida no mercado interno)
- `3` - Nacional (conteúdo de importação > 40%)
- `4` - Nacional (processos produtivos básicos)
- `5` - Estrangeira (importação direta > 40%)
- `6` - Estrangeira (adquirida no mercado interno > 40%)
- `7` - Nacional (conteúdo de importação > 70%)
- `8` - Nacional (conteúdo de importação > 80%)

---

## 🔄 Contingência Offline

### Quando Usar

- SEFAZ indisponível
- Problemas de conexão
- Falha na comunicação com a API

### Como Funciona

1. Emitir com `forma_emissao=offline`
2. Informar `numero`, `serie` e `codigo_unico`
3. NFC-e é emitida localmente
4. Posterior efetivação na SEFAZ

### Efetivação

**Endpoint:** `POST /v2/nfce/{referencia}/efetivar`

---

## 🎣 Webhooks

### Configuração

**Endpoint:** `POST /v2/webhooks`

**Body:**

```json
{
  "url": "https://sua-api.com/webhooks/focusnfe",
  "eventos": ["nfce.autorizada", "nfce.cancelada"]
}
```

### Eventos Disponíveis

- `nfce.autorizada` - NFC-e autorizada
- `nfce.cancelada` - NFC-e cancelada
- `nfce.erro_autorizacao` - Erro na autorização
- `nfce.denegada` - NFC-e denegada

### Payload do Webhook

```json
{
  "evento": "nfce.autorizada",
  "ref": "venda_12345",
  "cnpj_emitente": "12345678000123",
  "status": "autorizado",
  "chave_nfe": "NFe41190612345678000123650010000000121743484310",
  "numero": "12",
  "serie": "1"
}
```

---

## 📊 Status e Códigos SEFAZ

### Status da API Focus

- `autorizado` - Documento autorizado
- `erro_autorizacao` - Erro na autorização
- `cancelado` - Documento cancelado
- `denegado` - Documento denegado
- `processando_autorizacao` - Em processamento

### Códigos SEFAZ Comuns

- `100` - Autorizado o uso da NF-e
- `101` - Cancelamento de NF-e homologado
- `135` - Evento registrado e vinculado a NF-e
- `204` - Duplicidade de NF-e
- `205` - NF-e denegada
- `207` - NF-e denegada (erro de validação)
- `301` - Uso denegado (irregularidade fiscal)
- `302` - Uso denegado (erro de validação)
- `704` - Rejeição: Data-Hora de emissão atrasada
- `705` - Rejeição: Data-Hora de emissão futura

---

## 🔒 Segurança

### Boas Práticas

1. **Nunca expor o token no frontend**
   - Token deve ficar apenas no backend
   - Usar variáveis de ambiente

2. **Logs sem credenciais**
   - Não logar o token
   - Não logar dados sensíveis

3. **HTTPS obrigatório**
   - Todas as chamadas devem ser HTTPS
   - Validar certificado SSL

4. **Idempotência**
   - Usar `ref` único para cada emissão
   - Verificar status antes de reemitir

5. **Rate Limit**
   - Respeitar limites da API
   - Implementar retry com backoff

---

## 💰 Custos (Estimativa)

### Plano Focus NFe (valores aproximados)

| Volume | Custo por NFC-e |
|--------|-----------------|
| 1-1.000 | R$ 0,30 |
| 1.001-5.000 | R$ 0,25 |
| 5.001-10.000 | R$ 0,20 |
| 10.001+ | R$ 0,15 |

### Estimativa para Loja Pequena

**Cenário:** Loja com 100 vendas/dia

- **Mensal:** 3.000 NFC-e
- **Custo unitário:** R$ 0,25
- **Custo mensal:** R$ 750,00
- **Custo por venda:** R$ 0,25

**Impacto no preço do plano Venddi:**
- Plano Starter (R$ 79/mês): Incluir até 500 NFC-e
- Plano Professional (R$ 149/mês): Incluir até 2.000 NFC-e
- Plano Business (R$ 249/mês): Incluir até 5.000 NFC-e
- Acima do limite: R$ 0,30 por NFC-e adicional

---

## 🧪 Homologação

### Credenciais de Teste

A Focus NFe fornece credenciais de teste para homologação:
- **URL:** `https://homologacao.focusnfe.com.br/v2`
- **Token:** Fornecido após cadastro
- **CNPJ de teste:** `12345678000123`

### Fluxo de Teste

1. Cadastrar empresa em homologação
2. Obter token de teste
3. Emitir NFC-e de teste
4. Consultar status
5. Cancelar NFC-e (se necessário)
6. Validar XML e DANFCe

---

## 📝 Checklist de Implementação

### Pré-requisitos

- [ ] Conta criada na Focus NFe
- [ ] Token de homologação obtido
- [ ] CNPJ da empresa cadastrado
- [ ] Certificado digital A1 configurado (na Focus)
- [ ] CSC (Código de Segurança do Contribuinte) configurado

### Desenvolvimento

- [ ] Implementar cliente HTTP com Basic Auth
- [ ] Implementar emissão de NFC-e
- [ ] Implementar consulta de status
- [ ] Implementar cancelamento
- [ ] Implementar inutilização de numeração
- [ ] Implementar webhooks (recepção)
- [ ] Implementar contingência offline
- [ ] Implementar reconciliação

### Testes

- [ ] Testar emissão em homologação
- [ ] Testar cancelamento
- [ ] Testar consulta
- [ ] Testar webhooks
- [ ] Testar contingência
- [ ] Testar erros e rejeições
- [ ] Testar idempotência

### Produção

- [ ] Obter token de produção
- [ ] Configurar CSC de produção
- [ ] Testar emissão em produção
- [ ] Configurar webhooks de produção
- [ ] Monitorar primeiros dias

---

## 🎯 Próximos Passos

1. **Criar conta na Focus NFe** (homologação)
2. **Obter token de teste**
3. **Implementar cliente HTTP**
4. **Implementar emissão básica**
5. **Testar em homologação**
6. **Implementar interface de configuração**
7. **Integrar com PDV**
8. **Testar fluxo completo**
9. **Migrar para produção**

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ✅ Estudo técnico concluído
