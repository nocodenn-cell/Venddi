import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui'
import { Printer, ScanLine, Wallet, CheckCircle, XCircle } from 'lucide-react'
import { printReceiptViaBrowser } from '@/lib/hardware/browserReceiptPrinter'
import type { ReceiptData, ReceiptPaperWidth } from '@/lib/hardware/receiptFormat'
import { attachBarcodeKeyboardReader } from '@/lib/hardware/barcodeKeyboardReader'
import { MockCashDrawer, CashDrawerConfig } from '@/lib/hardware/cashDrawer'

const TEST_RECEIPT: ReceiptData = {
  storeName: 'VENDDI - Teste',
  saleNumber: 1,
  date: new Date().toLocaleString('pt-BR'),
  items: [
    { name: 'Produto Teste', quantity: 1, unitPrice: 10 },
    { name: 'Produto com nome bem comprido para testar a quebra de linha', quantity: 2, unitPrice: 2.5 },
  ],
  subtotal: 15,
  discount: 0,
  total: 15,
  payments: [{ method: 'cash', amount: 15 }],
}

export function HardwareSettingsPage() {
  const [drawerStatus, setDrawerStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')
  const [scannerListening, setScannerListening] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const [scannerSpeed, setScannerSpeed] = useState(50)
  const [printing, setPrinting] = useState(false)
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>(80)

  const stopScannerRef = useRef<(() => void) | null>(null)

  const [drawerConfig, setDrawerConfig] = useState<CashDrawerConfig>({
    type: 'printer',
    pin: 0,
  })

  // Parar a escuta do leitor ao sair da página
  useEffect(() => {
    return () => {
      stopScannerRef.current?.()
      stopScannerRef.current = null
    }
  }, [])

  const handleTestPrinter = async () => {
    setPrinting(true)
    try {
      const ok = await printReceiptViaBrowser({ ...TEST_RECEIPT, date: new Date().toLocaleString('pt-BR') }, paperWidth)
      if (!ok) alert('Não foi possível abrir a impressão neste navegador.')
    } finally {
      setPrinting(false)
    }
  }

  const handleStartScanner = () => {
    stopScannerRef.current?.()
    stopScannerRef.current = attachBarcodeKeyboardReader({
      maxInterKeyMs: scannerSpeed,
      onScan: (barcode) => setLastScannedCode(barcode),
    })
    setScannerListening(true)
  }

  const handleStopScanner = () => {
    stopScannerRef.current?.()
    stopScannerRef.current = null
    setScannerListening(false)
  }

  const handleConnectDrawer = async () => {
    try {
      const drawer = new MockCashDrawer(drawerConfig)
      const opened = await drawer.open()
      setDrawerStatus(opened ? 'connected' : 'error')
    } catch (error) {
      setDrawerStatus('error')
    }
  }

  const handleTestDrawer = async () => {
    const drawer = new MockCashDrawer(drawerConfig)
    await drawer.open()
    alert('Teste de gaveta enviado! (simulado: a gaveta não é acionada fisicamente)')
  }

  const getStatusIcon = (status: 'disconnected' | 'connected' | 'error') => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: 'disconnected' | 'connected' | 'error') => {
    switch (status) {
      case 'connected':
        return 'Conectado'
      case 'error':
        return 'Erro'
      default:
        return 'Desconectado'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações de Hardware</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure impressoras, scanners e gavetas de dinheiro
        </p>
      </div>

      {/* Thermal Printer (via navegador) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-[#0EA572]" />
              Impressora de Cupom
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon('connected')}
              <span className="text-sm text-gray-600">Pronto (navegador)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Impressão pelo navegador (window.print), sem driver. Funciona com qualquer impressora
            instalada no Windows. No diálogo de impressão, escolha a impressora térmica e
            desative cabeçalho, rodapé e margens.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Largura do Papel
              </label>
              <Select
                value={paperWidth.toString()}
                onChange={(e) => setPaperWidth(parseInt(e.target.value) as ReceiptPaperWidth)}
                options={[
                  { value: '58', label: '58mm' },
                  { value: '80', label: '80mm' },
                ]}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleTestPrinter} disabled={printing}>
              {printing ? 'Abrindo impressão...' : 'Imprimir Cupom de Teste'}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Conexão ESC/POS direta (USB, rede, serial) ainda não está ligada: ver src/lib/hardware/README.md.
          </p>
        </CardContent>
      </Card>

      {/* Barcode Scanner (modo teclado) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-[#0EA572]" />
              Leitor de Código de Barras
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon(scannerListening ? 'connected' : 'disconnected')}
              <span className="text-sm text-gray-600">{scannerListening ? 'Escutando' : 'Parado'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Modo teclado (HID): o leitor envia o código em rajada seguida de Enter. Ao iniciar a escuta,
            basta escanear um código nesta página.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tempo máximo entre teclas (ms)
              </label>
              <Input
                type="number"
                value={scannerSpeed}
                disabled={scannerListening}
                onChange={(e) => setScannerSpeed(parseInt(e.target.value) || 50)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {scannerListening ? (
              <Button onClick={handleStopScanner} variant="outline">
                Parar Escuta
              </Button>
            ) : (
              <Button onClick={handleStartScanner}>
                Iniciar Escuta
              </Button>
            )}
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-600">Último código lido: </span>
            <code className="font-mono text-gray-900">{lastScannedCode ?? '—'}</code>
          </div>
        </CardContent>
      </Card>

      {/* Cash Drawer (simulada) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#0EA572]" />
              Gaveta de Dinheiro
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon(drawerStatus)}
              <span className="text-sm text-gray-600">{getStatusText(drawerStatus)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Simulada. A abertura da gaveta depende de driver ESC/POS, que ainda não está ligado.
            Ver src/lib/hardware/README.md.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Conexão
              </label>
              <Select
                value={drawerConfig.type}
                onChange={(e) => setDrawerConfig({ ...drawerConfig, type: e.target.value as any })}
                options={[
                  { value: 'printer', label: 'Via Impressora' },
                  { value: 'usb', label: 'USB Direto' },
                  { value: 'serial', label: 'Serial' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pino de Abertura
              </label>
              <Select
                value={drawerConfig.pin?.toString() || '0'}
                onChange={(e) => setDrawerConfig({ ...drawerConfig, pin: parseInt(e.target.value) })}
                options={[
                  { value: '0', label: 'Pino 0' },
                  { value: '1', label: 'Pino 1' },
                ]}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleConnectDrawer} variant="outline">
              Conectar
            </Button>
            <Button onClick={handleTestDrawer} disabled={drawerStatus !== 'connected'}>
              Testar Gaveta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
