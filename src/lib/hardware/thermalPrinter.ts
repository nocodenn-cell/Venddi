/**
 * Thermal Printer Integration (ESC/POS)
 * 
 * Suporta impressoras térmicas via:
 * - WebUSB API (navegadores modernos)
 * - Network printing (impressoras de rede)
 * - Serial port (impressoras USB/serial)
 */

// WebUSB types (simplified)
interface USBDevice {
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>
}

interface USBOutTransferResult {
  bytesWritten: number
  status: 'ok' | 'stall' | 'babble'
}

interface USBInTransferResult {
  data?: DataView
  status: 'ok' | 'stall' | 'babble'
}

interface Navigator {
  usb?: {
    requestDevice(options: { filters: Array<{ classCode?: number; vendorId?: number; productId?: number }> }): Promise<USBDevice>
  }
}

export interface PrinterConfig {
  type: 'usb' | 'network' | 'serial'
  name: string
  address?: string // Para impressoras de rede
  paperWidth?: 58 | 80 // mm
  autoCut?: boolean
  density?: number // 1-8
}

export interface PrintJob {
  lines: PrintLine[]
  cut?: boolean
  openCashDrawer?: boolean
}

export interface PrintLine {
  type: 'text' | 'barcode' | 'qrcode' | 'image' | 'divider' | 'feed'
  content?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  size?: 'normal' | 'double'
  width?: number
  height?: number
}

export class ThermalPrinter {
  private config: PrinterConfig
  private device: USBDevice | null = null

  constructor(config: PrinterConfig) {
    this.config = config
  }

  /**
   * Conectar à impressora USB
   */
  async connectUSB(): Promise<boolean> {
    try {
      const nav = navigator as any
      if (!nav.usb) {
        throw new Error('WebUSB não suportado neste navegador')
      }

      this.device = await nav.usb.requestDevice({
        filters: [{ classCode: 7 }] // Printer class
      })

      if (!this.device) {
        throw new Error('Nenhuma impressora selecionada')
      }

      await this.device.open()
      await this.device.selectConfiguration(1)
      await this.device.claimInterface(0)

      return true
    } catch (error) {
      console.error('Erro ao conectar impressora USB:', error)
      return false
    }
  }

  /**
   * Desconectar da impressora
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.releaseInterface(0)
        await this.device.close()
        this.device = null
      } catch (error) {
        console.error('Erro ao desconectar impressora:', error)
      }
    }
  }

  /**
   * Imprimir job
   */
  async print(job: PrintJob): Promise<boolean> {
    try {
      if (!this.device) {
        throw new Error('Impressora não conectada')
      }

      // Construir comandos ESC/POS
      const commands: number[] = []

      // Inicializar impressora
      commands.push(0x1B, 0x40) // ESC @

      // Processar linhas
      for (const line of job.lines) {
        commands.push(...this.processLine(line))
      }

      // Cortar papel se necessário
      if (job.cut !== false && this.config.autoCut !== false) {
        commands.push(0x1D, 0x56, 0x00) // GS V 0 (cut)
      }

      // Abrir gaveta de dinheiro se necessário
      if (job.openCashDrawer) {
        commands.push(0x1B, 0x70, 0x00, 0x19, 0xFF) // ESC p 0 25 255
      }

      // Enviar comandos para impressora
      await this.device.transferOut(1, new Uint8Array(commands))

      return true
    } catch (error) {
      console.error('Erro ao imprimir:', error)
      return false
    }
  }

  /**
   * Processar linha de impressão
   */
  private processLine(line: PrintLine): number[] {
    const commands: number[] = []

    switch (line.type) {
      case 'text':
        // Alinhamento
        if (line.align === 'center') {
          commands.push(0x1B, 0x61, 0x01) // ESC a 1
        } else if (line.align === 'right') {
          commands.push(0x1B, 0x61, 0x02) // ESC a 2
        } else {
          commands.push(0x1B, 0x61, 0x00) // ESC a 0
        }

        // Negrito
        if (line.bold) {
          commands.push(0x1B, 0x45, 0x01) // ESC E 1
        }

        // Tamanho
        if (line.size === 'double') {
          commands.push(0x1D, 0x21, 0x11) // GS ! 17
        }

        // Texto
        if (line.content) {
          const encoder = new TextEncoder()
          commands.push(...encoder.encode(line.content))
        }

        // Reset formatação
        commands.push(0x1B, 0x40) // ESC @
        commands.push(0x0A) // LF (line feed)
        break

      case 'barcode':
        if (line.content) {
          // Code 128
          commands.push(0x1D, 0x6B, 0x49) // GS k 73
          commands.push(line.content.length)
          const encoder = new TextEncoder()
          commands.push(...encoder.encode(line.content))
          commands.push(0x0A)
        }
        break

      case 'qrcode':
        // QR Code (simplificado - requer biblioteca específica)
        if (line.content) {
          commands.push(0x1D, 0x28, 0x6B) // GS ( k
          // ... implementação completa requer biblioteca QR
        }
        break

      case 'divider':
        const width = this.config.paperWidth === 80 ? 48 : 32
        const divider = '-'.repeat(width)
        const encoder = new TextEncoder()
        commands.push(...encoder.encode(divider))
        commands.push(0x0A)
        break

      case 'feed':
        const lines = line.height || 1
        for (let i = 0; i < lines; i++) {
          commands.push(0x0A)
        }
        break
    }

    return commands
  }

  /**
   * Imprimir recibo de venda
   */
  async printSalesReceipt(sale: {
    saleNumber: number
    date: string
    items: Array<{ name: string; quantity: number; price: number }>
    subtotal: number
    discount: number
    total: number
    payments: Array<{ method: string; amount: number }>
    change?: number
  }): Promise<boolean> {
    const lines: PrintLine[] = [
      { type: 'text', content: 'VENDDI', align: 'center', bold: true, size: 'double' },
      { type: 'text', content: 'Comprovante de Venda', align: 'center' },
      { type: 'divider' },
      { type: 'text', content: `Venda #${sale.saleNumber}` },
      { type: 'text', content: `Data: ${sale.date}` },
      { type: 'divider' },
    ]

    // Itens
    for (const item of sale.items) {
      lines.push({
        type: 'text',
        content: `${item.quantity}x ${item.name}`,
      })
      lines.push({
        type: 'text',
        content: `  R$ ${item.price.toFixed(2)} = R$ ${(item.quantity * item.price).toFixed(2)}`,
        align: 'right',
      })
    }

    lines.push({ type: 'divider' })

    // Totais
    lines.push({ type: 'text', content: `Subtotal: R$ ${sale.subtotal.toFixed(2)}` })
    if (sale.discount > 0) {
      lines.push({ type: 'text', content: `Desconto: -R$ ${sale.discount.toFixed(2)}` })
    }
    lines.push({ type: 'text', content: `TOTAL: R$ ${sale.total.toFixed(2)}`, bold: true })
    lines.push({ type: 'divider' })

    // Pagamentos
    for (const payment of sale.payments) {
      const methodName = {
        cash: 'Dinheiro',
        credit_card: 'Cartão Crédito',
        debit_card: 'Cartão Débito',
        pix: 'PIX',
      }[payment.method] || payment.method

      lines.push({ type: 'text', content: `${methodName}: R$ ${payment.amount.toFixed(2)}` })
    }

    if (sale.change && sale.change > 0) {
      lines.push({ type: 'text', content: `Troco: R$ ${sale.change.toFixed(2)}` })
    }

    lines.push({ type: 'divider' })
    lines.push({ type: 'text', content: 'Obrigado pela preferência!', align: 'center' })
    lines.push({ type: 'feed', height: 3 })

    return this.print({
      lines,
      cut: true,
      openCashDrawer: sale.payments.some(p => p.method === 'cash'),
    })
  }

  /**
   * Verificar status da impressora
   */
  async getStatus(): Promise<{ connected: boolean; paperStatus?: string }> {
    if (!this.device) {
      return { connected: false }
    }

    try {
      // Enviar comando de status
      await this.device.transferOut(1, new Uint8Array([0x10, 0x04, 0x01])) // ESC p 1
      
      // Ler resposta (simplificado)
      const result = await this.device.transferIn(1, 8)
      
      return {
        connected: true,
        paperStatus: 'OK', // Implementação completa requer análise do status
      }
    } catch (error) {
      return { connected: false }
    }
  }
}

/**
 * Simulador de impressora para testes
 */
export class MockThermalPrinter extends ThermalPrinter {
  private printHistory: PrintJob[] = []

  constructor(config: PrinterConfig) {
    super(config)
  }

  async connectUSB(): Promise<boolean> {
    console.log('[Mock Printer] Conectando...')
    return true
  }

  async disconnect(): Promise<void> {
    console.log('[Mock Printer] Desconectando...')
  }

  async print(job: PrintJob): Promise<boolean> {
    console.log('[Mock Printer] Imprimindo job:', job)
    this.printHistory.push(job)
    return true
  }

  getPrintHistory(): PrintJob[] {
    return this.printHistory
  }

  clearHistory(): void {
    this.printHistory = []
  }
}
