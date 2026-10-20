# Venddi — Análise Funcional Baseada em Referências de Mercado

**Data:** 2026-10-19  
**Status:** Concluída  
**Fontes:** Documentação pública de ERPs/PDVs brasileiros

---

## 📋 Resumo Executivo

Este documento apresenta a análise funcional de processos de Vendas, Frente de Caixa e Financeiro baseada em referências de mercado (Bling, ContaAzul, e outros PDVs brasileiros), com o objetivo de implementar funcionalidades equivalentes na Venddi, mantendo arquitetura e experiência próprias.

**Importante:** Esta análise é baseada em documentação pública e conhecimento geral de PDVs. Não reproduz código proprietário nem infraestrutura interna de nenhum sistema.

---

## 🛒 1. VENDAS (PDV - Ponto de Venda)

### 1.1 Fluxo Completo da Venda Presencial

#### Objetivo do Usuário
Realizar uma venda física de forma rápida, precisa e com registro adequado.

#### Etapas Observadas

**1. Abertura do Caixa**
- Operador seleciona a loja/unidade
- Informa valor inicial (fundo de troco)
- Sistema registra abertura com timestamp e operador
- Campos de venda são liberados

**2. Inserção de Produtos**
- Busca por nome, SKU ou código de barras
- Leitor de código de barras (opcional)
- Definição de quantidade
- Aplicação de desconto por item (% ou R$)
- Visualização de subtotal
- Comentários opcionais por item

**3. Inserção de Cliente (Opcional)**
- Venda como "Consumidor Final" (sem dados)
- Busca por cliente cadastrado
- Cadastro rápido de novo cliente
- Dados opcionais: nome, CPF, telefone

**4. Formas de Pagamento**
- Dinheiro (com cálculo de troco)
- Cartão de crédito (à vista ou parcelado)
- Cartão de débito
- PIX
- Múltiplas formas de pagamento na mesma venda
- Desconto geral na venda (% ou R$)
- Acréscimo geral na venda (% ou R$)

**5. Finalização**
- Geração de NFC-e (Nota Fiscal de Consumidor) OU
- Impressão de comprovante não fiscal
- Atualização automática do estoque
- Registro financeiro (contas a receber)
- Movimentação de caixa

**6. Histórico**
- Listagem de vendas do caixa atual
- Edição de vendas não finalizadas
- Cancelamento de vendas (com permissão)
- Visualização de vendas dos últimos 30 dias

#### Campos Necessários

**Produto:**
- ID do produto
- Nome
- SKU
- Código de barras
- Quantidade
- Preço unitário
- Desconto por item
- Subtotal

**Venda:**
- Número da venda
- Data/hora
- Operador
- Loja
- Cliente (opcional)
- Subtotal
- Desconto geral
- Acréscimo geral
- Total
- Status (em aberto, finalizada, cancelada)

**Pagamento:**
- Forma de pagamento
- Valor
- Parcelas (se aplicável)
- Valor recebido (dinheiro)
- Troco (se aplicável)

#### Validações Conhecidas

- Estoque disponível antes da venda
- Caixa aberto para realizar vendas
- Permissões do operador (vendedor autorizado)
- Certificado digital válido (para NFC-e)
- Formas de pagamento configuradas
- Valor total = soma dos pagamentos

#### Estados de Sucesso e Erro

**Sucesso:**
- Venda finalizada
- Estoque atualizado
- Comprovante impresso
- Registro financeiro criado

**Erro:**
- Estoque insuficiente
- Caixa fechado
- Operador sem permissão
- Certificado digital inválido
- Pagamento incompleto

#### Permissões Necessárias

- **Vendedor:** Realizar vendas, consultar histórico
- **Operador de caixa:** Abrir/fechar caixa, sangrias, suprimentos
- **Administrador:** Cancelar vendas, reabrir caixa, ajustar valores

#### Impacto nos Módulos

**Estoque:**
- Redução automática da quantidade vendida
- Registro de movimentação de saída
- Alerta de estoque baixo

**Caixa:**
- Entrada de valores por forma de pagamento
- Registro de troco (saída)
- Atualização do saldo

**Financeiro:**
- Criação de conta a receber (se venda a prazo)
- Registro de receita (se venda à vista)
- Vinculação com categoria financeira

---

### 1.2 Cancelamento e Devolução

#### Objetivo
Cancelar uma venda já finalizada ou registrar devolução de produtos.

#### Etapas

**Cancelamento:**
1. Localizar venda no histórico
2. Verificar permissões (apenas administrador/gerente)
3. Informar motivo do cancelamento
4. Estornar valores do caixa
5. Devolver produtos ao estoque
6. Cancelar NFC-e (se emitida)
7. Registrar estorno financeiro

**Devolução:**
1. Localizar venda original
2. Selecionar produtos a devolver
3. Informar quantidade de cada produto
4. Definir forma de devolução (dinheiro, crédito, troca)
5. Devolver produtos ao estoque
6. Registrar movimentação financeira
7. Emitir NFC-e de devolução (se aplicável)

#### Validações

- Prazo máximo para cancelamento (ex: 30 dias)
- Permissões adequadas
- Produtos ainda em estoque (para devolução)
- NFC-e cancelável (dentro do prazo legal)

---

## 💰 2. FRENTE DE CAIXA

### 2.1 Abertura de Caixa

#### Objetivo do Usuário
Iniciar as operações de venda do dia, registrando o valor inicial.

#### Etapas Observadas

1. Operador acessa "Abrir Caixa"
2. Seleciona a loja/unidade
3. Informa valor inicial (fundo de troco)
4. Sistema registra:
   - Data/hora de abertura
   - Operador responsável
   - Valor inicial
   - Status: ABERTO
5. Campos de venda são liberados

#### Campos Necessários

- Loja/unidade
- Operador
- Data/hora de abertura
- Valor inicial
- Status (ABERTO, FECHADO)
- Observações (opcional)

#### Validações

- Apenas um caixa aberto por operador/loja
- Permissões do operador (caixa ou administrador)
- Valor inicial >= 0

#### Permissões

- **Operador de caixa:** Abrir seu próprio caixa
- **Administrador:** Abrir caixa para qualquer operador

---

### 2.2 Sangria

#### Objetivo
Retirar dinheiro do caixa por motivos diversos (pagamento de despesas, retirada para cofre, etc).

#### Etapas

1. Operador acessa "Sangria"
2. Informa valor a retirar
3. Informa motivo/descrição
4. Define categoria financeira (opcional)
5. Sistema registra:
   - Data/hora
   - Operador
   - Valor
   - Motivo
   - Categoria
6. Atualiza saldo do caixa (redução)

#### Campos Necessários

- Valor
- Motivo/descrição
- Categoria financeira
- Data/hora
- Operador

#### Validações

- Caixa deve estar aberto
- Valor <= saldo disponível
- Permissões do operador

#### Impacto

**Caixa:**
- Redução do saldo em dinheiro

**Financeiro:**
- Registro de despesa/saída
- Vinculação com categoria

---

### 2.3 Suprimento

#### Objetivo
Adicionar dinheiro ao caixa (reforço de troco, aporte, etc).

#### Etapas

1. Operador acessa "Suprimento"
2. Informa valor a adicionar
3. Informa motivo/descrição
4. Define categoria financeira (opcional)
5. Sistema registra:
   - Data/hora
   - Operador
   - Valor
   - Motivo
   - Categoria
6. Atualiza saldo do caixa (aumento)

#### Campos Necessários

- Valor
- Motivo/descrição
- Categoria financeira
- Data/hora
- Operador

#### Validações

- Caixa deve estar aberto
- Valor > 0
- Permissões do operador

#### Impacto

**Caixa:**
- Aumento do saldo em dinheiro

**Financeiro:**
- Registro de receita/entrada
- Vinculação com categoria

---

### 2.4 Fechamento de Caixa

#### Objetivo
Encerrar as operações do dia, conferindo valores e registrando diferenças.

#### Etapas Observadas

1. Operador acessa "Fechar Caixa"
2. Sistema mostra resumo:
   - Valor inicial
   - Total de vendas por forma de pagamento
   - Total de sangrias
   - Total de suprimentos
   - Saldo esperado
3. Operador informa valores reais contados:
   - Dinheiro em caixa
   - Cartão (maquininha)
   - PIX
   - Outros
4. Sistema calcula diferenças:
   - Diferença = Valor informado - Valor esperado
5. Operador confirma fechamento
6. Sistema registra:
   - Data/hora de fechamento
   - Valores informados
   - Diferenças
   - Status: FECHADO
7. Caixa é bloqueado para novas vendas

#### Campos Necessários

**Fechamento:**
- Data/hora de fechamento
- Operador
- Valores por forma de pagamento (informados)
- Diferenças calculadas
- Observações
- Status (FECHADO)

**Resumo:**
- Valor inicial
- Total de vendas (por forma)
- Total de sangrias
- Total de suprimentos
- Saldo esperado

#### Validações

- Todas as vendas finalizadas
- Permissões do operador
- Valores informados >= 0

#### Permissões

- **Operador de caixa:** Fechar seu próprio caixa
- **Administrador:** Fechar qualquer caixa, reabrir caixa fechado

#### Impacto

**Caixa:**
- Status muda para FECHADO
- Registro de diferenças

**Financeiro:**
- Consolidação do dia
- Relatório de fechamento

---

### 2.5 Conferência e Reabertura

#### Objetivo
Verificar valores informados no fechamento e reabrir caixa para ajustes.

#### Conferência

1. Administrador acessa caixa fechado
2. Visualiza valores informados vs esperados
3. Analisa diferenças
4. Aprova ou solicita ajustes

#### Reabertura

1. Administrador acessa caixa fechado
2. Clica em "Reabrir Caixa"
3. Informa motivo da reabertura
4. Sistema registra:
   - Data/hora da reabertura
   - Administrador responsável
   - Motivo
5. Caixa volta ao status ABERTO
6. Valores informados no fechamento são descartados

#### Validações

- Apenas administrador pode reabrir
- Motivo obrigatório
- Registro de auditoria

---

## 📊 3. FINANCEIRO

### 3.1 Contas a Pagar

#### Objetivo
Registrar e controlar obrigações financeiras da empresa.

#### Etapas

1. Cadastro de conta a pagar:
   - Descrição
   - Valor
   - Data de vencimento
   - Fornecedor
   - Categoria
   - Forma de pagamento prevista
2. Acompanhamento:
   - Status (pendente, paga, vencida, cancelada)
   - Dias até vencimento
   - Alertas de vencimento
3. Baixa de pagamento:
   - Data do pagamento
   - Valor pago
   - Forma de pagamento
   - Conta bancária
   - Desconto/acréscimo (se aplicável)

#### Campos Necessários

- Descrição
- Valor
- Data de vencimento
- Data de pagamento (quando paga)
- Fornecedor
- Categoria
- Forma de pagamento
- Conta bancária
- Status
- Observações

#### Validações

- Data de vencimento válida
- Valor > 0
- Fornecedor cadastrado (opcional)
- Categoria configurada

#### Estados

- **Pendente:** Ainda não paga
- **Paga:** Pagamento realizado
- **Vencida:** Data de vencimento ultrapassada
- **Cancelada:** Conta cancelada

---

### 3.2 Contas a Receber

#### Objetivo
Registrar e controlar direitos de recebimento da empresa.

#### Etapas

1. Geração automática a partir de vendas:
   - Venda a prazo gera conta a receber
   - Parcelas geram múltiplas contas
2. Cadastro manual:
   - Descrição
   - Valor
   - Data de vencimento
   - Cliente
   - Categoria
3. Acompanhamento:
   - Status (pendente, recebida, vencida, cancelada)
   - Dias até vencimento
   - Alertas de vencimento
4. Baixa de recebimento:
   - Data do recebimento
   - Valor recebido
   - Forma de recebimento
   - Conta bancária
   - Desconto/acréscimo (se aplicável)

#### Campos Necessários

- Descrição
- Valor
- Data de vencimento
- Data de recebimento (quando recebida)
- Cliente
- Categoria
- Forma de recebimento
- Conta bancária
- Status
- Venda vinculada (se aplicável)
- Observações

#### Validações

- Data de vencimento válida
- Valor > 0
- Cliente cadastrado (opcional)
- Categoria configurada

#### Estados

- **Pendente:** Ainda não recebida
- **Recebida:** Recebimento realizado
- **Vencida:** Data de vencimento ultrapassada
- **Cancelada:** Conta cancelada

---

### 3.3 Fluxo de Caixa

#### Objetivo
Visualizar entradas e saídas financeiras em um período.

#### Etapas

1. Seleção de período (data inicial e final)
2. Sistema consolida:
   - Receitas (vendas, outros recebimentos)
   - Despesas (compras, pagamentos, sangrias)
   - Saldo inicial
   - Saldo final
3. Visualização:
   - Gráfico de fluxo
   - Lista de movimentações
   - Resumo por categoria
   - Resumo por forma de pagamento

#### Campos Necessários

- Período (data inicial e final)
- Saldo inicial
- Total de receitas
- Total de despesas
- Saldo final
- Movimentações detalhadas

#### Cálculos

```
Saldo Inicial = Saldo do período anterior
Receitas = Soma de todos os recebimentos no período
Despesas = Soma de todos os pagamentos no período
Saldo Final = Saldo Inicial + Receitas - Despesas
```

---

### 3.4 Contas Financeiras

#### Objetivo
Definir categorias para classificação de receitas e despesas.

#### Exemplos de Categorias

**Receitas:**
- Vendas de produtos
- Vendas de serviços
- Outras receitas

**Despesas:**
- Aluguel
- Energia elétrica
- Água
- Internet
- Telefone
- Salários
- Fornecedores
- Impostos
- Outras despesas

#### Campos Necessários

- Nome da categoria
- Tipo (receita ou despesa)
- Cor (para identificação visual)
- Status (ativa/inativa)

---

### 3.5 Relação entre Vendas, Pagamentos e Recebimentos

#### Fluxo Integrado

**Venda à Vista:**
1. Venda é finalizada
2. Pagamento é registrado (dinheiro, cartão, PIX)
3. Caixa é atualizado (entrada)
4. Receita é registrada no financeiro
5. Estoque é atualizado (saída)

**Venda a Prazo:**
1. Venda é finalizada
2. Contas a receber são geradas (uma por parcela)
3. Estoque é atualizado (saída)
4. Quando cliente paga:
   - Conta a receber é baixada
   - Caixa/banco é atualizado (entrada)
   - Receita é consolidada

**Venda com Múltiplas Formas:**
1. Venda é finalizada
2. Pagamentos são registrados (ex: 50% dinheiro, 50% cartão)
3. Caixa é atualizado (parte em dinheiro)
4. Conta bancária é atualizada (parte no cartão)
5. Receitas são registradas

---

## 📋 4. MATRIZ DE IMPLEMENTAÇÃO NA VENDDI

### 4.1 Funcionalidades Prioritárias

| Funcionalidade | Prioridade | Status Atual | Ação Necessária |
|----------------|------------|--------------|-----------------|
| PDV básico | Alta | ✅ Interface criada | Implementar persistência |
| Abertura de caixa | Alta | ❌ Não implementado | Criar do zero |
| Sangria/Suprimento | Alta | ❌ Não implementado | Criar do zero |
| Fechamento de caixa | Alta | ❌ Não implementado | Criar do zero |
| Contas a pagar | Média | ❌ Não implementado | Criar do zero |
| Contas a receber | Média | ❌ Não implementado | Criar do zero |
| Fluxo de caixa | Média | ❌ Não implementado | Criar do zero |
| Histórico de vendas | Alta | ⚠️ Mock | Implementar real |
| Cancelamento de venda | Média | ❌ Não implementado | Criar do zero |
| Dashboard financeiro | Média | ⚠️ Mock | Implementar real |

### 4.2 Ordem de Implementação

**Fase 1 — PDV Transacional**
1. Persistência de vendas
2. Atualização de estoque
3. Múltiplas formas de pagamento
4. Cálculo de troco
5. Comprovante não fiscal

**Fase 2 — Controle de Caixa**
1. Abertura de caixa
2. Sangria e suprimento
3. Fechamento de caixa
4. Conferência
5. Reabertura

**Fase 3 — Financeiro Básico**
1. Contas a pagar
2. Contas a receber
3. Categorias financeiras
4. Fluxo de caixa
5. Relatórios básicos

**Fase 4 — Integração Completa**
1. Vinculação vendas-financeiro
2. Dashboards gerenciais
3. Relatórios avançados
4. Indicadores de desempenho

---

## 🔒 5. GARANTIAS TÉCNICAS

### 5.1 Transações Atômicas

Todas as operações críticas devem ser transações atômicas:

**Venda:**
```
BEGIN TRANSACTION
  1. Validar estoque
  2. Criar venda
  3. Criar itens da venda
  4. Criar pagamentos
  5. Atualizar estoque
  6. Criar movimentações de estoque
  7. Criar movimentações de caixa
  8. Criar contas a receber (se a prazo)
COMMIT
```

**Fechamento de Caixa:**
```
BEGIN TRANSACTION
  1. Validar vendas finalizadas
  2. Calcular totais
  3. Registrar fechamento
  4. Registrar diferenças
  5. Atualizar status do caixa
COMMIT
```

### 5.2 Idempotência

Operações financeiras devem usar chaves de idempotência:

```typescript
interface SaleRequest {
  idempotencyKey: string // UUID único
  items: SaleItem[]
  payments: Payment[]
  customerId?: string
}
```

### 5.3 Multi-tenant com RLS

Todas as tabelas devem ter `company_id` e políticas RLS:

```sql
CREATE POLICY "Users can view their company sales"
ON sales FOR SELECT
USING (company_id = get_user_company_id());
```

### 5.4 Auditoria

Operações críticas devem ser registradas em `audit_logs`:

```typescript
interface AuditLog {
  id: string
  companyId: string
  userId: string
  action: string // 'sale.create', 'cash.close', etc.
  entityType: string
  entityId: string
  oldValues?: any
  newValues?: any
  createdAt: string
}
```

### 5.5 Valores Monetários Exatos

Usar `DECIMAL(10,2)` no banco e `number` no TypeScript:

```typescript
// TypeScript
const total: number = 1234.56

// PostgreSQL
total DECIMAL(10,2) NOT NULL
```

---

## 🚧 6. LIMITAÇÕES E BLOQUEIOS

### 6.1 Limitações do Ambiente Atual

1. **Supabase não configurado**
   - Migrations não aplicadas
   - Persistência não funciona
   - Autenticação real não validada

2. **Testes de integração pendentes**
   - RLS não testado em ambiente real
   - Transações atômicas não validadas
   - Idempotência não testada

3. **Funcionalidades não homologadas**
   - PDV sem persistência real
   - Caixa sem controle real
   - Financeiro sem dados reais

### 6.2 Funcionalidades NÃO Implementadas

- Emissão de NFC-e (requer certificado digital)
- Integração com maquininhas POS
- Integração com gateways de pagamento
- Impressão de comprovantes (requer configuração de impressora)
- Leitura de código de barras via hardware

---

## 📚 7. FONTES E REFERÊNCIAS

### 7.1 Documentação Consultada

1. **Bling ERP**
   - https://ajuda.bling.com.br/
   - https://www.bling.com.br/funcionalidades/
   - Documentação pública de PDV, caixa e financeiro

2. **ContaAzul**
   - https://ajuda.contaazul.com.br/
   - Artigos sobre sangria e suprimento

3. **Artigos e Blogs**
   - Blog Bling: https://blog.bling.com.br/
   - Consultoria Zari: https://www.consultingzari.com.br/
   - ERP Varejo: https://sistemasvarejo.com.br/

### 7.2 Conhecimento Geral de PDVs

- Fluxos padrão de PDV brasileiro
- Regras de negócio de frente de caixa
- Conceitos de controle de caixa
- Princípios de gestão financeira

---

## ✅ 8. CONCLUSÃO

A análise funcional apresentada fornece uma base sólida para implementar funcionalidades de Vendas, Caixa e Financeiro na Venddi, seguindo melhores práticas de mercado.

**Próximos passos:**
1. Implementar PDV transacional com persistência
2. Criar controle de caixa completo
3. Desenvolver módulo financeiro básico
4. Integrar módulos (vendas → caixa → financeiro)
5. Validar com testes de integração

**Importante:** Todas as implementações devem seguir as garantias técnicas (transações atômicas, idempotência, RLS, auditoria) para garantir integridade e segurança dos dados.

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ✅ Concluída  
**Próxima etapa:** Implementação das funcionalidades priorizadas
