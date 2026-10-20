/**
 * Cash Drawer Integration
 * 
 * Suporta gavetas de dinheiro via:
 * - Impressora térmica (comando ESC/POS)
 * - USB direto
 * - Serial
 */

export interface CashDrawerConfig {
  type: 'printer' | 'usb' | 'serial'
  printer?: any // Referência à impressora conectada
  pin?: number // Pino de abertura (geralmente 0 ou 1)
  pulseDuration?: number // Duração do pulso em ms (padrão: 100)
}

export class CashDrawer {
  private config: CashDrawerConfig
  private isOpen: boolean = false

  constructor(config: CashDrawerConfig) {
    this.config = config
  }

  /**
   * Abrir gaveta de dinheiro
   */
  async open(): Promise<boolean> {
    try {
      if (this.config.type === 'printer' && this.config.printer) {
        // Abrir via impressora (comando ESC/POS)
        const commands = [
          0x1B, // ESC
          0x70, // p
          this.config.pin || 0x00, // Pino (0 ou 1)
          0x19, // t1 (25ms)
          0xFF, // t2 (255ms)
        ]

        await this.config.printer.transferOut(1, new Uint8Array(commands))
        this.isOpen = true
        return true
      } else if (this.config.type === 'usb') {
        // Abrir via USB direto
        console.log('USB cash drawer opening not implemented yet')
        return false
      } else if (this.config.type === 'serial') {
        // Abrir via serial
        console.log('Serial cash drawer opening not implemented yet')
        return false
      }

      return false
    } catch (error) {
      console.error('Erro ao abrir gaveta de dinheiro:', error)
      return false
    }
  }

  /**
   * Verificar status da gaveta
   */
  async getStatus(): Promise<{ isOpen: boolean; connected: boolean }> {
    return {
      isOpen: this.isOpen,
      connected: this.config.type === 'printer' && !!this.config.printer,
    }
  }

  /**
   * Fechar gaveta (simulado - gavetas reais fecham automaticamente)
   */
  async close(): Promise<void> {
    this.isOpen = false
  }
}

/**
 * Simulador de gaveta para testes
 */
export class MockCashDrawer extends CashDrawer {
  private openHistory: Date[] = []

  constructor(config: CashDrawerConfig) {
    super(config)
  }

  async open(): Promise<boolean> {
    console.log('[Mock Cash Drawer] Abrindo gaveta...')
    this.openHistory.push(new Date())
    return true
  }

  getOpenHistory(): Date[] {
    return this.openHistory
  }

  clearHistory(): void {
    this.openHistory = []
  }
}

/**
 * Hook React para usar gaveta
 */
export function useCashDrawer(config?: CashDrawerConfig) {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<CashDrawer | null>(null)

  useEffect(() => {
    if (config) {
      drawerRef.current = new CashDrawer(config)
    }
  }, [config])

  const open = async () => {
    if (drawerRef.current) {
      const success = await drawerRef.current.open()
      if (success) {
        setIsOpen(true)
        // Fechar após 2 segundos (simulação)
        setTimeout(() => setIsOpen(false), 2000)
      }
      return success
    }
    return false
  }

  return {
    isOpen,
    open,
  }
}

// Imports necessários
import { useState, useEffect, useRef } from 'react'
