/**
 * Camada server-side da emissão fiscal (preparatória, em homologação).
 *
 * Esta lógica roda DENTRO da Edge Function (supabase/functions/fiscal-emitir), nunca no navegador.
 * Não lê segredos diretamente: o token do provedor chega por `provedor` (já montado com o secret do
 * servidor) e o banco é acessado por `repo` (service role). Assim os testes rodam sem rede e sem Deno.
 *
 * Ações:
 * - emitir:    cria/envia o documento pendente (primeira vez).
 * - reenviar:  mesma referência de um documento pendente/erro técnico (idempotente no provedor).
 * - consultar: NÃO IMPLEMENTADO nesta etapa (planejado; ver docs/FISCAL_EDGE_PREPARATORIO.md).
 * - cancelar:  NÃO IMPLEMENTADO nesta etapa (exige decisão do contador sobre prazo e justificativa).
 */
import { emitirDocumento, FiscalBloqueadoError, type Ambiente, type EmitirOpcoes, type FiscalDocument, type FiscalProviderPort, type FiscalRepositoryPort, type ResultadoEmissao } from './core'

export type PapelUsuario = 'owner' | 'admin' | 'manager' | 'cashier' | 'salesperson'

export interface UsuarioAutenticado {
  id: string
  companyId: string
  role: PapelUsuario
  isActive: boolean
}

export interface AcaoFiscalInput {
  acao: 'emitir' | 'reenviar' | 'consultar' | 'cancelar'
  documentoId: string
  usuario: UsuarioAutenticado | null
  /** Configuração do ambiente vinda de secrets do servidor (nunca do cliente) */
  ambiente: Ambiente
  /** Flag de produção. Nesta etapa é sempre false: produção está fora de escopo. */
  producaoHabilitada: boolean
  /** Payload já montado no servidor a partir da venda e dos dados fiscais (ver docs) */
  payload: unknown
  maxTentativas: number
  esperar?: EmitirOpcoes['esperar']
}

export type ErroAcaoFiscal =
  | 'nao_autenticado'
  | 'usuario_inativo'
  | 'papel_sem_permissao'
  | 'documento_nao_encontrado'
  | 'empresa_diferente'
  | 'acao_nao_implementada'
  | 'reenvio_sem_pendencia'
  | 'producao_bloqueada'

export type ResultadoAcaoFiscal =
  | { ok: true; resultado: ResultadoEmissao }
  | { ok: false; erro: ErroAcaoFiscal; mensagem: string }

/** Quem pode disparar emissão fiscal: dono, admin e gerente (mesmo critério de cancelamento de venda). */
const PAPEIS_PERMITIDOS: PapelUsuario[] = ['owner', 'admin', 'manager']

export function podeEmitirFiscal(usuario: UsuarioAutenticado | null, companyId: string): ErroAcaoFiscal | null {
  if (!usuario) return 'nao_autenticado'
  if (!usuario.isActive) return 'usuario_inativo'
  if (usuario.companyId !== companyId) return 'empresa_diferente'
  if (!PAPEIS_PERMITIDOS.includes(usuario.role)) return 'papel_sem_permissao'
  return null
}

export interface RepositorioServidor extends FiscalRepositoryPort {
  /** Lê o documento já com o companyId, para checar isolamento antes de agir */
  get(id: string): Promise<FiscalDocument | null>
}

export async function processarAcaoFiscal(
  input: AcaoFiscalInput,
  deps: { repo: RepositorioServidor; provedor: FiscalProviderPort }
): Promise<ResultadoAcaoFiscal> {
  // Produção nunca passa nesta etapa, mesmo que alguém tente configurar a flag.
  if (input.ambiente === 'producao' || input.producaoHabilitada) {
    return { ok: false, erro: 'producao_bloqueada', mensagem: 'Produção não habilitada nesta etapa' }
  }

  const doc = await deps.repo.get(input.documentoId)
  if (!doc) return { ok: false, erro: 'documento_nao_encontrado', mensagem: 'Documento fiscal não encontrado' }

  const erroPapel = podeEmitirFiscal(input.usuario, doc.companyId)
  if (erroPapel) {
    return { ok: false, erro: erroPapel, mensagem: mensagemPara(erroPapel) }
  }

  if (input.acao === 'consultar' || input.acao === 'cancelar') {
    return { ok: false, erro: 'acao_nao_implementada', mensagem: `${input.acao} ainda não está implementado nesta etapa` }
  }

  if (input.acao === 'reenviar' && !['pending', 'processing', 'contingency'].includes(doc.status)) {
    return { ok: false, erro: 'reenvio_sem_pendencia', mensagem: `Documento em ${doc.status}: nada a reenviar` }
  }

  try {
    const resultado = await emitirDocumento(deps.repo, deps.provedor, input.documentoId, {
      ambiente: input.ambiente,
      producaoHabilitada: false,
      maxTentativas: input.maxTentativas,
      esperar: input.esperar,
      payload: input.payload,
    })
    return { ok: true, resultado }
  } catch (err) {
    if (err instanceof FiscalBloqueadoError) {
      return { ok: false, erro: 'producao_bloqueada', mensagem: err.message }
    }
    throw err
  }
}

function mensagemPara(erro: ErroAcaoFiscal): string {
  switch (erro) {
    case 'nao_autenticado': return 'Sessão inválida'
    case 'usuario_inativo': return 'Usuário inativo'
    case 'papel_sem_permissao': return 'Seu papel não pode emitir documento fiscal'
    case 'empresa_diferente': return 'Documento de outra empresa'
    default: return 'Operação recusada'
  }
}
