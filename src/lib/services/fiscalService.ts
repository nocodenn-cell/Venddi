import type { 
  FiscalConfiguration, 
  ProductFiscalData, 
  FiscalDocument, 
  FiscalEvent,
  nfceRequestSchema,
  nfceResponseSchema 
} from '@/lib/schemas/fiscal'
import type { z } from 'zod'

// ============================================
// Fiscal Provider Interface
// ============================================

export interface FiscalProvider {
  /**
   * Emit NFC-e
   */
  emitNfce(
    config: FiscalConfiguration,
    reference: string,
    data: z.infer<typeof nfceRequestSchema>
  ): Promise<z.infer<typeof nfceResponseSchema>>

  /**
   * Consult NFC-e status
   */
  consultNfce(
    config: FiscalConfiguration,
    reference: string
  ): Promise<z.infer<typeof nfceResponseSchema>>

  /**
   * Cancel NFC-e
   */
  cancelNfce(
    config: FiscalConfiguration,
    reference: string,
    justification: string
  ): Promise<{
    status: 'cancelado' | 'erro_cancelamento'
    status_sefaz?: string
    mensagem_sefaz?: string
    caminho_xml_cancelamento?: string
    numero_protocolo?: string
  }>

  /**
   * Inutilize number range
   */
  inutilizeNumbers(
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
  }>

  /**
   * Send NFC-e by email
   */
  sendNfceByEmail(
    config: FiscalConfiguration,
    reference: string,
    emails: string[]
  ): Promise<void>

  /**
   * Get XML URL
   */
  getXmlUrl(
    config: FiscalConfiguration,
    reference: string
  ): Promise<string>

  /**
   * Get DANFE URL
   */
  getDanfeUrl(
    config: FiscalConfiguration,
    reference: string
  ): Promise<string>
}

// ============================================
// Fiscal Service
// ============================================

export class FiscalService {
  private provider: FiscalProvider

  constructor(provider: FiscalProvider) {
    this.provider = provider
  }

  /**
   * Emit NFC-e for a sale
   */
  async emitNfceForSale(params: {
    config: FiscalConfiguration
    sale: {
      id: string
      saleNumber: number
      items: Array<{
        productId: string
        productName: string
        quantity: number
        unitPrice: number
        fiscalData: ProductFiscalData
      }>
      payments: Array<{
        method: string
        amount: number
      }>
      customer?: {
        name?: string
        cpf?: string
        cnpj?: string
      }
      total: number
      discount?: number
    }
  }): Promise<{
    success: boolean
    fiscalDocument?: FiscalDocument
    error?: string
  }> {
    try {
      const reference = crypto.randomUUID()

      // Build NFC-e request
      const nfceRequest = this.buildNfceRequest(params.config, params.sale, reference)

      // Emit NFC-e
      const response = await this.provider.emitNfce(params.config, reference, nfceRequest)

      // Create fiscal document record
      const fiscalDocument: FiscalDocument = {
        id: crypto.randomUUID(),
        companyId: params.config.companyId,
        saleId: params.sale.id,
        documentType: 'nfce',
        reference,
        number: response.numero,
        series: response.serie,
        accessKey: response.chave_nfe,
        status: response.status === 'autorizado' ? 'authorized' : 'rejected',
        sefazStatus: response.status_sefaz,
        sefazMessage: response.mensagem_sefaz,
        xmlPath: response.caminho_xml_nota_fiscal,
        danfePath: response.caminho_danfe,
        qrcodeUrl: response.qrcode_url,
        consultationUrl: response.url_consulta_nf,
        isContingency: response.contingencia_offline || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      return {
        success: response.status === 'autorizado',
        fiscalDocument,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao emitir NFC-e',
      }
    }
  }

  /**
   * Cancel NFC-e
   */
  async cancelNfce(params: {
    config: FiscalConfiguration
    fiscalDocument: FiscalDocument
    justification: string
  }): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await this.provider.cancelNfce(
        params.config,
        params.fiscalDocument.reference,
        params.justification
      )

      if (response.status !== 'cancelado') {
        return {
          success: false,
          error: response.mensagem_sefaz || 'Erro ao cancelar NFC-e',
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao cancelar NFC-e',
      }
    }
  }

  /**
   * Consult NFC-e status
   */
  async consultNfce(params: {
    config: FiscalConfiguration
    reference: string
  }): Promise<{
    success: boolean
    data?: z.infer<typeof nfceResponseSchema>
    error?: string
  }> {
    try {
      const response = await this.provider.consultNfce(params.config, params.reference)
      return {
        success: true,
        data: response,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar NFC-e',
      }
    }
  }

  /**
   * Build NFC-e request from sale data
   */
  private buildNfceRequest(
    config: FiscalConfiguration,
    sale: any,
    reference: string
  ): z.infer<typeof nfceRequestSchema> {
    const items = sale.items.map((item: any, index: number) => ({
      numero_item: String(index + 1),
      codigo_ncm: item.fiscalData.ncm,
      codigo_produto: item.productId,
      descricao: item.productName,
      quantidade_comercial: item.quantity,
      quantidade_tributavel: item.quantity,
      cfop: item.fiscalData.cfop,
      valor_unitario_comercial: item.unitPrice,
      valor_unitario_tributavel: item.unitPrice,
      valor_bruto: item.quantity * item.unitPrice,
      valor_desconto: 0,
      unidade_comercial: item.fiscalData.unit,
      unidade_tributavel: item.fiscalData.unit,
      icms_origem: item.fiscalData.icmsOrigin,
      icms_situacao_tributaria: item.fiscalData.icmsCst,
      pis_situacao_tributaria: item.fiscalData.pisCst,
      cofins_situacao_tributaria: item.fiscalData.cofinsCst,
    }))

    const formasPagamento = sale.payments.map((payment: any) => ({
      forma_pagamento: this.mapPaymentMethod(payment.method),
      valor_pagamento: payment.amount,
    }))

    return {
      cnpj_emitente: config.cnpj.replace(/\D/g, ''),
      data_emissao: new Date().toISOString(),
      presenca_comprador: '1', // Presencial
      modalidade_frete: '9', // Sem frete
      local_destino: '1', // Interna
      natureza_operacao: 'VENDA AO CONSUMIDOR',
      items,
      formas_pagamento: formasPagamento,
      nome_destinatario: sale.customer?.name,
      cpf_destinatario: sale.customer?.cpf,
      cnpj_destinatario: sale.customer?.cnpj,
      indicador_inscricao_estadual_destinatario: '9', // Não contribuinte
    }
  }

  /**
   * Map payment method to Focus NFe code
   */
  private mapPaymentMethod(method: string): string {
    const mapping: Record<string, string> = {
      'cash': '01',
      'check': '02',
      'credit_card': '03',
      'debit_card': '04',
      'store_credit': '05',
      'food_voucher': '10',
      'meal_voucher': '11',
      'gift_voucher': '12',
      'fuel_voucher': '13',
      'boleto': '14',
      'bank_deposit': '15',
      'pix': '16',
      'bank_transfer': '17',
      'credit_card_app': '18',
      'debit_card_app': '19',
      'no_payment': '90',
      'other': '99',
    }

    return mapping[method] || '99'
  }
}

// ============================================
// Export
// ============================================
