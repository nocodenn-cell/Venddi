import { describe, it, expect } from 'vitest'
import {
  canTransition,
  assertTransition,
  FiscalTransitionError,
  FiscalBloqueadoError,
  escolherModelo,
  emitirDocumento,
  type FiscalDocument,
  type FiscalProviderPort,
  type FiscalRepositoryPort,
  type FiscalStatus,
  type ProviderResult,
} from '@/lib/fiscal/core'

// ---------- Repositório em memória com compare-and-set (simula a atualização condicional do banco)
function repoEmMemoria(inicial: Partial<FiscalDocument> = {}) {
  const doc: FiscalDocument = {
    id: 'doc-1',
    companyId: 'co-1',
    saleId: 'sale-1',
    reference: 'ref-1',
    model: 65,
    status: 'pending',
    attempts: 0,
    ...inicial,
  }
  const historico: FiscalStatus[] = [doc.status]
  const repo: FiscalRepositoryPort = {
    async get(id) {
      return id === doc.id ? { ...doc } : null
    },
    async update(id, esperado, patch) {
      if (id !== doc.id || doc.status !== esperado) return false
      Object.assign(doc, patch)
      historico.push(doc.status)
      return true
    },
  }
  return { repo, doc, historico }
}

// ---------- Provedor simulado: devolve uma sequência de resultados e conta chamadas
function provedorRoteiro(roteiro: Array<ProviderResult | 'lancar'>) {
  const chamadas: Array<{ reference: string; model: number }> = []
  const provedor: FiscalProviderPort = {
    async emitir({ reference, model }) {
      chamadas.push({ reference, model })
      const proximo = roteiro[Math.min(chamadas.length - 1, roteiro.length - 1)]
      if (proximo === 'lancar') throw new Error('socket hang up')
      return proximo
    },
  }
  return { provedor, chamadas }
}

const AUTORIZADA: ProviderResult = {
  kind: 'autorizada',
  chaveAcesso: '26110512345678000195650010000000011000000019',
  protocolo: '126000000000001',
  numero: '1',
  serie: '1',
}

const OPCOES_HOMOLOG = { ambiente: 'homologacao' as const, producaoHabilitada: false, maxTentativas: 3, payload: {} }
const sem_espera = async () => {}

describe('Máquina de estados fiscal', () => {
  it('permite o caminho normal pending → processing → authorized', () => {
    expect(canTransition('pending', 'processing')).toBe(true)
    expect(canTransition('processing', 'authorized')).toBe(true)
  })

  it('não permite voltar de um estado final para emissão', () => {
    expect(canTransition('authorized', 'processing')).toBe(false)
    expect(canTransition('rejected', 'processing')).toBe(false)
    expect(canTransition('denied', 'authorized')).toBe(false)
  })

  it('só cancela documento autorizado', () => {
    expect(canTransition('authorized', 'cancelled')).toBe(true)
    expect(canTransition('pending', 'cancelled')).toBe(false)
    expect(canTransition('rejected', 'cancelled')).toBe(false)
  })

  it('assertTransition lança erro para transição inválida', () => {
    expect(() => assertTransition('authorized', 'pending')).toThrow(FiscalTransitionError)
  })
})

describe('Regra de modelo (NFC-e 65 / NF-e 55)', () => {
  const base = { total: 50, destinatarioIdentificado: false, regraEmpresa: 'nfce' as const, limiteNfceSemIdentificacao: 10000 }

  it('venda comum vira NFC-e 65', () => {
    expect(escolherModelo(base).model).toBe(65)
  })

  it('bloqueia NFC-e sem identificação acima do limite', () => {
    expect(() => escolherModelo({ ...base, total: 10000.01 })).toThrow(FiscalBloqueadoError)
  })

  it('aceita valor acima do limite quando o destinatário está identificado', () => {
    expect(escolherModelo({ ...base, total: 12000, destinatarioIdentificado: true }).model).toBe(65)
  })

  it('regra da empresa para NF-e de varejo com crédito gera modelo 55', () => {
    expect(escolherModelo({ ...base, regraEmpresa: 'nfe_varejo_credito' }).model).toBe(55)
  })

  it('rejeita total negativo ou inválido', () => {
    expect(() => escolherModelo({ ...base, total: -1 })).toThrow()
    expect(() => escolherModelo({ ...base, total: NaN })).toThrow()
  })
})

describe('Emissão idempotente', () => {
  it('autorizada na primeira tentativa: uma chamada, estado authorized', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([AUTORIZADA])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('authorized')
    expect(chamadas).toHaveLength(1)
    expect(doc.accessKey).toBe(AUTORIZADA.kind === 'autorizada' ? AUTORIZADA.chaveAcesso : '')
    expect(doc.protocol).toBe('126000000000001')
  })

  it('reenvio de um documento já autorizado não chama o provedor', async () => {
    const { repo, doc } = repoEmMemoria({ status: 'authorized' })
    const { provedor, chamadas } = provedorRoteiro([AUTORIZADA])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('authorized')
    expect(r.chamadasAoProvedor).toBe(0)
    expect(chamadas).toHaveLength(0)
  })

  it('rejeição de regra de negócio não é retentada e fica rejected com o motivo', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([{ kind: 'rejeitada', codigo: '539', motivo: 'Duplicidade de NF-e' }])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('rejected')
    expect(chamadas).toHaveLength(1)
    expect(doc.lastMessage).toBe('539: Duplicidade de NF-e')
  })

  it('erro técnico seguido de sucesso: retenta com a MESMA referência e autoriza', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([
      { kind: 'erro_tecnico', motivo: 'timeout', retryable: true },
      { kind: 'erro_tecnico', motivo: '503', retryable: true },
      AUTORIZADA,
    ])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('authorized')
    expect(chamadas).toHaveLength(3)
    expect(new Set(chamadas.map((c) => c.reference))).toEqual(new Set(['ref-1']))
  })

  it('exceção de rede do adaptador conta como erro técnico retentável', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro(['lancar', AUTORIZADA])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('authorized')
    expect(chamadas).toHaveLength(2)
  })

  it('erro técnico persistente volta para pending (fila de reenvio), com motivo gravado', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([{ kind: 'erro_tecnico', motivo: 'indisponível', retryable: true }])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, maxTentativas: 3, esperar: sem_espera })
    expect(r.status).toBe('pending')
    expect(chamadas).toHaveLength(3)
    expect(doc.status).toBe('pending')
    expect(doc.lastMessage).toContain('após 3 tentativas')
  })

  it('erro não retentável (credencial) devolve para pending sem repetir a chamada', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([{ kind: 'erro_tecnico', motivo: 'Credencial recusada', retryable: false }])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('pending')
    expect(chamadas).toHaveLength(1)
    expect(doc.lastMessage).toContain('não retentável')
  })

  it('SEFAZ ainda processando: fica processing para consulta posterior', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([{ kind: 'processando' }])
    const r = await emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(r.status).toBe('processing')
    expect(chamadas).toHaveLength(1)
    expect(doc.status).toBe('processing')
  })

  it('dois processos ao mesmo tempo: só um envia (compare-and-set)', async () => {
    const { repo, doc } = repoEmMemoria()
    // Simula outro processo ganhando a corrida: o update condicional falha na primeira tentativa
    const repoCorrida: FiscalRepositoryPort = {
      get: repo.get,
      async update(id, esperado, patch) {
        if (patch.status === 'processing') {
          doc.status = 'processing' // o outro processo já marcou
          return false
        }
        return repo.update(id, esperado, patch)
      },
    }
    const { provedor, chamadas } = provedorRoteiro([AUTORIZADA])
    const r = await emitirDocumento(repoCorrida, provedor, doc.id, { ...OPCOES_HOMOLOG, esperar: sem_espera })
    expect(chamadas).toHaveLength(0)
    expect(r.mensagem).toContain('Outro processo')
  })

  it('produção bloqueada por padrão: lança antes de tocar no documento ou no provedor', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor, chamadas } = provedorRoteiro([AUTORIZADA])
    await expect(
      emitirDocumento(repo, provedor, doc.id, { ...OPCOES_HOMOLOG, ambiente: 'producao', esperar: sem_espera })
    ).rejects.toThrow(FiscalBloqueadoError)
    expect(chamadas).toHaveLength(0)
    expect(doc.status).toBe('pending')
  })

  it('produção só passa se producaoHabilitada for explicitamente true', async () => {
    const { repo, doc } = repoEmMemoria()
    const { provedor } = provedorRoteiro([AUTORIZADA])
    const r = await emitirDocumento(repo, provedor, doc.id, {
      ...OPCOES_HOMOLOG,
      ambiente: 'producao',
      producaoHabilitada: true,
      esperar: sem_espera,
    })
    expect(r.status).toBe('authorized')
  })
})
