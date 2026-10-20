/**
 * Feature Flags - Venddi
 * 
 * Controla quais funcionalidades estão habilitadas no sistema.
 * 
 * IMPORTANTE: Este arquivo NÃO deve conter tokens, credenciais ou segredos.
 * Todas as flags são avaliadas no backend para segurança.
 */

// ============================================
// Feature Flag Definitions
// ============================================

export interface FeatureFlag {
  name: string
  enabled: boolean
  description: string
  requiresBackendValidation: boolean
}

// ============================================
// Current Feature Flags
// ============================================

export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Fiscal Module - FROZEN
  // Módulo fiscal congelado por decisão do fundador (2026-10-19)
  // Será reativado em fase posterior após primeiro cliente pagante
  FISCAL_ENABLED: {
    name: 'FISCAL_ENABLED',
    enabled: false, // ❌ DESABILITADO - Módulo congelado
    description: 'Módulo fiscal (Focus NFe) - CONGELADO. Não emite NFC-e nesta fase.',
    requiresBackendValidation: true,
  },

  // Core PDV Features - ENABLED
  PDV_SALES: {
    name: 'PDV_SALES',
    enabled: true, // ✅ HABILITADO
    description: 'Vendas no PDV - Funcionalidade principal',
    requiresBackendValidation: false,
  },

  CASH_REGISTER: {
    name: 'CASH_REGISTER',
    enabled: true, // ✅ HABILITADO
    description: 'Controle de caixa - Abertura, fechamento, sangria, suprimento',
    requiresBackendValidation: false,
  },

  PRODUCTS: {
    name: 'PRODUCTS',
    enabled: true, // ✅ HABILITADO
    description: 'Gestão de produtos - CRUD completo',
    requiresBackendValidation: false,
  },

  INVENTORY: {
    name: 'INVENTORY',
    enabled: true, // ✅ HABILITADO
    description: 'Controle de estoque - Movimentações e ajustes',
    requiresBackendValidation: false,
  },

  REPORTS: {
    name: 'REPORTS',
    enabled: true, // ✅ HABILITADO
    description: 'Relatórios básicos - Dashboard e indicadores',
    requiresBackendValidation: false,
  },

  // Trial & Subscription - ENABLED
  TRIAL_15_DAYS: {
    name: 'TRIAL_15_DAYS',
    enabled: true, // ✅ HABILITADO
    description: 'Trial de 15 dias - Cadastro e avaliação gratuita',
    requiresBackendValidation: true,
  },

  // Future Features - DISABLED
  MARKETPLACE_INTEGRATION: {
    name: 'MARKETPLACE_INTEGRATION',
    enabled: false, // ❌ DESABILITADO
    description: 'Integração com marketplaces - Não implementado',
    requiresBackendValidation: true,
  },

  ECOMMERCE: {
    name: 'ECOMMERCE',
    enabled: false, // ❌ DESABILITADO
    description: 'E-commerce - Não implementado',
    requiresBackendValidation: true,
  },

  POS_HARDWARE: {
    name: 'POS_HARDWARE',
    enabled: false, // ❌ DESABILITADO
    description: 'Integração com maquininhas POS - Não implementado',
    requiresBackendValidation: true,
  },
}

// ============================================
// Feature Flag Helper Functions
// ============================================

/**
 * Verifica se uma feature está habilitada
 * 
 * @param featureName - Nome da feature flag
 * @returns boolean - true se habilitada, false se desabilitada
 * 
 * @example
 * if (isFeatureEnabled('FISCAL_ENABLED')) {
 *   // Executar emissão fiscal
 * } else {
 *   // Módulo fiscal desabilitado
 * }
 */
export function isFeatureEnabled(featureName: string): boolean {
  const flag = FEATURE_FLAGS[featureName]
  
  if (!flag) {
    console.warn(`Feature flag "${featureName}" não encontrada. Assumindo desabilitada.`)
    return false
  }
  
  return flag.enabled
}

/**
 * Retorna todas as features habilitadas
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([_, flag]) => flag.enabled)
    .map(([name, _]) => name)
}

/**
 * Retorna todas as features desabilitadas
 */
export function getDisabledFeatures(): string[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([_, flag]) => !flag.enabled)
    .map(([name, _]) => name)
}

/**
 * Valida se uma operação é permitida baseado nas feature flags
 * 
 * @param operation - Nome da operação
 * @returns boolean - true se permitida, false se bloqueada
 * 
 * @example
 * if (!validateFeaturePermission('EMIT_NFCE')) {
 *   throw new Error('Módulo fiscal desabilitado')
 * }
 */
export function validateFeaturePermission(operation: string): boolean {
  const operationToFeature: Record<string, string> = {
    'EMIT_NFCE': 'FISCAL_ENABLED',
    'CANCEL_NFCE': 'FISCAL_ENABLED',
    'CONSULT_NFCE': 'FISCAL_ENABLED',
    'CREATE_SALE': 'PDV_SALES',
    'OPEN_CASH_REGISTER': 'CASH_REGISTER',
    'CLOSE_CASH_REGISTER': 'CASH_REGISTER',
    'CREATE_PRODUCT': 'PRODUCTS',
    'ADJUST_STOCK': 'INVENTORY',
    'VIEW_REPORTS': 'REPORTS',
    'START_TRIAL': 'TRIAL_15_DAYS',
  }
  
  const featureName = operationToFeature[operation]
  
  if (!featureName) {
    console.warn(`Operação "${operation}" não mapeada para feature flag. Permitindo por padrão.`)
    return true
  }
  
  return isFeatureEnabled(featureName)
}

// ============================================
// Backend Validation Guard
// ============================================

/**
 * Guard para operações que requerem validação no backend
 * 
 * @param operation - Nome da operação
 * @throws Error se a operação não for permitida
 * 
 * @example
 * backendValidationGuard('EMIT_NFCE')
 * // Se FISCAL_ENABLED = false, lança erro
 */
export function backendValidationGuard(operation: string): void {
  const operationToFeature: Record<string, string> = {
    'EMIT_NFCE': 'FISCAL_ENABLED',
    'CANCEL_NFCE': 'FISCAL_ENABLED',
    'CONSULT_NFCE': 'FISCAL_ENABLED',
  }
  
  const featureName = operationToFeature[operation]
  
  if (featureName && !isFeatureEnabled(featureName)) {
    const flag = FEATURE_FLAGS[featureName]
    throw new Error(
      `Operação "${operation}" bloqueada. ` +
      `Feature "${featureName}" está desabilitada. ` +
      `${flag?.description || ''}`
    )
  }
}

// ============================================
// Feature Flag Status Report
// ============================================

/**
 * Gera relatório de status das feature flags
 * 
 * @returns string - Relatório formatado
 */
export function getFeatureFlagsReport(): string {
  const lines: string[] = [
    '========================================',
    'VENDDI - Feature Flags Status Report',
    '========================================',
    '',
    'ENABLED FEATURES:',
  ]
  
  Object.entries(FEATURE_FLAGS)
    .filter(([_, flag]) => flag.enabled)
    .forEach(([name, flag]) => {
      lines.push(`  ✅ ${name}: ${flag.description}`)
    })
  
  lines.push('')
  lines.push('DISABLED FEATURES:')
  
  Object.entries(FEATURE_FLAGS)
    .filter(([_, flag]) => !flag.enabled)
    .forEach(([name, flag]) => {
      lines.push(`  ❌ ${name}: ${flag.description}`)
    })
  
  lines.push('')
  lines.push('========================================')
  
  return lines.join('\n')
}

// ============================================
// Export
// ============================================

export default {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getEnabledFeatures,
  getDisabledFeatures,
  validateFeaturePermission,
  backendValidationGuard,
  getFeatureFlagsReport,
}
