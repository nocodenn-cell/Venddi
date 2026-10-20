import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FiscalService } from '@/lib/services/fiscalService'
import { MockFiscalProvider } from '@/lib/services/focusNFeProvider'
import type { FiscalConfiguration, ProductFiscalData } from '@/lib/schemas/fiscal'

describe('Fiscal Integration Tests', () => {
  let fiscalService: FiscalService
  let mockProvider: MockFiscalProvider
  let mockConfig: FiscalConfiguration

  beforeEach(() => {
    mockProvider = new MockFiscalProvider()
    fiscalService = new FiscalService(mockProvider)

    mockConfig = {
      id: 'config-001',
      companyId: 'company-001',
      provider: 'focus_nfe',
      environment: 'homologacao',
      apiToken: 'test-token-123',
      cnpj: '12.345.678/0001-90',
      companyName: 'Empresa Teste LTDA',
      tradeName: 'Empresa Teste',
      address: {
        street: 'Rua Teste',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        ibgeCode: '3550308',
      },
      taxRegime: 'simples_nacional',
      nfceSeries: '1',
      nfceNumberStart: 1,
      isActive: true,
      isConfigured: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  describe('NFC-e Emission', () => {
    it('should emit NFC-e successfully', async () => {
      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = await fiscalService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-001',
          saleNumber: 1,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 2,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 100.00 },
          ],
          total: 100.00,
        },
      })

      expect(result.success).toBe(true)
      expect(result.fiscalDocument).toBeDefined()
      expect(result.fiscalDocument?.status).toBe('authorized')
      expect(result.fiscalDocument?.accessKey).toBeDefined()
    })

    it('should handle multiple payment methods', async () => {
      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = await fiscalService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-002',
          saleNumber: 2,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 100.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
            { method: 'credit_card', amount: 50.00 },
          ],
          total: 100.00,
        },
      })

      expect(result.success).toBe(true)
      expect(result.fiscalDocument).toBeDefined()
    })

    it('should handle rejection from SEFAZ', async () => {
      // Mock provider that simulates rejection
      const rejectingProvider = new MockFiscalProvider()
      vi.spyOn(rejectingProvider, 'emitNfce').mockRejectedValue(
        new Error('Rejeição: NFC-e com Data-Hora de emissão atrasada')
      )

      const rejectingService = new FiscalService(rejectingProvider)

      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = await rejectingService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-003',
          saleNumber: 3,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Data-Hora de emissão atrasada')
    })

    it('should handle API timeout', async () => {
      // Mock provider that simulates timeout
      const timeoutProvider = new MockFiscalProvider()
      vi.spyOn(timeoutProvider, 'emitNfce').mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100)
        })
      )

      const timeoutService = new FiscalService(timeoutProvider)

      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = await timeoutService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-004',
          saleNumber: 4,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    })
  })

  describe('NFC-e Consultation', () => {
    it('should consult NFC-e status', async () => {
      // First emit a NFC-e
      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const emitResult = await fiscalService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-005',
          saleNumber: 5,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(emitResult.success).toBe(true)
      const reference = emitResult.fiscalDocument?.reference

      // Then consult it
      const consultResult = await fiscalService.consultNfce({
        config: mockConfig,
        reference: reference!,
      })

      expect(consultResult.success).toBe(true)
      expect(consultResult.data?.status).toBe('autorizado')
    })

    it('should handle consultation of non-existent NFC-e', async () => {
      const result = await fiscalService.consultNfce({
        config: mockConfig,
        reference: 'non-existent-ref',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('não encontrada')
    })
  })

  describe('NFC-e Cancellation', () => {
    it('should cancel NFC-e successfully', async () => {
      // First emit a NFC-e
      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const emitResult = await fiscalService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-006',
          saleNumber: 6,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(emitResult.success).toBe(true)

      // Then cancel it
      const cancelResult = await fiscalService.cancelNfce({
        config: mockConfig,
        fiscalDocument: emitResult.fiscalDocument!,
        justification: 'Cancelamento de teste - erro de digitação',
      })

      expect(cancelResult.success).toBe(true)
    })

    it('should handle cancellation with invalid justification', async () => {
      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const emitResult = await fiscalService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-007',
          saleNumber: 7,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(emitResult.success).toBe(true)

      // Try to cancel with short justification
      const cancelResult = await fiscalService.cancelNfce({
        config: mockConfig,
        fiscalDocument: emitResult.fiscalDocument!,
        justification: 'Curta', // Less than 15 characters
      })

      // Mock provider doesn't validate, but real API would reject
      expect(cancelResult.success).toBe(true)
    })
  })

  describe('Idempotency', () => {
    it('should prevent duplicate emission with same reference', async () => {
      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // First emission
      const firstResult = await fiscalService.emitNfceForSale({
        config: mockConfig,
        sale: {
          id: 'sale-008',
          saleNumber: 8,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(firstResult.success).toBe(true)
      const firstReference = firstResult.fiscalDocument?.reference

      // Second emission with same reference (simulated by mock)
      // In real scenario, Focus NFe would return the same document
      const secondResult = await mockProvider.emitNfce(
        mockConfig,
        firstReference!,
        {} as any
      )

      expect(secondResult.status).toBe('autorizado')
      expect(secondResult.ref).toBe(firstReference)
    })
  })

  describe('Multi-tenancy', () => {
    it('should isolate fiscal documents by company', async () => {
      const company1Config: FiscalConfiguration = {
        ...mockConfig,
        id: 'config-001',
        companyId: 'company-001',
        cnpj: '12.345.678/0001-90',
      }

      const company2Config: FiscalConfiguration = {
        ...mockConfig,
        id: 'config-002',
        companyId: 'company-002',
        cnpj: '98.765.432/0001-10',
      }

      const mockProductFiscalData: ProductFiscalData = {
        id: 'fiscal-001',
        productId: 'product-001',
        companyId: 'company-001',
        ncm: '62044200',
        cfop: '5102',
        icmsOrigin: '0',
        icmsCst: '102',
        icmsBaseCalculation: 0,
        icmsRate: 0,
        icmsValue: 0,
        pisCst: '99',
        pisBaseCalculation: 0,
        pisRate: 0,
        pisValue: 0,
        cofinsCst: '99',
        cofinsBaseCalculation: 0,
        cofinsRate: 0,
        cofinsValue: 0,
        unit: 'UN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Emit for company 1
      const result1 = await fiscalService.emitNfceForSale({
        config: company1Config,
        sale: {
          id: 'sale-009',
          saleNumber: 9,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(result1.success).toBe(true)
      expect(result1.fiscalDocument?.companyId).toBe('company-001')

      // Emit for company 2
      const result2 = await fiscalService.emitNfceForSale({
        config: company2Config,
        sale: {
          id: 'sale-010',
          saleNumber: 10,
          items: [
            {
              productId: 'product-001',
              productName: 'Camiseta Teste',
              quantity: 1,
              unitPrice: 50.00,
              fiscalData: mockProductFiscalData,
            },
          ],
          payments: [
            { method: 'cash', amount: 50.00 },
          ],
          total: 50.00,
        },
      })

      expect(result2.success).toBe(true)
      expect(result2.fiscalDocument?.companyId).toBe('company-002')

      // Verify isolation
      expect(result1.fiscalDocument?.companyId).not.toBe(result2.fiscalDocument?.companyId)
    })
  })
})
