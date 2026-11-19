/**
 * Adaptador do provedor Focus NFe (candidato escolhido pelo proprietário, sujeito à análise técnica
 * e comercial). Este módulo só traduz: monta a requisição e converte a resposta no ProviderResult
 * neutro de core.ts. NÃO deve rodar no navegador: o token da API fica em secret do servidor.
 *
 * Os nomes de status ('autorizado', 'erro_autorizacao', 'processando_autorizacao', 'denegado') seguem a
 * documentação pública da Focus NFe. Validar contra a homologação antes de qualquer uso real.
 */
import type { FiscalModel, FiscalProviderPort, ProviderResult, Ambiente } from './core'

export function focusBaseUrl(ambiente: Ambiente): string {
  return ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br'
}

export function focusPath(model: FiscalModel): string {
  return model === 65 ? '/v2/nfce' : '/v2/nfe'
}

/** Converte uma resposta HTTP da Focus no resultado neutro. Função pura: testável sem rede. */
export function mapearRespostaFocus(httpStatus: number, corpo: unknown): ProviderResult {
  const body = (corpo ?? {}) as Record<string, any>

  if (httpStatus === 401 || httpStatus === 403) {
    return { kind: 'erro_tecnico', motivo: 'Credencial do provedor recusada', retryable: false }
  }
  if (httpStatus === 409) {
    // Referência já existe no provedor: a nota foi enviada antes. Consultar com a mesma referência.
    return { kind: 'processando' }
  }
  if (httpStatus === 429 || httpStatus >= 500) {
    return { kind: 'erro_tecnico', motivo: `Provedor indisponível (HTTP ${httpStatus})`, retryable: true }
  }
  if (httpStatus === 400 || httpStatus === 422) {
    return {
      kind: 'rejeitada',
      codigo: String(body.codigo ?? 'erro_validacao'),
      motivo: String(body.mensagem ?? 'Dados recusados pelo provedor'),
    }
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { kind: 'erro_tecnico', motivo: `Resposta inesperada (HTTP ${httpStatus})`, retryable: true }
  }

  switch (body.status) {
    case 'autorizado':
      if (!body.chave_nfe || !body.protocolo) {
        return { kind: 'erro_tecnico', motivo: 'Autorização sem chave ou protocolo', retryable: true }
      }
      return {
        kind: 'autorizada',
        chaveAcesso: String(body.chave_nfe),
        protocolo: String(body.protocolo),
        numero: body.numero != null ? String(body.numero) : undefined,
        serie: body.serie != null ? String(body.serie) : undefined,
        xmlUrl: body.caminho_xml_nota_fiscal ?? undefined,
        danfeUrl: body.caminho_danfe ?? undefined,
      }
    case 'erro_autorizacao':
      return {
        kind: 'rejeitada',
        codigo: String(body.status_sefaz ?? 'erro_autorizacao'),
        motivo: String(body.mensagem_sefaz ?? body.mensagem ?? 'Rejeitada pela SEFAZ'),
      }
    case 'denegado':
      return {
        kind: 'denegada',
        codigo: String(body.status_sefaz ?? 'denegado'),
        motivo: String(body.mensagem_sefaz ?? body.mensagem ?? 'Denegada pela SEFAZ'),
      }
    case 'processando_autorizacao':
      return { kind: 'processando' }
    default:
      return { kind: 'erro_tecnico', motivo: `Status desconhecido do provedor: ${String(body.status)}`, retryable: true }
  }
}

export interface FocusOpcoes {
  token: string
  ambiente: Ambiente
  /** Injetável para teste; em produção é o fetch do runtime do servidor */
  fetchImpl?: typeof fetch
}

/** Cria o adaptador que a emissão usa. A referência vai como `ref` na URL (idempotência no provedor). */
export function criarAdaptadorFocus(opcoes: FocusOpcoes): FiscalProviderPort {
  const f = opcoes.fetchImpl ?? fetch
  const base = focusBaseUrl(opcoes.ambiente)
  // Auth Basic: token como usuário e senha vazia (forma da API Focus)
  const auth = 'Basic ' + btoa(opcoes.token + ':')

  return {
    async emitir({ reference, model, payload }) {
      let resposta: Response
      try {
        resposta = await f(`${base}${focusPath(model)}?ref=${encodeURIComponent(reference)}`, {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        return { kind: 'erro_tecnico', motivo: err instanceof Error ? err.message : 'Falha de rede', retryable: true }
      }
      let corpo: unknown = {}
      try {
        corpo = await resposta.json()
      } catch {
        // corpo vazio ou não JSON: o mapeamento decide pelo status HTTP
      }
      return mapearRespostaFocus(resposta.status, corpo)
    },
  }
}
