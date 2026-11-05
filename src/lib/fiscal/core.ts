/**
 * Núcleo da emissão fiscal (NFC-e / NF-e varejo). Sem rede, sem banco, sem React:
 * tudo recebe suas dependências por parâmetro, então é testável com provedor e repositório simulados.
 *
 * Regras de segurança desta camada:
 * - Emissão real (ambiente 'producao') fica BLOQUEADA a menos que `producaoHabilitada` seja true.
 *   Nada no código atual passa esse parâmetro como true.
 * - O navegador nunca chama o provedor: quem chama é o servidor (Edge Function), com o token em secret.
 * - Estados são validados por transição: um documento autorizado ou rejeitado não volta a ser emitido.
 */

// ============================================
// Estados do documento fiscal
// (mesmos valores de fiscal_documents.status na migration 009, e mesma tabela de transições
// que a trigger da migration 032 aplica no banco)
// ============================================

export type FiscalStatus =
  | 'pending'
  | 'processing'
  | 'authorized'
  | 'rejected'
  | 'denied'
  | 'contingency'
  | 'cancelled'

export const FISCAL_TRANSITIONS: Record<FiscalStatus, readonly FiscalStatus[]> = {
  // pendente: aguardando envio; pode ir para processamento ou contingência (offline)
  pending: ['processing', 'contingency'],
  // processando: aguardando a SEFAZ. Erro técnico devolve para 'pending' (retentativa por job).
  processing: ['authorized', 'rejected', 'denied', 'pending', 'contingency'],
  // contingência: emitida offline, precisa ser transmitida depois
  contingency: ['processing', 'authorized', 'rejected'],
  // estados finais de autorização: só cancelamento é permitido a partir de 'authorized'
  authorized: ['cancelled'],
  rejected: [],
  denied: [],
  cancelled: [],
}

export class FiscalTransitionError extends Error {
  constructor(from: FiscalStatus, to: FiscalStatus) {
    super(`Transição fiscal inválida: ${from} → ${to}`)
    this.name = 'FiscalTransitionError'
  }
}

export function canTransition(from: FiscalStatus, to: FiscalStatus): boolean {
  return FISCAL_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: FiscalStatus, to: FiscalStatus): void {
  if (!canTransition(from, to)) throw new FiscalTransitionError(from, to)
}

// ============================================
// Resultado normalizado do provedor
// ============================================

export type ProviderResult =
  | { kind: 'autorizada'; chaveAcesso: string; protocolo: string; numero?: string; serie?: string; xmlUrl?: string; danfeUrl?: string }
  | { kind: 'rejeitada'; codigo: string; motivo: string }
  | { kind: 'denegada'; codigo: string; motivo: string }
  | { kind: 'processando' }
  | { kind: 'erro_tecnico'; motivo: string; retryable: boolean }

export interface FiscalDocument {
  id: string
  companyId: string
  saleId: string
  reference: string
  model: FiscalModel
  status: FiscalStatus
  attempts: number
  lastMessage?: string
  accessKey?: string
  protocol?: string
  number?: string
  series?: string
}

export type FiscalModel = 55 | 65

export interface FiscalProviderPort {
  /** Envia o documento. `reference` é a chave de idempotência no provedor (mesma em toda retentativa). */
  emitir(input: { reference: string; model: FiscalModel; payload: unknown; ambiente: Ambiente }): Promise<ProviderResult>
}

export interface FiscalRepositoryPort {
  get(id: string): Promise<FiscalDocument | null>
  /**
   * Atualização condicional (compare-and-set): só grava se o status atual ainda for `expectedStatus`.
   * Retorna false quando outro processo já mudou o documento.
   */
  update(id: string, expectedStatus: FiscalStatus, patch: Partial<Omit<FiscalDocument, 'id' | 'companyId' | 'saleId' | 'reference' | 'model'>>): Promise<boolean>
}

export type Ambiente = 'homologacao' | 'producao'

export class FiscalBloqueadoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FiscalBloqueadoError'
  }
}

// ============================================
// Regra de modelo (NFC-e 65 ou NF-e 55)
// Decisão tributária: o contador define a regra por empresa. Não há data ou regra fixa no código.
// ============================================

export interface ModelRuleInput {
  /** Valor total da venda em R$ */
  total: number
  /** true quando o cliente foi identificado por CPF/CNPJ */
  destinatarioIdentificado: boolean
  /** Regra configurada pelo contador para a empresa */
  regraEmpresa: 'nfce' | 'nfe_varejo_credito'
  /** Limite de valor da NFC-e sem identificação do destinatário (definido por UF; padrão de referência 10.000) */
  limiteNfceSemIdentificacao: number
}

export function escolherModelo(input: ModelRuleInput): { model: FiscalModel; motivo: string } {
  if (input.total < 0 || !Number.isFinite(input.total)) {
    throw new Error('Total inválido para emissão fiscal')
  }
  if (input.regraEmpresa === 'nfe_varejo_credito') {
    return { model: 55, motivo: 'Regra da empresa: NF-e modelo 55 para varejo com crédito de ICMS' }
  }
  if (!input.destinatarioIdentificado && input.total > input.limiteNfceSemIdentificacao) {
    throw new FiscalBloqueadoError(
      `Venda de R$ ${input.total.toFixed(2)} acima do limite de R$ ${input.limiteNfceSemIdentificacao.toFixed(2)} da NFC-e sem identificação do consumidor: informe CPF/CNPJ`
    )
  }
  return { model: 65, motivo: 'NFC-e modelo 65 (padrão de varejo ao consumidor)' }
}

// ============================================
// Orquestração: emissão idempotente com retentativa
// ============================================

export interface EmitirOpcoes {
  ambiente: Ambiente
  /** Só true quando a homologação fiscal estiver concluída. Hoje nada passa true. */
  producaoHabilitada: boolean
  /** Máximo de tentativas de envio de um erro técnico antes de devolver para 'pending' */
  maxTentativas: number
  /** Espera entre tentativas (injetável para teste) */
  esperar?: (ms: number) => Promise<void>
  /** Payload já montado pelo adaptador */
  payload: unknown
}

export type ResultadoEmissao = {
  status: FiscalStatus
  chamadasAoProvedor: number
  mensagem?: string
}

const STATUS_PARA_EMITIR: FiscalStatus[] = ['pending', 'contingency', 'processing']

export async function emitirDocumento(
  repo: FiscalRepositoryPort,
  provedor: FiscalProviderPort,
  documentoId: string,
  opcoes: EmitirOpcoes
): Promise<ResultadoEmissao> {
  if (opcoes.ambiente === 'producao' && !opcoes.producaoHabilitada) {
    throw new FiscalBloqueadoError('Emissão fiscal em produção não habilitada: a homologação ainda não foi concluída')
  }

  const doc = await repo.get(documentoId)
  if (!doc) throw new Error('Documento fiscal não encontrado')

  // Idempotência: estados finais não chamam o provedor de novo.
  if (!STATUS_PARA_EMITIR.includes(doc.status)) {
    return { status: doc.status, chamadasAoProvedor: 0, mensagem: 'Documento já no estado final; nada a fazer' }
  }

  // Marca como em processamento antes de chamar o provedor. Se outro processo já pegou, não envia.
  if (doc.status !== 'processing') {
    assertTransition(doc.status, 'processing')
    const marcado = await repo.update(documentoId, doc.status, { status: 'processing' })
    if (!marcado) {
      const atual = await repo.get(documentoId)
      return { status: atual?.status ?? doc.status, chamadasAoProvedor: 0, mensagem: 'Outro processo está emitindo este documento' }
    }
  }

  const esperar = opcoes.esperar ?? (() => Promise.resolve())
  let chamadas = 0
  let ultimaMensagem = ''

  for (let tentativa = 1; tentativa <= opcoes.maxTentativas; tentativa++) {
    chamadas++
    let resultado: ProviderResult
    try {
      resultado = await provedor.emitir({
        reference: doc.reference,
        model: doc.model,
        payload: opcoes.payload,
        ambiente: opcoes.ambiente,
      })
    } catch (err) {
      // Queda de rede ou exceção do adaptador: erro técnico, pode retentar com a mesma referência.
      resultado = { kind: 'erro_tecnico', motivo: err instanceof Error ? err.message : 'Falha de comunicação', retryable: true }
    }

    switch (resultado.kind) {
      case 'autorizada':
        await gravar(repo, documentoId, 'processing', {
          status: 'authorized',
          accessKey: resultado.chaveAcesso,
          protocol: resultado.protocolo,
          number: resultado.numero,
          series: resultado.serie,
          attempts: doc.attempts + chamadas,
          lastMessage: undefined,
        })
        return { status: 'authorized', chamadasAoProvedor: chamadas }

      case 'rejeitada':
        // Rejeição de regra de negócio: não retenta (o mesmo payload seria rejeitado de novo).
        await gravar(repo, documentoId, 'processing', {
          status: 'rejected',
          lastMessage: `${resultado.codigo}: ${resultado.motivo}`,
          attempts: doc.attempts + chamadas,
        })
        return { status: 'rejected', chamadasAoProvedor: chamadas, mensagem: resultado.motivo }

      case 'denegada':
        await gravar(repo, documentoId, 'processing', {
          status: 'denied',
          lastMessage: `${resultado.codigo}: ${resultado.motivo}`,
          attempts: doc.attempts + chamadas,
        })
        return { status: 'denied', chamadasAoProvedor: chamadas, mensagem: resultado.motivo }

      case 'processando':
        // A SEFAZ ainda não respondeu: continua em processamento. Um job consulta depois com a mesma referência.
        await atualizarSemTrocarEstado(repo, documentoId, { attempts: doc.attempts + chamadas })
        return { status: 'processing', chamadasAoProvedor: chamadas }

      case 'erro_tecnico':
        ultimaMensagem = resultado.motivo
        if (!resultado.retryable) {
          // Ex.: credencial inválida. Não adianta retentar; devolve para revisão.
          await gravar(repo, documentoId, 'processing', {
            status: 'pending',
            lastMessage: `Erro técnico (não retentável): ${resultado.motivo}`,
            attempts: doc.attempts + chamadas,
          })
          return { status: 'pending', chamadasAoProvedor: chamadas, mensagem: resultado.motivo }
        }
        if (tentativa < opcoes.maxTentativas) {
          await esperar(Math.min(30_000, 1000 * 2 ** (tentativa - 1)))
        }
        break
    }
  }

  // Esgotou as tentativas com erro técnico: volta para 'pending' para o job reenviar com a mesma referência.
  await gravar(repo, documentoId, 'processing', {
    status: 'pending',
    lastMessage: `Erro técnico após ${opcoes.maxTentativas} tentativas: ${ultimaMensagem}`,
    attempts: doc.attempts + chamadas,
  })
  return { status: 'pending', chamadasAoProvedor: chamadas, mensagem: ultimaMensagem }
}

async function atualizarSemTrocarEstado(
  repo: FiscalRepositoryPort,
  id: string,
  patch: Partial<FiscalDocument>
): Promise<void> {
  const ok = await repo.update(id, 'processing', patch)
  if (!ok) throw new Error('Conflito: o documento fiscal foi alterado por outro processo')
}

async function gravar(
  repo: FiscalRepositoryPort,
  id: string,
  de: FiscalStatus,
  patch: Partial<FiscalDocument> & { status: FiscalStatus }
): Promise<void> {
  assertTransition(de, patch.status)
  const { status, ...resto } = patch
  const ok = await repo.update(id, de, { status, ...resto })
  if (!ok) throw new Error('Conflito: o documento fiscal foi alterado por outro processo')
}
