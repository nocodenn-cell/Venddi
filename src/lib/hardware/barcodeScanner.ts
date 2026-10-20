/**
 * Barcode Scanner Integration
 * 
 * Suporta leitores de código de barras via:
 * - HID (Human Interface Device) - modo teclado
 * - Serial/USB
 * - Camera (QR Code)
 */

export interface BarcodeScannerConfig {
  type: 'hid' | 'serial' | 'camera'
  prefix?: string // Prefixo para identificar entrada do scanner
  suffix?: string // Sufixo (geralmente Enter)
  speed?: number // Velocidade mínima de digitação para considerar scanner
}

export interface BarcodeScanResult {
  barcode: string
  timestamp: Date
  source: 'scanner' | 'keyboard' | 'camera'
}

export class BarcodeScanner {
  private config: BarcodeScannerConfig
  private buffer: string = ''
  private lastKeyTime: number = 0
  private onScanCallback: ((result: BarcodeScanResult) => void) | null = null
  private isListening: boolean = false

  constructor(config: BarcodeScannerConfig = { type: 'hid' }) {
    this.config = config
  }

  /**
   * Iniciar escuta de códigos de barras
   */
  startListening(callback: (result: BarcodeScanResult) => void): void {
    this.onScanCallback = callback
    this.isListening = true

    if (this.config.type === 'hid') {
      this.startHIDListening()
    } else if (this.config.type === 'camera') {
      this.startCameraListening()
    }
  }

  /**
   * Parar escuta
   */
  stopListening(): void {
    this.isListening = false
    this.onScanCallback = null

    if (this.config.type === 'hid') {
      this.stopHIDListening()
    } else if (this.config.type === 'camera') {
      this.stopCameraListening()
    }
  }

  /**
   * Escutar entrada HID (modo teclado)
   */
  private startHIDListening(): void {
    document.addEventListener('keydown', this.handleKeyDown)
  }

  private stopHIDListening(): void {
    document.removeEventListener('keydown', this.handleKeyDown)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isListening) return

    const now = Date.now()
    const timeDiff = now - this.lastKeyTime
    this.lastKeyTime = now

    // Ignorar se estiver digitando em um input (a menos que seja muito rápido)
    const target = event.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    
    if (isInput && timeDiff > (this.config.speed || 50)) {
      return
    }

    // Enter - finalizar leitura
    if (event.key === 'Enter') {
      if (this.buffer.length >= 3) { // Mínimo 3 caracteres
        this.processScan(this.buffer)
      }
      this.buffer = ''
      event.preventDefault()
      return
    }

    // Caracteres válidos
    if (event.key.length === 1 && /[0-9A-Za-z\-_.]/.test(event.key)) {
      this.buffer += event.key
      event.preventDefault()
    }
  }

  /**
   * Processar código de barras escaneado
   */
  private processScan(barcode: string): void {
    if (this.onScanCallback) {
      this.onScanCallback({
        barcode,
        timestamp: new Date(),
        source: 'scanner',
      })
    }
  }

  /**
   * Escutar via câmera (QR Code)
   */
  private startCameraListening(): void {
    // Implementação requer biblioteca como jsQR ou zxing
    console.log('Camera scanning not implemented yet')
  }

  private stopCameraListening(): void {
    // Parar câmera
    console.log('Camera scanning stopped')
  }

  /**
   * Simular scan para testes
   */
  simulateScan(barcode: string): void {
    this.processScan(barcode)
  }
}

/**
 * Simulador de scanner para testes
 */
export class MockBarcodeScanner extends BarcodeScanner {
  private scanHistory: BarcodeScanResult[] = []

  constructor(config: BarcodeScannerConfig = { type: 'hid' }) {
    super(config)
  }

  startListening(callback: (result: BarcodeScanResult) => void): void {
    console.log('[Mock Scanner] Iniciando escuta...')
    super.startListening((result) => {
      this.scanHistory.push(result)
      callback(result)
    })
  }

  getScanHistory(): BarcodeScanResult[] {
    return this.scanHistory
  }

  clearHistory(): void {
    this.scanHistory = []
  }
}

/**
 * Hook React para usar scanner
 */
export function useBarcodeScanner(config?: BarcodeScannerConfig) {
  const [lastScan, setLastScan] = useState<BarcodeScanResult | null>(null)
  const [isListening, setIsListening] = useState(false)
  const scannerRef = useRef<BarcodeScanner | null>(null)

  useEffect(() => {
    scannerRef.current = new BarcodeScanner(config)
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stopListening()
      }
    }
  }, [config])

  const startListening = (callback?: (result: BarcodeScanResult) => void) => {
    if (scannerRef.current) {
      scannerRef.current.startListening((result) => {
        setLastScan(result)
        callback?.(result)
      })
      setIsListening(true)
    }
  }

  const stopListening = () => {
    if (scannerRef.current) {
      scannerRef.current.stopListening()
      setIsListening(false)
    }
  }

  return {
    lastScan,
    isListening,
    startListening,
    stopListening,
  }
}

// Imports necessários
import { useState, useEffect, useRef } from 'react'
