import { describe, it, expect } from 'vitest'
import { mapearRespostaFocus, criarAdaptadorFocus, focusBaseUrl, focusPath } from '@/lib/fiscal/focusAdapter'

describe('Mapeamento de respostas Focus NFe (simulado, sem rede)', () => {
  it('autorizado com chave e protocolo vira autorizada', () => {
    const r = mapearRespostaFocus(200, {
      status: 'autorizado',
      chave_nfe: '26110512345678000195650010000000011000000019',
      protocolo: '126000000000001',
      numero: 1,
      serie: 1,
      caminho_danfe: '/danfe.pdf',
    })
    expect(r).toMatchObject({ kind: 'autorizada', protocolo: '126000000000001', numero: '1', serie: '1', danfeUrl: '/danfe.pdf' })
  })

  it('autorizado sem chave é erro técnico retentável (resposta incompleta)', () => {
    expect(mapearRespostaFocus(200, { status: 'autorizado' })).toMatchObject({ kind: 'erro_tecnico', retryable: true })
  })

  it('erro_autorizacao da SEFAZ vira rejeitada com código e motivo', () => {
    expect(
      mapearRespostaFocus(200, { status: 'erro_autorizacao', status_sefaz: '539', mensagem_sefaz: 'Duplicidade de NF-e' })
    ).toEqual({ kind: 'rejeitada', codigo: '539', motivo: 'Duplicidade de NF-e' })
  })

  it('HTTP 422 de validação vira rejeitada sem retentar', () => {
    expect(mapearRespostaFocus(422, { codigo: 'erro_validacao', mensagem: 'CNPJ inválido' })).toEqual({
      kind: 'rejeitada',
      codigo: 'erro_validacao',
      motivo: 'CNPJ inválido',
    })
  })

  it('processando_autorizacao fica processando', () => {
    expect(mapearRespostaFocus(200, { status: 'processando_autorizacao' })).toEqual({ kind: 'processando' })
  })

  it('409 (referência já enviada) vira processando para consulta', () => {
    expect(mapearRespostaFocus(409, {})).toEqual({ kind: 'processando' })
  })

  it('401/403 é erro técnico NÃO retentável (credencial)', () => {
    expect(mapearRespostaFocus(401, {})).toMatchObject({ kind: 'erro_tecnico', retryable: false })
    expect(mapearRespostaFocus(403, {})).toMatchObject({ kind: 'erro_tecnico', retryable: false })
  })

  it('5xx e 429 são erro técnico retentável', () => {
    expect(mapearRespostaFocus(503, {})).toMatchObject({ kind: 'erro_tecnico', retryable: true })
    expect(mapearRespostaFocus(429, {})).toMatchObject({ kind: 'erro_tecnico', retryable: true })
  })

  it('status desconhecido não é tratado como sucesso', () => {
    expect(mapearRespostaFocus(200, { status: 'algo_novo' })).toMatchObject({ kind: 'erro_tecnico' })
  })
})

describe('Adaptador Focus (fetch simulado)', () => {
  it('ambientes: homologação e produção têm hosts distintos', () => {
    expect(focusBaseUrl('homologacao')).toContain('homologacao.focusnfe.com.br')
    expect(focusBaseUrl('producao')).toContain('api.focusnfe.com.br')
    expect(focusPath(65)).toBe('/v2/nfce')
    expect(focusPath(55)).toBe('/v2/nfe')
  })

  it('envia a referência na URL, Basic auth com o token e o payload', async () => {
    let url = ''
    let init: RequestInit | undefined
    const fetchSimulado = (async (u: string, i?: RequestInit) => {
      url = u
      init = i
      return new Response(JSON.stringify({ status: 'processando_autorizacao' }), { status: 200 })
    }) as typeof fetch

    const adaptador = criarAdaptadorFocus({ token: 'TOKEN-DE-TESTE', ambiente: 'homologacao', fetchImpl: fetchSimulado })
    const r = await adaptador.emitir({ reference: 'ref-123', model: 65, payload: { natureza_operacao: 'Venda' }, ambiente: 'homologacao' })

    expect(r).toEqual({ kind: 'processando' })
    expect(url).toBe('https://homologacao.focusnfe.com.br/v2/nfce?ref=ref-123')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Basic ' + btoa('TOKEN-DE-TESTE:'))
    expect(JSON.parse(String(init?.body))).toEqual({ natureza_operacao: 'Venda' })
  })

  it('falha de rede vira erro técnico retentável, sem lançar', async () => {
    const fetchQueCai = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const adaptador = criarAdaptadorFocus({ token: 't', ambiente: 'homologacao', fetchImpl: fetchQueCai })
    const r = await adaptador.emitir({ reference: 'r', model: 65, payload: {}, ambiente: 'homologacao' })
    expect(r).toMatchObject({ kind: 'erro_tecnico', retryable: true })
  })
})
