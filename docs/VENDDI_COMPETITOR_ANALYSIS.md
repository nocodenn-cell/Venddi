# Análise de Concorrentes — Bling e Tiny (Olist)

**Data:** 2026-10-19  
**Objetivo:** Estudar interfaces públicas, fluxos de usuário e boas práticas de UX para evoluir a Venddi

---

## 📊 Resumo Executivo

Esta análise compara dois dos principais ERPs brasileiros voltados para pequenas e médias empresas: **Bling** e **Tiny (agora Olist)**. O objetivo é identificar boas práticas de UX, fluxos de usuário eficientes e oportunidades de diferenciação para a Venddi.

### Principais Descobertas

✅ **Bling** destaca-se por:
- Interface completa e integrada
- Forte foco em e-commerce e marketplaces
- Dashboard analítico com IA
- Suporte humano especializado
- Ecossistema de extensões

✅ **Tiny/Olist** destaca-se por:
- Simplicidade e facilidade de uso
- Estrutura modular clara
- Preço acessível (R$ 55,55/mês inicial)
- Onboarding estruturado em 6 etapas
- Foco em automação de tarefas

---

## 🎯 1. Análise do Bling ERP

### 1.1 Posicionamento de Mercado

**Público-alvo:** Pequenas e médias empresas que vendem online e/ou em loja física

**Proposta de valor:** "Sua plataforma completa de negócios"

**Diferenciais:**
- +250 integrações com marketplaces e plataformas
- Emissão automática de notas fiscais (NFC-e, NF-e, NFS-e)
- Dashboard com IA para insights
- Conta digital PJ gratuita
- Suporte humano especialista

### 1.2 Estrutura de Navegação

```
Menu Principal:
├── ERP
│   ├── Gestão Operacional
│   │   ├── Estoque
│   │   ├── Vendas
│   │   └── Logística
│   └── Finanças
│       ├── Gestão financeira
│       ├── Meios de pagamento
│       └── Bling Conta Digital
├── HUB
│   ├── Vendas Multicanal
│   └── Central de Extensões
├── Inteligência
│   ├── Automações
│   └── Meu Negócio (Dashboards)
├── Para Quem
│   ├── Vende online
│   ├── Tem loja física
│   ├── Oferece serviço
│   └── Tem pequena indústria
└── Usando o Bling
    ├── Bling Academy
    ├── Implantação Guiada
    ├── Treinamentos ao vivo
    └── Central de Ajuda
```

### 1.3 Fluxo de Usuário — PDV (Frente de Caixa)

#### Etapas do Fluxo:

1. **Acesso ao PDV**
   - Menu lateral → Frente de Caixa
   - Interface limpa e focada na operação

2. **Busca de Produtos**
   - Por nome, SKU ou código de barras
   - Leitor de código de barras integrado
   - Balanças integradas (produtos fracionados)

3. **Carrinho de Compras**
   - Adição rápida de produtos
   - Ajuste de quantidades
   - Aplicação de descontos
   - Visualização de subtotal

4. **Pagamento**
   - Múltiplas formas: Dinheiro, Cartão, PIX, Boleto
   - Pagamento dividido
   - Cálculo automático de troco
   - Integração com maquininha POS

5. **Finalização**
   - Emissão automática de NFC-e
   - Impressão de comprovante
   - Atualização automática de estoque
   - Registro financeiro

6. **Fechamento de Caixa**
   - Controle de múltiplos operadores
   - Registro de suprimentos e sangrias
   - Resumo de vendas do dia
   - Conferência de valores

### 1.4 Boas Práticas de UX Identificadas

#### ✅ Pontos Fortes:

1. **Navegação Hierárquica Clara**
   - Menu organizado por categorias (ERP, HUB, Inteligência)
   - Submenus contextuais
   - Ícones visuais para cada módulo

2. **Dashboard Inteligente**
   - "Meu Negócio" com dashboards interativos
   - IA para extrair insights
   - Visualização de KPIs em tempo real
   - Filtros avançados

3. **Integração Nativa**
   - Conta digital PJ gratuita
   - Maquininha POS integrada
   - Conciliação automática
   - Sincronização multicanal

4. **Suporte e Educação**
   - Bling Academy (cursos gratuitos)
   - Implantação guiada com especialistas
   - Treinamentos ao vivo diários
   - Central de ajuda completa

5. **Cases de Sucesso**
   - Depoimentos de clientes reais
   - Histórias de crescimento
   - Prova social forte

#### ⚠️ Oportunidades de Melhoria:

1. **Complexidade Excessiva**
   - Muitas funcionalidades podem sobrecarregar usuários iniciantes
   - Curva de aprendizado mais longa
   - Necessidade de treinamento

2. **Foco em E-commerce**
   - PDV é apenas um dos muitos módulos
   - Não é o foco principal do produto
   - Pode ser excessivo para lojas 100% físicas

3. **Preço**
   - Planos mais caros que concorrentes
   - Pode não ser acessível para microempresas

### 1.5 Preços e Planos

| Plano | Preço | Recursos Principais |
|-------|-------|---------------------|
| **Titanium 1** | R$ 79/mês | 1 usuário, 1.000 pedidos/mês |
| **Titanium 2** | R$ 149/mês | 3 usuários, 5.000 pedidos/mês |
| **Titanium 3** | R$ 249/mês | 10 usuários, 20.000 pedidos/mês |
| **Titanium 4** | R$ 399/mês | Usuários ilimitados, pedidos ilimitados |

**Oferta Black Friday:** 30 dias grátis + 45% OFF na primeira mensalidade

---

## 🎯 2. Análise do Tiny (Olist)

### 2.1 Posicionamento de Mercado

**Público-alvo:** Pequenas empresas, e-commerce e lojas físicas

**Proposta de valor:** "Gestão que acelera"

**Diferenciais:**
- Simplicidade e facilidade de uso
- Preço acessível (R$ 55,55/mês inicial)
- Estrutura modular
- +70 marketplaces integrados
- Foco em automação

### 2.2 Estrutura de Navegação

```
Menu Principal:
├── Vendas
│   ├── Pedidos
│   ├── Notas Fiscais
│   └── PDV (Ponto de Venda)
├── Produtos
│   ├── Cadastro
│   ├── Estoque
│   └── Kits
├── Compras
│   ├── Fornecedores
│   ├── Pedidos de Compra
│   └── Entradas de NF
├── Finanças
│   ├── Contas a Pagar
│   ├── Contas a Receber
│   └── Fluxo de Caixa
├── Relatórios
│   ├── Vendas
│   ├── Estoque
│   └── Financeiro
└── Configurações
    ├── Empresa
    ├── Usuários
    └── Integrações
```

### 2.3 Fluxo de Usuário — PDV

#### Etapas do Fluxo:

1. **Acesso ao PDV**
   - Menu → Vendas → PDV
   - Interface simplificada
   - Foco em vendas rápidas

2. **Venda Rápida**
   - Sem necessidade de pré-cadastro de cliente
   - Busca por produto (nome, código)
   - Adição ao carrinho
   - Cálculo automático

3. **Pagamento**
   - Formas: Dinheiro, Cartão, PIX
   - Cálculo de troco
   - Finalização rápida

4. **Emissão Fiscal**
   - NFC-e automática
   - Comprovante não fiscal
   - Atualização de estoque

### 2.4 Boas Práticas de UX Identificadas

#### ✅ Pontos Fortes:

1. **Simplicidade**
   - Interface limpa e direta
   - Menos opções = menos confusão
   - Foco no essencial
   - Curva de aprendizado rápida

2. **Onboarding Estruturado**
   - 6 etapas claras:
     1. Criar conta
     2. Integrar canais de venda
     3. Cadastrar produtos
     4. Configurar notas fiscais
     5. Selecionar módulos
     6. Iniciar operação
   - Guia passo a passo
   - Teste grátis de 30 dias

3. **Estrutura Modular**
   - Módulos ativáveis/desativáveis
   - Paga apenas pelo que usa
   - Flexibilidade para diferentes negócios

4. **Preço Acessível**
   - Plano inicial: R$ 55,55/mês
   - Teste grátis de 30 dias
   - Sem compromisso

5. **Foco em Automação**
   - Emissão automática de NF
   - Sincronização de estoque
   - Importação de pedidos

#### ⚠️ Oportunidades de Melhoria:

1. **Menos Recursos Avançados**
   - Dashboard menos sofisticado que Bling
   - Menos integrações nativas
   - Funcionalidades mais básicas

2. **Suporte Limitado**
   - Menos recursos educacionais
   - Sem treinamentos ao vivo
   - Central de ajuda menos completa

3. **Rebranding Recente**
   - Transição de Tiny para Olist
   - Pode causar confusão
   - Usuários antigos precisam se adaptar

### 2.5 Preços e Planos

| Plano | Preço | Recursos Principais |
|-------|-------|---------------------|
| **Começar** | R$ 55,55/mês | Emissão de NF, gestão básica |
| **Crescer** | R$ 111,11/mês | Gestão de caixa, fluxo de caixa |
| **Evoluir** | R$ 199,90/mês | Importação automática de pedidos |
| **Potencializar** | Sob consulta | Gerente de contas dedicado |

**Teste grátis:** 30 dias em todos os planos

---

## 🎨 3. Comparativo de UX

### 3.1 Interface Visual

| Aspecto | Bling | Tiny/Olist | Venddi (Atual) |
|---------|-------|------------|----------------|
| **Design** | Moderno, completo | Simples, direto | Limpo, focado |
| **Cores** | Verde (#00856F) | Azul (Olist) | Verde (#0EA572) |
| **Complexidade** | Alta | Média | Baixa ✅ |
| **Navegação** | Hierárquica | Linear | Linear ✅ |
| **Responsivo** | Sim | Sim | Sim ✅ |

### 3.2 Fluxo de Cadastro

| Etapa | Bling | Tiny/Olist | Venddi |
|-------|-------|------------|--------|
| **1. Dados básicos** | Nome, email, senha | Nome, email, senha | Nome, email, senha ✅ |
| **2. Dados empresa** | CNPJ, ramo | CNPJ, ramo | CNPJ, ramo ✅ |
| **3. Trial** | 30 dias grátis | 30 dias grátis | 15 dias grátis ⚠️ |
| **4. Onboarding** | Implantação guiada | 6 etapas | Sem onboarding ❌ |
| **5. Configuração** | Complexa | Simples | Básica ✅ |

### 3.3 Fluxo de Venda (PDV)

| Etapa | Bling | Tiny/Olist | Venddi |
|-------|-------|------------|--------|
| **1. Busca produto** | Nome, SKU, código | Nome, código | Nome, SKU ✅ |
| **2. Carrinho** | Completo | Simples | Simples ✅ |
| **3. Pagamento** | Múltiplas formas | Básico | Múltiplas formas ✅ |
| **4. Emissão NF** | Automática | Automática | Manual ⚠️ |
| **5. Comprovante** | Impressão | Impressão | Não implementado ❌ |
| **6. Estoque** | Atualização auto | Atualização auto | Atualização auto ✅ |

### 3.4 Dashboard e Relatórios

| Recurso | Bling | Tiny/Olist | Venddi |
|---------|-------|------------|--------|
| **Dashboard principal** | Completo com IA | Básico | Básico ✅ |
| **KPIs em tempo real** | Sim | Limitado | Sim ✅ |
| **Filtros avançados** | Sim | Limitado | Limitado ⚠️ |
| **Gráficos** | Diversos | Básicos | Básicos ✅ |
| **Exportação** | PDF, Excel | PDF, Excel | Não implementado ❌ |
| **IA para insights** | Sim | Não | Não ❌ |

---

## 💡 4. Boas Práticas Identificadas

### 4.1 Onboarding

#### Bling:
- ✅ Implantação guiada com especialistas
- ✅ Treinamentos ao vivo diários
- ✅ Bling Academy (cursos gratuitos)
- ✅ Central de ajuda completa

#### Tiny/Olist:
- ✅ Onboarding em 6 etapas claras
- ✅ Guia passo a passo visual
- ✅ Teste grátis de 30 dias
- ✅ Módulos ativáveis conforme necessidade

#### 🎯 Recomendações para Venddi:

1. **Criar Onboarding Interativo**
   ```
   Etapa 1: Dados da empresa (automático do cadastro)
   Etapa 2: Configurar produtos (importar CSV ou cadastrar manualmente)
   Etapa 3: Configurar formas de pagamento
   Etapa 4: Abrir caixa pela primeira vez
   Etapa 5: Realizar primeira venda (tutorial interativo)
   Etapa 6: Explorar dashboard
   ```

2. **Implementar Tour Guiado**
   - Tooltips explicativos em cada módulo
   - Vídeos curtos (30-60 segundos)
   - Checklist de configuração inicial
   - Botão "Preciso de ajuda" contextual

3. **Criar Central de Ajuda**
   - Artigos por módulo
   - Vídeos tutoriais
   - FAQ
   - Chat de suporte

### 4.2 Dashboard Inteligente

#### Bling:
- ✅ "Meu Negócio" com dashboards interativos
- ✅ IA para extrair insights
- ✅ Filtros avançados
- ✅ KPIs em tempo real

#### 🎯 Recomendações para Venddi:

1. **Expandir Dashboard Atual**
   ```
   Seção 1: Resumo do Dia
   - Vendas hoje
   - Ticket médio
   - Produtos mais vendidos
   - Formas de pagamento

   Seção 2: Tendências
   - Gráfico de vendas (7/30/90 dias)
   - Comparativo com período anterior
   - Previsão baseada em histórico

   Seção 3: Alertas
   - Estoque baixo
   - Contas a vencer
   - Produtos sem venda

   Seção 4: Ações Rápidas
   - Abrir caixa
   - Nova venda
   - Cadastrar produto
   ```

2. **Implementar Filtros Avançados**
   - Por período (data inicial/final)
   - Por operador
   - Por forma de pagamento
   - Por categoria de produto

3. **Adicionar Exportação**
   - PDF para impressão
   - Excel para análise
   - CSV para importação

### 4.3 Integrações

#### Bling:
- ✅ +250 integrações
- ✅ Conta digital PJ
- ✅ Maquininha POS
- ✅ Marketplaces

#### Tiny/Olist:
- ✅ +70 marketplaces
- ✅ +30 plataformas de e-commerce
- ✅ Integrações logísticas

#### 🎯 Recomendações para Venddi:

**Fase 1 (MVP):**
- ✅ PIX (já implementado)
- ⚠️ Maquininha POS (pendente)
- ⚠️ Emissão de NFC-e (congelado)

**Fase 2 (Pós-MVP):**
- Integração com Bling/Tiny para NFC-e
- Integração com marketplaces (Mercado Livre, Shopee)
- Integração com plataformas de e-commerce

### 4.4 Preços e Planos

#### Bling:
- R$ 79/mês (inicial)
- 30 dias grátis
- Foco em empresas maiores

#### Tiny/Olist:
- R$ 55,55/mês (inicial)
- 30 dias grátis
- Foco em pequenas empresas

#### 🎯 Recomendações para Venddi:

1. **Revisar Estratégia de Preços**
   ```
   Plano Starter: R$ 49/mês
   - 1 PDV
   - 300 produtos
   - Relatórios básicos
   - Suporte por email

   Plano Professional: R$ 99/mês
   - 3 PDVs
   - Produtos ilimitados
   - Relatórios avançados
   - Suporte prioritário

   Plano Business: R$ 199/mês
   - PDVs ilimitados
   - Múltiplas lojas
   - API de integração
   - Suporte dedicado
   ```

2. **Oferecer Trial Mais Longo**
   - Aumentar de 15 para 30 dias
   - Competir com Bling e Tiny
   - Mais tempo para validação

3. **Desconto Anual**
   - 20% de desconto no plano anual
   - Reduz churn
   - Melhora fluxo de caixa

### 4.5 Suporte e Educação

#### Bling:
- ✅ Bling Academy
- ✅ Treinamentos ao vivo
- ✅ Implantação guiada
- ✅ Central de ajuda

#### 🎯 Recomendações para Venddi:

1. **Criar Venddi Academy**
   - Cursos gratuitos em vídeo
   - Artigos tutoriais
   - Webinars mensais
   - Certificação de usuários

2. **Implementar Chat de Suporte**
   - Widget no app
   - Resposta em até 2 horas
   - Base de conhecimento integrada

3. **Comunidade de Usuários**
   - Fórum de discussão
   - Grupos por segmento
   - Compartilhamento de boas práticas

---

## 🚀 5. Oportunidades de Diferenciação

### 5.1 Foco em Lojas 100% Físicas

**Problema dos Concorrentes:**
- Bling: Foco em e-commerce, PDV é secundário
- Tiny: Genérico, não especializado

**Oportunidade Venddi:**
- ✅ PDV como foco principal
- ✅ Interface otimizada para balcão
- ✅ Fluxo simplificado para vendas rápidas
- ✅ Suporte a leitor de código de barras
- ✅ Integração com impressoras térmicas

### 5.2 Simplicidade Extrema

**Problema dos Concorrentes:**
- Bling: Complexo, muitas funcionalidades
- Tiny: Melhor, mas ainda genérico

**Oportunidade Venddi:**
- ✅ "Seu caixa simples. Sua loja sob controle."
- ✅ Apenas o essencial
- ✅ Zero configuração complexa
- ✅ Comece a vender em 5 minutos

### 5.3 Preço Ultra-Acessível

**Problema dos Concorrentes:**
- Bling: R$ 79/mês (caro para micro)
- Tiny: R$ 55,55/mês (acessível, mas pode melhorar)

**Oportunidade Venddi:**
- ✅ Plano inicial: R$ 49/mês
- ✅ Trial de 30 dias
- ✅ Sem cartão de crédito
- ✅ Cancele quando quiser

### 5.4 Suporte Humanizado

**Problema dos Concorrentes:**
- Bling: Suporte bom, mas pode ser melhor
- Tiny: Suporte limitado

**Oportunidade Venddi:**
- ✅ Suporte por WhatsApp
- ✅ Resposta em até 30 minutos
- ✅ Atendimento humano (não bot)
- ✅ Consultoria gratuita na implantação

---

## 📋 6. Plano de Ação para Venddi

### 6.1 Prioridade Alta (Próximas 2 Semanas)

#### ✅ Onboarding Interativo
- [ ] Criar tour guiado de 6 etapas
- [ ] Implementar tooltips explicativos
- [ ] Adicionar checklist de configuração
- [ ] Criar vídeos tutoriais curtos

#### ✅ Dashboard Expandido
- [ ] Adicionar seção de tendências
- [ ] Implementar filtros avançados
- [ ] Adicionar alertas de estoque
- [ ] Implementar exportação (PDF/Excel)

#### ✅ Melhorias no PDV
- [ ] Otimizar fluxo de venda rápida
- [ ] Adicionar atalhos de teclado
- [ ] Melhorar busca de produtos
- [ ] Adicionar modo "venda contínua"

### 6.2 Prioridade Média (Próximas 4 Semanas)

#### ✅ Suporte e Educação
- [ ] Criar central de ajuda
- [ ] Implementar chat de suporte
- [ ] Criar primeiros vídeos tutoriais
- [ ] Documentar FAQ

#### ✅ Integrações Básicas
- [ ] Integração com impressoras térmicas
- [ ] Integração com leitor de código de barras
- [ ] Integração com gaveta de dinheiro

#### ✅ Revisão de Preços
- [ ] Ajustar planos para R$ 49/99/199
- [ ] Aumentar trial para 30 dias
- [ ] Adicionar desconto anual (20%)

### 6.3 Prioridade Baixa (Próximas 8 Semanas)

#### ✅ Recursos Avançados
- [ ] Dashboard com IA (insights automáticos)
- [ ] Relatórios personalizáveis
- [ ] Automações básicas
- [ ] API pública

#### ✅ Expansão de Integrações
- [ ] Integração com Bling/Tiny (NFC-e)
- [ ] Integração com marketplaces
- [ ] Integração com e-commerce

---

## 📊 7. Métricas de Sucesso

### 7.1 Métricas de UX

| Métrica | Meta | Como Medir |
|---------|------|------------|
| **Tempo para primeira venda** | < 10 minutos | Timestamp cadastro → primeira venda |
| **Taxa de conclusão do onboarding** | > 80% | Usuários que completam 6 etapas |
| **NPS (Net Promoter Score)** | > 50 | Pesquisa mensal |
| **Taxa de retenção (30 dias)** | > 70% | Usuários ativos após 30 dias |
| **Tempo médio de venda no PDV** | < 2 minutos | Timestamp início → fim da venda |

### 7.2 Métricas de Negócio

| Métrica | Meta | Como Medir |
|---------|------|------------|
| **Conversão trial → pago** | > 15% | Usuários que assinam após trial |
| **Churn mensal** | < 5% | Usuários que cancelam por mês |
| **Ticket médio** | R$ 99/mês | Receita média por cliente |
| **MRR (Monthly Recurring Revenue)** | R$ 10.000 | Receita recorrente mensal |
| **CAC (Customer Acquisition Cost)** | < R$ 200 | Custo para adquirir cliente |

---

## 🎯 8. Conclusão

### 8.1 Lições Aprendidas

✅ **Simplicidade vence complexidade**
- Tiny/Olist mostra que menos é mais
- Usuários preferem interfaces limpas
- Foco no essencial gera adoção rápida

✅ **Onboarding é crucial**
- Bling e Tiny investem pesado em educação
- Usuários bem treinados = menos suporte
- Onboarding estruturado aumenta conversão

✅ **Preço acessível é diferencial**
- Tiny começa em R$ 55,55/mês
- Microempresas são sensíveis a preço
- Trial longo (30 dias) aumenta conversão

✅ **Suporte humanizado faz diferença**
- Bling destaca suporte como diferencial
- Depoimentos mencionam suporte frequentemente
- Suporte rápido = clientes satisfeitos

### 8.2 Posicionamento da Venddi

**Visão:** "O PDV mais simples para pequenas lojas físicas"

**Diferenciais:**
1. ✅ Foco 100% em loja física (não e-commerce)
2. ✅ Simplicidade extrema (comece em 5 minutos)
3. ✅ Preço ultra-acessível (R$ 49/mês)
4. ✅ Suporte humanizado (WhatsApp, 30 min)

**Público-alvo:**
- Lojas de bairro
- Pequenos comércios
- Profissionais autônomos
- Quem quer simplicidade, não complexidade

### 8.3 Próximos Passos

1. **Implementar onboarding interativo** (2 semanas)
2. **Expandir dashboard** (2 semanas)
3. **Revisar preços e trial** (1 semana)
4. **Criar central de ajuda** (2 semanas)
5. **Lançar beta com 5 lojas piloto** (4 semanas)

---

## 📚 9. Referências

### Bling ERP
- Site: https://www.bling.com.br/
- PDV: https://www.bling.com.br/funcionalidades/frente-de-caixa
- Preços: https://www.bling.com.br/planos-e-precos
- Blog: https://blog.bling.com.br/

### Tiny/Olist ERP
- Site: https://tiny.com.br/
- PDV: https://tiny.com.br/recursos/pdv
- Preços: https://tiny.com.br/planos
- Ajuda: https://ajuda.olist.com/

### Ferramentas de Análise
- Awesome Reverse Engineering: https://github.com/morluto/awesome-reverse-engineering
- REA (Reverse Engineer Anything): https://github.com/morluto/rea

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ✅ Concluído  
**Próxima revisão:** 2026-11-19 (após implementação das melhorias)
