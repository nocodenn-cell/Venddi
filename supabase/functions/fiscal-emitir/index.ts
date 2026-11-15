// Edge Function fiscal (ETAPA PREPARATÓRIA). NÃO DEPLOYADA. NÃO TRANSMITE.
//
// Responsabilidades desta etapa:
// - autenticar o chamador pelo JWT do usuário (anon client com o token do cabeçalho);
// - conferir papel (owner/admin/manager) e empresa no banco (service role, só no servidor);
// - ler o token do provedor apenas de secret do servidor (FOCUS_TOKEN_HOMOLOG), nunca do banco;
// - recusar produção e qualquer ação de transmissão nesta etapa.
//
// Ainda NÃO faz: montar payload fiscal, chamar a Focus, consultar ou cancelar. Essas partes entram
// depois da aprovação do plano em docs/FISCAL_EDGE_PREPARATORIO.md e da homologação.
//
// Secrets esperados (nunca commitar valores):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  (fornecidos pelo runtime do Supabase)
//   FOCUS_TOKEN_HOMOLOG   (token de homologação da Focus; ausente = função recusa tudo)
//   FISCAL_AMBIENTE       (deve ser exatamente "homologacao"; qualquer outro valor bloqueia)

import { createClient } from 'npm:@supabase/supabase-js@2.98.0'

const PAPEIS_PERMITIDOS = ['owner', 'admin', 'manager']
const ACOES = ['emitir', 'reenviar', 'consultar', 'cancelar'] as const

function json(status: number, corpo: Record<string, unknown>): Response {
  // Nunca devolve token, CSC ou dados de segredo.
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { erro: 'metodo_nao_permitido' })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const ambiente = Deno.env.get('FISCAL_AMBIENTE') ?? ''
  const token = Deno.env.get('FOCUS_TOKEN_HOMOLOG') ?? ''

  // Bloqueios de configuração: sem ambiente de homologação explícito, nada acontece.
  if (ambiente !== 'homologacao') return json(503, { erro: 'ambiente_nao_homologacao' })
  if (!token) return json(503, { erro: 'provedor_nao_configurado' })
  if (!url || !anonKey || !serviceKey) return json(503, { erro: 'supabase_nao_configurado' })

  // 1) Autenticação pelo JWT do usuário.
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) return json(401, { erro: 'nao_autenticado' })

  const cliente = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data: userData, error: userErr } = await cliente.auth.getUser(jwt)
  if (userErr || !userData?.user) return json(401, { erro: 'nao_autenticado' })

  // 2) Papel e empresa conferidos no banco pela service role (fonte de verdade, não o cliente).
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: usuario, error: uErr } = await admin
    .from('users')
    .select('id, company_id, role, is_active')
    .eq('auth_id', userData.user.id)
    .maybeSingle()
  if (uErr || !usuario) return json(401, { erro: 'usuario_nao_encontrado' })
  if (!usuario.is_active) return json(403, { erro: 'usuario_inativo' })
  if (!PAPEIS_PERMITIDOS.includes(usuario.role)) return json(403, { erro: 'papel_sem_permissao' })

  // 3) Entrada validada.
  let corpo: { acao?: string; documento_id?: string }
  try {
    corpo = await req.json()
  } catch {
    return json(400, { erro: 'json_invalido' })
  }
  if (!corpo.acao || !(ACOES as readonly string[]).includes(corpo.acao)) return json(400, { erro: 'acao_invalida' })
  if (!corpo.documento_id) return json(400, { erro: 'documento_obrigatorio' })

  // 4) Documento precisa ser da mesma empresa (isolamento). Só leitura nesta etapa.
  const { data: doc } = await admin
    .from('fiscal_documents')
    .select('id, company_id, status')
    .eq('id', corpo.documento_id)
    .maybeSingle()
  if (!doc || doc.company_id !== usuario.company_id) return json(404, { erro: 'documento_nao_encontrado' })

  // 5) Nesta etapa nenhuma ação transmite. Emissão, reenvio, consulta e cancelamento ficam recusados.
  return json(501, {
    erro: 'nao_implementado_nesta_etapa',
    acao: corpo.acao,
    detalhe: 'Etapa preparatória: transmissão desabilitada. Ver docs/FISCAL_EDGE_PREPARATORIO.md.',
  })
})
