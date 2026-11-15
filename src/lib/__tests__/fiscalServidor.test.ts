import { describe, it, expect } from 'vitest'
import { processarAcaoFiscal, podeEmitirFiscal, type RepositorioServidor, type UsuarioAutenticado, type AcaoFiscalInput } from '@/lib/fiscal/servidor'
import type { FiscalDocument, FiscalProviderPort, FiscalStatus, ProviderResult } from '@/lib/fiscal/core'

function repo(doc: Partial<FiscalDocument> = {}) {
  const d: FiscalDocument = { id: 'd1', companyId: 'co-A', saleId: 's1', reference: 'r1', model: 65, status: 'pending', attempts: 0, ...doc }
  const r: RepositorioServidor = {
    async get(id) { return id === d.id ? { ...d } : null },
    async update(id, esperado, patch) {
      if (id !== d.id || d.status !== esperado) return false
      Object.assign(d, patch)
      return true
    },
  }
  return { repo: r, d }
}

function provedor(res: ProviderResult[]) {
  const chamadas: string[] = []
  const p: FiscalProviderPort = {
    async emitir({ reference }) {
      chamadas.push(reference)
      return res[Math.min(chamadas.length - 1, res.length - 1)]
    },
  }
  return { p, chamadas }
}

const dono: UsuarioAutenticado = { id: 'u1', companyId: 'co-A', role: 'owner', isActive: true }
const caixa: UsuarioAutenticado = { id: 'u2', companyId: 'co-A', role: 'cashier', isActive: true }
const gerente: UsuarioAutenticado = { id: 'u3', companyId: 'co-A', role: 'manager', isActive: true }
const donoOutra: UsuarioAutenticado = { id: 'u9', companyId: 'co-B', role: 'owner', isActive: true }
const AUTORIZADA: ProviderResult = { kind: 'autorizada', chaveAcesso: '2611', protocolo: 'P1' }

function input(over: Partial<AcaoFiscalInput> = {}): AcaoFiscalInput {
  return {
    acao: 'emitir', documentoId: 'd1', usuario: gerente, ambiente: 'homologacao',
    producaoHabilitada: false, payload: {}, maxTentativas: 2, esperar: async () => {}, ...over,
  }
}

describe('Permissões da emissão fiscal', () => {
  it('dono, admin e gerente podem; caixa e vendedor não', () => {
    expect(podeEmitirFiscal(dono, 'co-A')).toBeNull()
    expect(podeEmitirFiscal({ ...gerente, role: 'admin' }, 'co-A')).toBeNull()
    expect(podeEmitirFiscal(caixa, 'co-A')).toBe('papel_sem_permissao')
    expect(podeEmitirFiscal({ ...caixa, role: 'salesperson' }, 'co-A')).toBe('papel_sem_permissao')
  })

  it('sem sessão, usuário inativo ou de outra empresa são recusados', () => {
    expect(podeEmitirFiscal(null, 'co-A')).toBe('nao_autenticado')
    expect(podeEmitirFiscal({ ...dono, isActive: false }, 'co-A')).toBe('usuario_inativo')
    expect(podeEmitirFiscal(donoOutra, 'co-A')).toBe('empresa_diferente')
  })
})

describe('processarAcaoFiscal', () => {
  it('gerente emite em homologação e o documento fica autorizado', async () => {
    const { repo: r, d } = repo()
    const { p, chamadas } = provedor([AUTORIZADA])
    const res = await processarAcaoFiscal(input(), { repo: r, provedor: p })
    expect(res.ok).toBe(true)
    expect(d.status).toBe('authorized')
    expect(chamadas).toEqual(['r1'])
  })

  it('dono de outra empresa não age sobre o documento e o provedor não é chamado', async () => {
    const { repo: r, d } = repo()
    const { p, chamadas } = provedor([AUTORIZADA])
    const res = await processarAcaoFiscal(input({ usuario: donoOutra }), { repo: r, provedor: p })
    expect(res).toMatchObject({ ok: false, erro: 'empresa_diferente' })
    expect(chamadas).toHaveLength(0)
    expect(d.status).toBe('pending')
  })

  it('caixa não emite (papel), mesmo sendo da mesma empresa', async () => {
    const { repo: r } = repo()
    const { p, chamadas } = provedor([AUTORIZADA])
    const res = await processarAcaoFiscal(input({ usuario: caixa }), { repo: r, provedor: p })
    expect(res).toMatchObject({ ok: false, erro: 'papel_sem_permissao' })
    expect(chamadas).toHaveLength(0)
  })

  it('produção é recusada mesmo com a flag ligada, sem tocar no documento', async () => {
    const { repo: r, d } = repo()
    const { p, chamadas } = provedor([AUTORIZADA])
    const res1 = await processarAcaoFiscal(input({ ambiente: 'producao' }), { repo: r, provedor: p })
    const res2 = await processarAcaoFiscal(input({ producaoHabilitada: true }), { repo: r, provedor: p })
    expect(res1).toMatchObject({ ok: false, erro: 'producao_bloqueada' })
    expect(res2).toMatchObject({ ok: false, erro: 'producao_bloqueada' })
    expect(chamadas).toHaveLength(0)
    expect(d.status).toBe('pending')
  })

  it('consultar e cancelar são recusados como não implementados (sem efeito)', async () => {
    const { repo: r, d } = repo({ status: 'authorized' })
    const { p, chamadas } = provedor([AUTORIZADA])
    const c = await processarAcaoFiscal(input({ acao: 'consultar' }), { repo: r, provedor: p })
    const x = await processarAcaoFiscal(input({ acao: 'cancelar' }), { repo: r, provedor: p })
    expect(c).toMatchObject({ ok: false, erro: 'acao_nao_implementada' })
    expect(x).toMatchObject({ ok: false, erro: 'acao_nao_implementada' })
    expect(chamadas).toHaveLength(0)
    expect(d.status).toBe('authorized')
  })

  it('reenviar usa a MESMA referência de um pendente com erro técnico', async () => {
    const { repo: r, d } = repo({ status: 'pending', attempts: 1 })
    const { p, chamadas } = provedor([{ kind: 'erro_tecnico', motivo: 'timeout', retryable: true }, AUTORIZADA])
    const res = await processarAcaoFiscal(input({ acao: 'reenviar', maxTentativas: 3 }), { repo: r, provedor: p })
    expect(res.ok).toBe(true)
    expect(new Set(chamadas)).toEqual(new Set(['r1']))
    expect(d.status).toBe('authorized')
  })

  it('reenviar um documento já autorizado não envia nada', async () => {
    const { repo: r } = repo({ status: 'authorized' })
    const { p, chamadas } = provedor([AUTORIZADA])
    const res = await processarAcaoFiscal(input({ acao: 'reenviar' }), { repo: r, provedor: p })
    expect(res).toMatchObject({ ok: false, erro: 'reenvio_sem_pendencia' })
    expect(chamadas).toHaveLength(0)
  })

  it('documento inexistente é reportado sem exceção', async () => {
    const { repo: r } = repo()
    const { p } = provedor([AUTORIZADA])
    const res = await processarAcaoFiscal(input({ documentoId: 'nao-existe' }), { repo: r, provedor: p })
    expect(res).toMatchObject({ ok: false, erro: 'documento_nao_encontrado' })
  })

  it('estado final rejeitado não é reenviado (idempotência do estado)', async () => {
    const { repo: r } = repo({ status: 'rejected' as FiscalStatus })
    const { p, chamadas } = provedor([AUTORIZADA])
    const res = await processarAcaoFiscal(input({ acao: 'emitir' }), { repo: r, provedor: p })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.resultado.chamadasAoProvedor).toBe(0)
    expect(chamadas).toHaveLength(0)
  })
})
