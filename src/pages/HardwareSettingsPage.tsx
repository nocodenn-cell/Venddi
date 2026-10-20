import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui'
import { Printer, ScanLine, Wallet, CheckCircle, XCircle, Settings } from 'lucide-react'
import { ThermalPrinter, MockThermalPrinter, PrinterConfig } from '@/lib/hardware/thermalPrinter'
import { BarcodeScanner, MockBarcodeScanner, BarcodeScannerConfig } from '@/lib/hardware/barcodeScanner'
import { CashDrawer, MockCashDrawer, CashDrawerConfig } from '@/lib/hardware/cashDrawer'

export function HardwareSettingsPage() {
  const [printerStatus, setPrinterStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')
  const [scannerStatus, setScannerStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')
  const [drawerStatus, setDrawerStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')

  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    type: 'usb',
    name: 'Impressora Padrão',
    paperWidth: 80,
    autoCut: true,
  })

  const [scannerConfig, setScannerConfig] = useState<BarcodeScannerConfig>({
    type: 'hid',
    speed: 50,
  })

  const [drawerConfig, setDrawerConfig] = useState<CashDrawerConfig>({
    type: 'printer',
    pin: 0,
  })

  const handleConnectPrinter = async () => {
    try {
      const printer = new MockThermalPrinter(printerConfig)
      const connected = await printer.connectUSB()
      setPrinterStatus(connected ? 'connected' : 'error')
    } catch (error) {
      setPrinterStatus('error')
    }
  }

  const handleTestPrinter = async () => {
    const printer = new MockThermalPrinter(printerConfig)
    await printer.printSalesReceipt({
      saleNumber: 1,
      date: new Date().toLocaleString('pt-BR'),
      items: [
        { name: 'Produto Teste', quantity: 1, price: 10.00 },
      ],
      subtotal: 10.00,
      discount: 0,
      total: 10.00,
      payments: [
        { method: 'cash', amount: 10.00 },
      ],
    })
    alert('Teste de impressão enviado!')
  }

  const handleConnectScanner = async () => {
    try {
      const scanner = new MockBarcodeScanner(scannerConfig)
      scanner.startListening((result) => {
        console.log('Código de barras escaneado:', result.barcode)
      })
      setScannerStatus('connected')
    } catch (error) {
      setScannerStatus('error')
    }
  }

  const handleTestScanner = () => {
    const scanner = new MockBarcodeScanner(scannerConfig)
    scanner.simulateScan('7891234567890')
    alert('Teste de scanner enviado! Verifique o console.')
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
    alert('Teste de gaveta enviado!')
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

      {/* Thermal Printer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-[#0EA572]" />
              Impressora Térmica
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon(printerStatus)}
              <span className="text-sm text-gray-600">{getStatusText(printerStatus)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Conexão
              </label>
              <Select
                value={printerConfig.type}
                onChange={(e) => setPrinterConfig({ ...printerConfig, type: e.target.value as any })}
                options={[
                  { value: 'usb', label: 'USB' },
                  { value: 'network', label: 'Rede' },
                  { value: 'serial', label: 'Serial' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Largura do Papel
              </label>
              <Select
                value={printerConfig.paperWidth?.toString() || '80'}
                onChange={(e) => setPrinterConfig({ ...printerConfig, paperWidth: parseInt(e.target.value) as 58 | 80 })}
                options={[
                  { value: '58', label: '58mm' },
                  { value: '80', label: '80mm' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoCut"
              checked={printerConfig.autoCut}
              onChange={(e) => setPrinterConfig({ ...printerConfig, autoCut: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="autoCut" className="text-sm text-gray-700">
              Corte automático de papel
            </label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleConnectPrinter} variant="outline">
              Conectar
            </Button>
            <Button onClick={handleTestPrinter} disabled={printerStatus !== 'connected'}>
              Testar Impressão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Scanner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-[#0EA572]" />
              Leitor de Código de Barras
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon(scannerStatus)}
              <span className="text-sm text-gray-600">{getStatusText(scannerStatus)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Conexão
              </label>
              <Select
                value={scannerConfig.type}
                onChange={(e) => setScannerConfig({ ...scannerConfig, type: e.target.value as any })}
                options={[
                  { value: 'hid', label: 'HID (Teclado)' },
                  { value: 'serial', label: 'Serial' },
                  { value: 'camera', label: 'Câmera' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Velocidade (ms)
              </label>
              <Input
                type="number"
                value={scannerConfig.speed || 50}
                onChange={(e) => setScannerConfig({ ...scannerConfig, speed: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleConnectScanner} variant="outline">
              Conectar
            </Button>
            <Button onClick={handleTestScanner} disabled={scannerStatus !== 'connected'}>
              Testar Scanner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cash Drawer */}
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
