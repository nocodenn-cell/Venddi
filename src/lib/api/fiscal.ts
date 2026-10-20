import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { FiscalConfiguration, FiscalDocument, ProductFiscalData } from '@/lib/schemas/fiscal'
import { FiscalService } from '@/lib/services/fiscalService'
import { FocusNFeProvider, MockFiscalProvider } from '@/lib/services/focusNFeProvider'

// ============================================
// Fiscal API Service
// ============================================

/**
 * Get fiscal configuration for a company
 */
export async function getFiscalConfiguration(companyId: string): Promise<FiscalConfiguration | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode - return null (not configured)
    return null
  }

  try {
    const { data, error } = await supabase
      .from('fiscal_configurations')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows
      throw error
    }

    return {
      id: data.id,
      companyId: data.company_id,
      provider: data.provider,
      environment: data.environment,
      apiToken: data.api_token, // Should be decrypted
      cnpj: data.cnpj,
      stateRegistration: data.state_registration,
      municipalRegistration: data.municipal_registration,
      companyName: data.company_name,
      tradeName: data.trade_name,
      address: data.address,
      taxRegime: data.tax_regime,
      csc: data.csc, // Should be decrypted
      cscId: data.csc_id,
      nfceSeries: data.nfce_series,
      nfceNumberStart: data.nfce_number_start,
      isActive: data.is_active,
      isConfigured: data.is_configured,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error fetching fiscal configuration:', error)
    throw new Error('Erro ao carregar configuração fiscal')
  }
}

/**
 * Save fiscal configuration
 */
export async function saveFiscalConfiguration(config: Partial<FiscalConfiguration>): Promise<FiscalConfiguration> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    // TODO: Encrypt apiToken and csc before saving
    const { data, error } = await supabase
      .from('fiscal_configurations')
      .upsert({
        company_id: config.companyId,
        provider: config.provider,
        environment: config.environment,
        api_token: config.apiToken, // Should be encrypted
        cnpj: config.cnpj,
        state_registration: config.stateRegistration,
        municipal_registration: config.municipalRegistration,
        company_name: config.companyName,
        trade_name: config.tradeName,
        address: config.address,
        tax_regime: config.taxRegime,
        csc: config.csc, // Should be encrypted
        csc_id: config.cscId,
        nfce_series: config.nfceSeries,
        nfce_number_start: config.nfceNumberStart,
        is_active: config.isActive,
        is_configured: config.isConfigured,
      }, {
        onConflict: 'company_id,provider'
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      provider: data.provider,
      environment: data.environment,
      apiToken: data.api_token,
      cnpj: data.cnpj,
      stateRegistration: data.state_registration,
      municipalRegistration: data.municipal_registration,
      companyName: data.company_name,
      tradeName: data.trade_name,
      address: data.address,
      taxRegime: data.tax_regime,
      csc: data.csc,
      cscId: data.csc_id,
      nfceSeries: data.nfce_series,
      nfceNumberStart: data.nfce_number_start,
      isActive: data.is_active,
      isConfigured: data.is_configured,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error saving fiscal configuration:', error)
    throw new Error('Erro ao salvar configuração fiscal')
  }
}

/**
 * Get product fiscal data
 */
export async function getProductFiscalData(productId: string): Promise<ProductFiscalData | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('product_fiscal_data')
      .select('*')
      .eq('product_id', productId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return {
      id: data.id,
      productId: data.product_id,
      companyId: data.company_id,
      ncm: data.ncm,
      cfop: data.cfop,
      icmsOrigin: data.icms_origin,
      icmsCst: data.icms_cst,
      icmsBaseCalculation: data.icms_base_calculation,
      icmsRate: data.icms_rate,
      icmsValue: data.icms_value,
      pisCst: data.pis_cst,
      pisBaseCalculation: data.pis_base_calculation,
      pisRate: data.pis_rate,
      pisValue: data.pis_value,
      cofinsCst: data.cofins_cst,
      cofinsBaseCalculation: data.cofins_base_calculation,
      cofinsRate: data.cofins_rate,
      cofinsValue: data.cofins_value,
      unit: data.unit,
      barcode: data.barcode,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error fetching product fiscal data:', error)
    throw new Error('Erro ao carregar dados fiscais do produto')
  }
}

/**
 * Emit NFC-e for a sale
 */
export async function emitNfceForSale(params: {
  companyId: string
  saleId: string
  saleNumber: number
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
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
  useMock?: boolean
}): Promise<{
  success: boolean
  fiscalDocument?: FiscalDocument
  error?: string
}> {
  try {
    // Get fiscal configuration
    const config = await getFiscalConfiguration(params.companyId)
    if (!config) {
      return {
        success: false,
        error: 'Configuração fiscal não encontrada. Configure o provedor fiscal antes de emitir NFC-e.',
      }
    }

    if (!config.isConfigured) {
      return {
        success: false,
        error: 'Configuração fiscal incompleta. Verifique os dados da empresa e token da API.',
      }
    }

    // Get fiscal data for all products
    const itemsWithFiscalData = await Promise.all(
      params.items.map(async (item) => {
        const fiscalData = await getProductFiscalData(item.productId)
        if (!fiscalData) {
          throw new Error(`Dados fiscais não encontrados para o produto ${item.productName}`)
        }
        return {
          ...item,
          fiscalData,
        }
      })
    )

    // Create fiscal service with appropriate provider
    const provider = params.useMock
      ? new MockFiscalProvider()
      : new FocusNFeProvider(config.environment)

    const fiscalService = new FiscalService(provider)

    // Emit NFC-e
    const result = await fiscalService.emitNfceForSale({
      config,
      sale: {
        id: params.saleId,
        saleNumber: params.saleNumber,
        items: itemsWithFiscalData,
        payments: params.payments,
        customer: params.customer,
        total: params.total,
        discount: params.discount,
      },
    })

    // Save fiscal document to database
    if (result.success && result.fiscalDocument && isSupabaseConfigured && supabase) {
      const { error: saveError } = await supabase
        .from('fiscal_documents')
        .insert({
          company_id: result.fiscalDocument.companyId,
          sale_id: result.fiscalDocument.saleId,
          document_type: result.fiscalDocument.documentType,
          reference: result.fiscalDocument.reference,
          number: result.fiscalDocument.number,
          series: result.fiscalDocument.series,
          access_key: result.fiscalDocument.accessKey,
          status: result.fiscalDocument.status,
          sefaz_status: result.fiscalDocument.sefazStatus,
          sefaz_message: result.fiscalDocument.sefazMessage,
          protocol_number: result.fiscalDocument.protocolNumber,
          authorization_date: result.fiscalDocument.authorizationDate,
          xml_path: result.fiscalDocument.xmlPath,
          danfe_path: result.fiscalDocument.danfePath,
          qrcode_url: result.fiscalDocument.qrcodeUrl,
          consultation_url: result.fiscalDocument.consultationUrl,
          is_contingency: result.fiscalDocument.isContingency,
        })

      if (saveError) {
        console.error('Error saving fiscal document:', saveError)
        // Don't fail the emission if save fails
      }

      // Create fiscal event
      await supabase.from('fiscal_events').insert({
        fiscal_document_id: result.fiscalDocument.id,
        company_id: result.fiscalDocument.companyId,
        event_type: 'emission_completed',
        status: result.fiscalDocument.status,
        sefaz_status: result.fiscalDocument.sefazStatus,
        sefaz_message: result.fiscalDocument.sefazMessage,
        protocol_number: result.fiscalDocument.protocolNumber,
      })
    }

    return result
  } catch (error) {
    console.error('Error emitting NFC-e:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao emitir NFC-e',
    }
  }
}

/**
 * Cancel NFC-e
 */
export async function cancelNfce(params: {
  companyId: string
  fiscalDocumentId: string
  justification: string
  useMock?: boolean
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Get fiscal configuration
    const config = await getFiscalConfiguration(params.companyId)
    if (!config) {
      return {
        success: false,
        error: 'Configuração fiscal não encontrada',
      }
    }

    // Get fiscal document
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase não configurado',
      }
    }

    const { data: document, error: docError } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('id', params.fiscalDocumentId)
      .eq('company_id', params.companyId)
      .single()

    if (docError || !document) {
      return {
        success: false,
        error: 'Documento fiscal não encontrado',
      }
    }

    if (document.status !== 'authorized') {
      return {
        success: false,
        error: 'Apenas documentos autorizados podem ser cancelados',
      }
    }

    // Create fiscal service
    const provider = params.useMock
      ? new MockFiscalProvider()
      : new FocusNFeProvider(config.environment)

    const fiscalService = new FiscalService(provider)

    // Cancel NFC-e
    const result = await fiscalService.cancelNfce({
      config,
      fiscalDocument: {
        id: document.id,
        companyId: document.company_id,
        saleId: document.sale_id,
        documentType: document.document_type,
        reference: document.reference,
        number: document.number,
        series: document.series,
        accessKey: document.access_key,
        status: document.status,
        sefazStatus: document.sefaz_status,
        sefazMessage: document.sefaz_message,
        protocolNumber: document.protocol_number,
        authorizationDate: document.authorization_date,
        xmlPath: document.xml_path,
        danfePath: document.danfe_path,
        qrcodeUrl: document.qrcode_url,
        consultationUrl: document.consultation_url,
        isContingency: document.is_contingency,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      },
      justification: params.justification,
    })

    // Update fiscal document
    if (result.success) {
      await supabase
        .from('fiscal_documents')
        .update({
          status: 'cancelled',
          cancellation_date: new Date().toISOString(),
          cancellation_justification: params.justification,
        })
        .eq('id', params.fiscalDocumentId)

      // Create fiscal event
      await supabase.from('fiscal_events').insert({
        fiscal_document_id: params.fiscalDocumentId,
        company_id: params.companyId,
        event_type: 'cancellation_completed',
        status: 'cancelled',
      })
    }

    return result
  } catch (error) {
    console.error('Error cancelling NFC-e:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao cancelar NFC-e',
    }
  }
}

/**
 * Get fiscal documents for a sale
 */
export async function getFiscalDocumentsBySale(saleId: string): Promise<FiscalDocument[]> {
  if (!isSupabaseConfigured || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('fiscal_documents')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((doc) => ({
      id: doc.id,
      companyId: doc.company_id,
      saleId: doc.sale_id,
      documentType: doc.document_type,
      reference: doc.reference,
      number: doc.number,
      series: doc.series,
      accessKey: doc.access_key,
      status: doc.status,
      sefazStatus: doc.sefaz_status,
      sefazMessage: doc.sefaz_message,
      protocolNumber: doc.protocol_number,
      authorizationDate: doc.authorization_date,
      xmlPath: doc.xml_path,
      danfePath: doc.danfe_path,
      qrcodeUrl: doc.qrcode_url,
      consultationUrl: doc.consultation_url,
      cancellationDate: doc.cancellation_date,
      cancellationJustification: doc.cancellation_justification,
      cancellationProtocol: doc.cancellation_protocol,
      isContingency: doc.is_contingency,
      contingencyEffectiveDate: doc.contingency_effective_date,
      errorMessage: doc.error_message,
      errorDetails: doc.error_details,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    }))
  } catch (error) {
    console.error('Error fetching fiscal documents:', error)
    return []
  }
}
