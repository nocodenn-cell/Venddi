import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'
import { Shield, CheckCircle, AlertCircle, Settings } from 'lucide-react'

export function FiscalConfigurationPage() {
  const { user, company } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    provider: 'focus_nfe',
    environment: 'homologacao',
    apiToken: '',
    cnpj: company?.cnpj || '',
    stateRegistration: '',
    companyName: company?.name || '',
    tradeName: company?.tradeName || '',
    taxRegime: 'simples_nacional',
    csc: '',
    cscId: '',
    nfceSeries: '1',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate form
      if (!formData.apiToken) {
        throw new Error('Token da API é obrigatório')
      }

      if (!formData.cnpj) {
        throw new Error('CNPJ é obrigatório')
      }

      // TODO: Save to backend
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000))

      setSuccess('Configuração fiscal salva com sucesso!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuração Fiscal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure a emissão de notas fiscais (NFC-e)
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Status: Não Configurado</p>
                <p className="text-sm text-gray-500">
                  Configure o provedor fiscal para emitir NFC-e
                </p>
              </div>
            </div>
            <Badge variant="warning">Pendente</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-start gap-2">
          <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração do Provedor Fiscal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Provedor Fiscal</h3>
              
              <Select
                label="Provedor"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                options={[
                  { value: 'focus_nfe', label: 'Focus NFe' },
                ]}
              />

              <Select
                label="Ambiente"
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                options={[
                  { value: 'homologacao', label: 'Homologação (Testes)' },
                  { value: 'producao', label: 'Produção (Real)' },
                ]}
              />

              <Input
                label="Token da API"
                type="password"
                placeholder="Token gerado no painel do provedor"
                value={formData.apiToken}
                onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                hint="Mantenha este token em segurança. Não compartilhe."
              />
            </div>

            {/* Company Data */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900">Dados da Empresa</h3>

              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />

              <Input
                label="Razão Social"
                placeholder="Nome da empresa"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />

              <Input
                label="Nome Fantasia"
                placeholder="Nome fantasia (opcional)"
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
              />

              <Input
                label="Inscrição Estadual"
                placeholder="IE (opcional)"
                value={formData.stateRegistration}
                onChange={(e) => setFormData({ ...formData, stateRegistration: e.target.value })}
              />
            </div>

            {/* Tax Configuration */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900">Configuração Tributária</h3>

              <Select
                label="Regime Tributário"
                value={formData.taxRegime}
                onChange={(e) => setFormData({ ...formData, taxRegime: e.target.value })}
                options={[
                  { value: 'simples_nacional', label: 'Simples Nacional' },
                  { value: 'lucro_presumido', label: 'Lucro Presumido' },
                  { value: 'lucro_real', label: 'Lucro Real' },
                ]}
              />

              <Input
                label="CSC (Código de Segurança do Contribuinte)"
                type="password"
                placeholder="CSC para NFC-e"
                value={formData.csc}
                onChange={(e) => setFormData({ ...formData, csc: e.target.value })}
                hint="Obrigatório para NFC-e. Obtido na SEFAZ."
              />

              <Input
                label="ID do CSC"
                placeholder="ID do CSC"
                value={formData.cscId}
                onChange={(e) => setFormData({ ...formData, cscId: e.target.value })}
              />
            </div>

            {/* NFC-e Configuration */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900">Configuração NFC-e</h3>

              <Input
                label="Série da NFC-e"
                placeholder="1"
                value={formData.nfceSeries}
                onChange={(e) => setFormData({ ...formData, nfceSeries: e.target.value })}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
              <Button type="submit" isLoading={loading}>
                Salvar Configuração
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-gray-900 mb-2">Informações Importantes</p>
              <ul className="list-disc list-inside space-y-1">
                <li>A configuração fiscal é obrigatória para emitir NFC-e</li>
                <li>O token da API é fornecido pelo provedor fiscal (Focus NFe)</li>
                <li>O CSC é obtido na SEFAZ do seu estado</li>
                <li>Use o ambiente de homologação para testes antes de produzir</li>
                <li>Consulte seu contador para configuração tributária correta</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
