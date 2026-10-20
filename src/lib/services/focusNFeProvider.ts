import type { FiscalProvider } from './fiscalService'
import type { FiscalConfiguration } from '@/lib/schemas/fiscal'
import type { z } from 'zod'
import type { nfceRequestSchema, nfceResponseSchema } from '@/lib/schemas/fiscal'

// ============================================
// Focus NFe API Client
// ============================================

export class FocusNFeProvider implements FiscalProvider {
  private baseUrl: string

  constructor(environment: 'homologacao' | 'producao') {
    this.baseUrl = environment === 'producao'
      ? 'https://api.focusnfe.com.br/v2'
      : 'https://homologacao.focusnfe.com.br/v2'
  }

  /**
   * Make authenticated request to Focus NFe API
   */
  private async request<T>(
    method: string,
    path: string,
    token: string,
    body?: any
  ): Promise<T> {
    const auth = btoa(token + ':')
    
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.mensagem || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Emit NFC-e
   */
  async emitNfce(
    config: FiscalConfiguration,
    reference: string,
    data: z.infer<typeof nfceRequestSchema>
  ): Promise<z.infer<typeof nfceResponseSchema>> {
    return this.request(
      'POST',
      `/nfce?ref=${reference}`,
      config.apiToken,
      data
    )
  }

  /**
   * Consult NFC-e status
   */
  async consultNfce(
    config: FiscalConfiguration,
    reference: string
  ): Promise<z.infer<typeof nfceResponseSchema>> {
    return this.request(
      'GET',
      `/nfce/${reference}?completa=1`,
      config.apiToken
    )
  }

  /**
   * Cancel NFC-e
   */
  async cancelNfce(
    config: FiscalConfiguration,
    reference: string,
    justification: string
  ): Promise<{
    status: 'cancelado' | 'erro_cancelamento'
    status_sefaz?: string
    mensagem_sefaz?: string
    caminho_xml_cancelamento?: string
    numero_protocolo?: string
  }> {
    return this.request(
      'DELETE',
      `/nfce/${reference}`,
      config.apiToken,
      { justificativa: justification }
    )
  }

  /**
   * Inutilize number range
   */
  async inutilizeNumbers(
    config: FiscalConfiguration,
    series: string,
    numberStart: number,
    numberEnd: number,
    justification: string
  ): Promise<{
    status: 'autorizado' | 'erro_autorizacao'
    status_sefaz?: string
    mensagem_sefaz?: string
    protocolo_sefaz?: string
  }> {
    return this.request(
      'POST',
      '/nfce/inutilizacao',
      config.apiToken,
      {
        cnpj: config.cnpj.replace(/\D/g, ''),
        serie: series,
        numero_inicial: String(numberStart),
        numero_final: String(numberEnd),
        justificativa: justification,
      }
    )
  }

  /**
   * Send NFC-e by email
   */
  async sendNfceByEmail(
    config: FiscalConfiguration,
    reference: string,
    emails: string[]
  ): Promise<void> {
    await this.request(
      'POST',
      `/nfce/${reference}/email`,
      config.apiToken,
      { emails }
    )
  }

  /**
   * Get XML URL
   */
  async getXmlUrl(
    config: FiscalConfiguration,
    reference: string
  ): Promise<string> {
    const response = await this.request<any>(
      'GET',
      `/nfce/${reference}/xml`,
      config.apiToken
    )
    return response.url || response.caminho_xml
  }

  /**
   * Get DANFE URL
   */
  async getDanfeUrl(
    config: FiscalConfiguration,
    reference: string
  ): Promise<string> {
    const response = await this.request<any>(
      'GET',
      `/nfce/${reference}/danfe`,
      config.apiToken
    )
    return response.url || response.caminho_danfe
  }
}

// ============================================
// Mock Provider (for testing)
// ============================================

export class MockFiscalProvider implements FiscalProvider {
  private documents: Map<string, any> = new Map()

  async emitNfce(
    config: FiscalConfiguration,
    reference: string,
    data: z.infer<typeof nfceRequestSchema>
  ): Promise<z.infer<typeof nfceResponseSchema>> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const mockResponse = {
      cnpj_emitente: data.cnpj_emitente,
      ref: reference,
      status: 'autorizado' as const,
      status_sefaz: '100',
      mensagem_sefaz: 'Autorizado o uso da NF-e',
      chave_nfe: `NFe411906${data.cnpj_emitente}650010000000121743484310`,
      numero: String(Math.floor(Math.random() * 1000000)),
      serie: config.nfceSeries,
      caminho_xml_nota_fiscal: `/arquivos/${reference}.xml`,
      caminho_danfe: `/danfe/${reference}.html`,
      qrcode_url: `http://www.fazenda.pr.gov.br/nfce/qrcode/?p=${reference}`,
      url_consulta_nf: 'http://www.fazenda.pr.gov.br/nfce/consulta',
    }

    this.documents.set(reference, mockResponse)
    return mockResponse
  }

  async consultNfce(
    config: FiscalConfiguration,
    reference: string
  ): Promise<z.infer<typeof nfceResponseSchema>> {
    await new Promise(resolve => setTimeout(resolve, 200))

    const doc = this.documents.get(reference)
    if (!doc) {
      throw new Error('NFC-e não encontrada')
    }

    return doc
  }

  async cancelNfce(
    config: FiscalConfiguration,
    reference: string,
    justification: string
  ): Promise<{
    status: 'cancelado' | 'erro_cancelamento'
    status_sefaz?: string
    mensagem_sefaz?: string
    caminho_xml_cancelamento?: string
    numero_protocolo?: string
  }> {
    await new Promise(resolve => setTimeout(resolve, 300))

    const doc = this.documents.get(reference)
    if (!doc) {
      throw new Error('NFC-e não encontrada')
    }

    doc.status = 'cancelado'
    doc.status_sefaz = '135'
    doc.mensagem_sefaz = 'Evento registrado e vinculado a NF-e'
    doc.caminho_xml_cancelamento = `/arquivos/${reference}-canc.xml`
    doc.numero_protocolo = String(Math.floor(Math.random() * 1000000))

    return {
      status: 'cancelado',
      status_sefaz: '135',
      mensagem_sefaz: 'Evento registrado e vinculado a NF-e',
      caminho_xml_cancelamento: doc.caminho_xml_cancelamento,
      numero_protocolo: doc.numero_protocolo,
    }
  }

  async inutilizeNumbers(
    config: FiscalConfiguration,
    series: string,
    numberStart: number,
    numberEnd: number,
    justification: string
  ): Promise<{
    status: 'autorizado' | 'erro_autorizacao'
    status_sefaz?: string
    mensagem_sefaz?: string
    protocolo_sefaz?: string
  }> {
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      status: 'autorizado',
      status_sefaz: '102',
      mensagem_sefaz: 'Inutilizacao de numero homologado',
      protocolo_sefaz: String(Math.floor(Math.random() * 1000000)),
    }
  }

  async sendNfceByEmail(
    config: FiscalConfiguration,
    reference: string,
    emails: string[]
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200))
    console.log(`[Mock] Enviando NFC-e ${reference} para:`, emails)
  }

  async getXmlUrl(
    config: FiscalConfiguration,
    reference: string
  ): Promise<string> {
    return `/arquivos/${reference}.xml`
  }

  async getDanfeUrl(
    config: FiscalConfiguration,
    reference: string
  ): Promise<string> {
    return `/danfe/${reference}.html`
  }
}
