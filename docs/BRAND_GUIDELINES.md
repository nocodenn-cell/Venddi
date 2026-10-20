# Venddi — Diretrizes de Marca (Brand Guidelines)

## Visão Geral

Este documento complementa o `BRAND.md` com diretrizes técnicas e exemplos de aplicação da marca Venddi no sistema e materiais institucionais.

---

## 1. Design Tokens

### Cores (CSS Variables)

```css
:root {
  /* Cores principais */
  --venddi-green: #0EA572;
  --venddi-green-dark: #087A54;
  --venddi-green-light: #D1FAE5;
  
  /* Cores de apoio */
  --venddi-orange: #F59E0B;
  --venddi-blue: #3B82F6;
  
  /* Neutros */
  --venddi-gray-900: #111827;
  --venddi-gray-700: #374151;
  --venddi-gray-500: #6B7280;
  --venddi-gray-300: #D1D5DB;
  --venddi-gray-100: #F3F4F6;
  --venddi-white: #FFFFFF;
  
  /* Estados */
  --venddi-success: #10B981;
  --venddi-error: #EF4444;
  --venddi-warning: #F59E0B;
  --venddi-info: #3B82F6;
  
  /* Espaçamentos */
  --venddi-spacing-xs: 4px;
  --venddi-spacing-sm: 8px;
  --venddi-spacing-md: 16px;
  --venddi-spacing-lg: 24px;
  --venddi-spacing-xl: 32px;
  
  /* Border Radius */
  --venddi-radius-sm: 4px;
  --venddi-radius-md: 8px;
  --venddi-radius-lg: 12px;
  --venddi-radius-xl: 16px;
  --venddi-radius-full: 9999px;
  
  /* Sombras */
  --venddi-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --venddi-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --venddi-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

### Tailwind CSS Config

```js
// tailwind.config.js (se necessário customizar)
module.exports = {
  theme: {
    extend: {
      colors: {
        venddi: {
          green: '#0EA572',
          'green-dark': '#087A54',
          'green-light': '#D1FAE5',
          orange: '#F59E0B',
          blue: '#3B82F6',
        },
      },
    },
  },
}
```

---

## 2. Componentes Visuais

### Botões

#### Botão Primário
```css
background-color: #0EA572;
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 600;
transition: all 0.2s;

/* Hover */
background-color: #087A54;

/* Active */
transform: scale(0.98);
```

#### Botão Secundário
```css
background-color: #F3F4F6;
color: #374151;
padding: 12px 24px;
border-radius: 8px;
font-weight: 500;

/* Hover */
background-color: #E5E7EB;
```

#### Botão Outline
```css
background-color: transparent;
border: 1px solid #D1D5DB;
color: #374151;
padding: 12px 24px;
border-radius: 8px;

/* Hover */
background-color: #F9FAFB;
border-color: #9CA3AF;
```

### Cards

```css
background-color: white;
border: 1px solid #E5E7EB;
border-radius: 12px;
padding: 24px;
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
```

### Inputs

```css
border: 1px solid #D1D5DB;
border-radius: 8px;
padding: 10px 14px;
font-size: 14px;

/* Focus */
border-color: #0EA572;
box-shadow: 0 0 0 3px rgba(14, 165, 114, 0.1);

/* Error */
border-color: #EF4444;
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
```

### Badges

#### Badge de Sucesso
```css
background-color: #D1FAE5;
color: #065F46;
padding: 4px 12px;
border-radius: 9999px;
font-size: 12px;
font-weight: 500;
```

#### Badge de Erro
```css
background-color: #FEE2E2;
color: #991B1B;
padding: 4px 12px;
border-radius: 9999px;
font-size: 12px;
font-weight: 500;
```

#### Badge de Aviso
```css
background-color: #FEF3C7;
color: #92400E;
padding: 4px 12px;
border-radius: 9999px;
font-size: 12px;
font-weight: 500;
```

---

## 3. Layout do Sistema

### Sidebar

```css
background-color: white;
border-right: 1px solid #E5E7EB;
width: 256px; /* 16rem */

/* Colapsada */
width: 64px; /* 4rem */
```

### Header

```css
background-color: white;
border-bottom: 1px solid #E5E7EB;
height: 64px; /* 4rem */
padding: 0 24px;
```

### Conteúdo Principal

```css
background-color: #F9FAFB;
padding: 24px;
```

---

## 4. Ícones

### Biblioteca de Ícones

Usamos **Lucide React** para ícones consistentes e modernos.

**Características:**
- Estilo outline (não preenchido)
- Tamanho padrão: 20x20px
- Cor: herda do texto (currentColor)
- Peso da linha: 1.5px

### Uso de Ícones

```tsx
import { Package, ShoppingCart, DollarSign } from 'lucide-react'

// Ícone padrão
<Package className="h-5 w-5 text-gray-600" />

// Ícone em botão
<Button>
  <ShoppingCart className="h-4 w-4 mr-2" />
  Novo Pedido
</Button>

// Ícone colorido
<DollarSign className="h-5 w-5 text-venddi-green" />
```

---

## 5. Exemplos de Aplicação

### Tela de Login

```
┌─────────────────────────────────────────┐
│                                         │
│         [Logo Venddi Completo]          │
│                                         │
│         Bem-vindo ao Venddi             │
│         Gestão simples para vender mais │
│                                         │
│    ┌───────────────────────────────┐   │
│    │ Email                         │   │
│    └───────────────────────────────┘   │
│    ┌───────────────────────────────┐   │
│    │ Senha                         │   │
│    └───────────────────────────────┘   │
│                                         │
│    [  Entrar  ] (botão verde)          │
│                                         │
│    Não tem conta? Criar conta          │
│                                         │
└─────────────────────────────────────────┘
```

### Dashboard

```
┌──────────┬────────────────────────────────┐
│ [Logo]   │  Dashboard                     │
│          │                                │
│ 📊 Dash  │  ┌──────┐ ┌──────┐ ┌──────┐  │
│ 📦 Prod  │  │Vendas│ │Pedidos│ │Caixa │  │
│ 👥 Cli   │  │2.450 │ │  12  │ │8.750 │  │
│ 📊 Est   │  └──────┘ └──────┘ └──────┘  │
│ 🛒 PDV   │                                │
│ 💰 Caixa │  Vendas Recentes               │
│ 📈 Fin   │  ┌────────────────────────┐   │
│ ⚙️ Conf  │  │ Maria Silva    R$ 150 │   │
│          │  │ João Santos    R$  89 │   │
│ [Sair]   │  └────────────────────────┘   │
└──────────┴────────────────────────────────┘
```

### Botões

```
[  Criar Produto  ] (verde, primário)
[  Cancelar  ] (cinza, secundário)
[  Exportar  ] (outline, borda cinza)
[  ⚠ Excluir  ] (vermelho, danger)
```

### Cards de Produto

```
┌─────────────────────────────────┐
│ [📦] Camiseta Básica            │
│      SKU: CAM-001               │
│                                 │
│      Preço: R$ 49,90            │
│      Estoque: 25                │
│                                 │
│      [Ativo] (badge verde)      │
│                                 │
│              [Editar] [Excluir] │
└─────────────────────────────────┘
```

---

## 6. Responsividade

### Breakpoints

```css
/* Mobile */
@media (max-width: 640px) {
  /* Sidebar colapsa automaticamente */
  /* Layout em coluna única */
}

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) {
  /* Sidebar colapsável */
  /* Grid 2 colunas */
}

/* Desktop */
@media (min-width: 1025px) {
  /* Sidebar expandida */
  /* Grid 3-4 colunas */
}
```

### Tamanhos de Tela

- **Mobile:** < 640px
- **Tablet:** 641px - 1024px
- **Desktop:** > 1024px
- **Large Desktop:** > 1440px

---

## 7. Acessibilidade

### Contraste de Cores

Todas as combinações de cor devem atender ao **WCAG 2.1 Level AA**:

- **Texto normal:** contraste mínimo 4.5:1
- **Texto grande:** contraste mínimo 3:1
- **Elementos de interface:** contraste mínimo 3:1

### Exemplos Válidos ✅

- Texto Gray 900 (#111827) em fundo branco (#FFFFFF) → 16.75:1
- Texto branco (#FFFFFF) em fundo Venddi Green (#0EA572) → 4.52:1
- Texto Gray 700 (#374151) em fundo Gray 100 (#F3F4F6) → 7.45:1

### Exemplos Inválidos ❌

- Texto Gray 300 (#D1D5DB) em fundo branco (#FFFFFF) → 1.45:1
- Texto branco (#FFFFFF) em fundo Gray 100 (#F3F4F6) → 1.12:1

### Foco Visível

Todos os elementos interativos devem ter foco visível:

```css
button:focus-visible {
  outline: 2px solid #0EA572;
  outline-offset: 2px;
}
```

### Navegação por Teclado

- Todos os elementos interativos devem ser acessíveis via Tab
- Ordem de tabulação lógica
- Indicador de foco claro
- Atalhos de teclado documentados

---

## 8. Animações e Transições

### Duração Padrão

```css
/* Transições rápidas (hover, focus) */
transition: all 0.2s ease;

/* Transições médias (modais, dropdowns) */
transition: all 0.3s ease;

/* Transições lentas (páginas, seções) */
transition: all 0.5s ease;
```

### Easing

```css
/* Padrão */
ease: cubic-bezier(0.4, 0, 0.2, 1);

/* Entrada */
ease-in: cubic-bezier(0.4, 0, 1, 1);

/* Saída */
ease-out: cubic-bezier(0, 0, 0.2, 1);

/* Entrada e saída */
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Animações Permitidas

- Fade in/out (opacity)
- Scale (transform: scale)
- Slide (transform: translateX/Y)
- Hover effects (background, color, shadow)

### Animações Proibidas

- Animações excessivas ou distrativas
- Movimento automático sem controle do usuário
- Animações que causam motion sickness

---

## 9. Dark Mode (Futuro)

### Paleta Dark Mode

```css
:root[data-theme="dark"] {
  --venddi-bg-primary: #111827;
  --venddi-bg-secondary: #1F2937;
  --venddi-text-primary: #F9FAFB;
  --venddi-text-secondary: #D1D5DB;
  --venddi-border: #374151;
  
  /* Cores principais mantidas */
  --venddi-green: #0EA572;
  --venddi-green-dark: #087A54;
}
```

### Considerações

- Manter contraste adequado
- Logo branco em fundos escuros
- Reduzir brilho de cores vibrantes
- Testar legibilidade em todos os elementos

---

## 10. Checklist de Implementação

### Ao criar uma nova página:

- [ ] Usar tipografia correta (Inter)
- [ ] Aplicar cores da paleta Venddi
- [ ] Manter espaçamentos consistentes
- [ ] Usar componentes reutilizáveis
- [ ] Garantir acessibilidade (contraste, foco)
- [ ] Testar responsividade
- [ ] Validar em diferentes navegadores

### Ao criar um novo componente:

- [ ] Seguir design tokens
- [ ] Usar variantes (primary, secondary, etc.)
- [ ] Incluir estados (hover, focus, disabled)
- [ ] Documentar uso
- [ ] Testar acessibilidade

---

**Última atualização:** 2026-10-19  
**Versão:** 1.0
