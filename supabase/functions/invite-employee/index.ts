// Venddi - Edge Function: convites de funcionários
//
// Ações (campo "action" no corpo, padrão "invite"):
//   invite  -> cria convite por e-mail e o registro em users
//   resend  -> reenvia o convite de um funcionário que ainda não aceitou
//   cancel  -> cancela um convite pendente (só conta que nunca foi aceita)
//   list    -> status dos convites da empresa (pendente, pode reenviar)
//
// Regras, sempre verificadas no servidor a partir do registro de quem chama:
//   - quem chama é owner ou admin ativo, em empresa ativa
//   - só owner convida, reenvia ou cancela administradores
//   - o company_id vem do registro do chamador, nunca do corpo da requisição
//   - ninguém convida owner
//
// Usa a service role, que nunca sai do servidor. Não registra e-mails, tokens
// ou senhas nos logs.
//
// Deploy: npx supabase functions deploy invite-employee
// Segredo: APP_URL (URL pública do app; o link do convite aponta para /convite)

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const INVITABLE_ROLES = ['admin', 'manager', 'cashier', 'salesperson'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_SECONDS = 120
const MAX_INVITES_PER_USER = 10

type Caller = { id: string; company_id: string; role: string }

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Mensagens do Auth que podem ser mostradas ao usuário. Qualquer outra vira genérica.
function safeAuthMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
    return 'Este e-mail já está cadastrado'
  }
  if (m.includes('rate') || m.includes('too many') || m.includes('seconds')) {
    return 'Muitas tentativas. Aguarde um pouco e tente de novo'
  }
  return 'Não foi possível enviar o convite. Tente novamente'
}

async function authorizeCaller(admin: SupabaseClient, req: Request): Promise<Caller> {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: auth, error } = await admin.auth.getUser(token)
  if (error || !auth.user) throw new HttpError(401, 'Não autenticado')

  const { data: me } = await admin
    .from('users')
    .select('id, company_id, role, is_active')
    .eq('auth_id', auth.user.id)
    .maybeSingle()

  if (!me || !me.is_active || !['owner', 'admin'].includes(me.role)) {
    throw new HttpError(403, 'Apenas owner ou admin podem gerenciar funcionários')
  }

  const { data: company } = await admin
    .from('companies')
    .select('status')
    .eq('id', me.company_id)
    .maybeSingle()
  if (!company || company.status !== 'active') {
    throw new HttpError(403, 'Empresa inativa')
  }

  return { id: me.id, company_id: me.company_id, role: me.role }
}

// Admin só mexe em quem não é administrador: só o owner convida/reenvia/cancela admin
function assertCanManageRole(caller: Caller, targetRole: string) {
  if (targetRole === 'owner') throw new HttpError(403, 'Não é possível gerenciar o dono da empresa')
  if (targetRole === 'admin' && caller.role !== 'owner') {
    throw new HttpError(403, 'Apenas o dono pode gerenciar administradores')
  }
}

async function handleInvite(admin: SupabaseClient, caller: Caller, body: any, appUrl: string) {
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.fullName ?? '').trim()
  const role = String(body.role ?? '')
  const commission = Number(body.commissionPercent ?? 0)

  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'E-mail inválido')
  if (fullName.length < 2) throw new HttpError(400, 'Nome deve ter pelo menos 2 caracteres')
  if (!(INVITABLE_ROLES as readonly string[]).includes(role)) {
    throw new HttpError(400, 'Papel inválido')
  }
  assertCanManageRole(caller, role)
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    throw new HttpError(400, 'Comissão deve estar entre 0 e 100')
  }

  // Verificação rápida; a unicidade real é garantida pelo índice em users(lower(email))
  const { data: existing } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) throw new HttpError(409, 'Este e-mail já está cadastrado')

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${appUrl}/convite`,
  })
  if (inviteError || !invited.user) {
    throw new HttpError(409, safeAuthMessage(inviteError?.message))
  }

  const { data: created, error: insertError } = await admin
    .from('users')
    .insert({
      company_id: caller.company_id,
      auth_id: invited.user.id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      commission_percent: commission,
      invite_sent_at: new Date().toISOString(),
      invite_send_count: 1,
    })
    .select('id')
    .single()

  if (insertError) {
    // Corrida ou duplicidade: desfaz a conta criada no Auth para não ficar órfã
    await admin.auth.admin.deleteUser(invited.user.id)
    const duplicate = insertError.code === '23505'
    throw new HttpError(duplicate ? 409 : 400, duplicate ? 'Este e-mail já está cadastrado' : 'Não foi possível cadastrar o funcionário')
  }

  return { status: 201, body: { success: true, userId: created.id } }
}

async function loadTarget(admin: SupabaseClient, caller: Caller, userId: string) {
  const { data: target } = await admin
    .from('users')
    .select('id, company_id, auth_id, email, role, invite_sent_at, invite_send_count')
    .eq('id', userId)
    .eq('company_id', caller.company_id)
    .maybeSingle()
  if (!target || !target.auth_id) throw new HttpError(404, 'Funcionário não encontrado')
  assertCanManageRole(caller, target.role)
  return target
}

async function handleResend(admin: SupabaseClient, caller: Caller, body: any, appUrl: string) {
  const target = await loadTarget(admin, caller, String(body.userId ?? ''))

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(target.auth_id)
  if (authError || !authData.user) throw new HttpError(404, 'Convite não encontrado')
  if (authData.user.email_confirmed_at) {
    // Já aceitou o convite: o caminho é "Esqueci minha senha", não um novo convite
    throw new HttpError(409, 'Este funcionário já ativou o acesso. Ele pode usar "Esqueci minha senha"')
  }

  if (target.invite_send_count >= MAX_INVITES_PER_USER) {
    throw new HttpError(429, 'Limite de convites atingido para este funcionário. Cancele e convide de novo')
  }
  if (target.invite_sent_at) {
    const elapsed = (Date.now() - new Date(target.invite_sent_at).getTime()) / 1000
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)
      throw new HttpError(429, `Aguarde ${wait} segundos para reenviar o convite`)
    }
  }

  // Para conta ainda não aceita, o Auth reenvia o convite (novo link válido)
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(target.email, {
    redirectTo: `${appUrl}/convite`,
  })
  if (inviteError) throw new HttpError(409, safeAuthMessage(inviteError.message))

  await admin
    .from('users')
    .update({
      invite_sent_at: new Date().toISOString(),
      invite_send_count: target.invite_send_count + 1,
    })
    .eq('id', target.id)

  return { status: 200, body: { success: true } }
}

async function handleCancel(admin: SupabaseClient, caller: Caller, body: any) {
  const target = await loadTarget(admin, caller, String(body.userId ?? ''))

  const { data: authData } = await admin.auth.admin.getUserById(target.auth_id)
  if (authData?.user?.email_confirmed_at) {
    throw new HttpError(409, 'Não é possível cancelar: o funcionário já ativou o acesso')
  }

  // Remove só o registro e a conta ainda não aceita. Nunca conta ativa.
  const { error: deleteRowError } = await admin.from('users').delete().eq('id', target.id)
  if (deleteRowError) throw new HttpError(400, 'Não foi possível cancelar o convite')
  await admin.auth.admin.deleteUser(target.auth_id)

  return { status: 200, body: { success: true } }
}

async function handleList(admin: SupabaseClient, caller: Caller) {
  const { data: rows, error } = await admin
    .from('users')
    .select('id, full_name, email, role, is_active, auth_id, invite_sent_at, invite_send_count')
    .eq('company_id', caller.company_id)
    .order('full_name')
  if (error) throw new HttpError(400, 'Não foi possível carregar a equipe')

  const items = []
  for (const row of rows ?? []) {
    let pending = false
    if (row.auth_id) {
      const { data: authData } = await admin.auth.admin.getUserById(row.auth_id)
      pending = !!authData?.user && !authData.user.email_confirmed_at
    }
    const elapsed = row.invite_sent_at
      ? (Date.now() - new Date(row.invite_sent_at).getTime()) / 1000
      : Infinity
    const canManage = row.role !== 'owner' && (row.role !== 'admin' || caller.role === 'owner')
    items.push({
      userId: row.id,
      pending,
      canResend: pending && canManage && row.invite_send_count < MAX_INVITES_PER_USER && elapsed >= RESEND_COOLDOWN_SECONDS,
      canCancel: pending && canManage,
      inviteSentAt: row.invite_sent_at,
      inviteSendCount: row.invite_send_count,
    })
  }
  return { status: 200, body: { items } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido' }, 400)
  }

  const action = String(body?.action ?? 'invite')

  try {
    const caller = await authorizeCaller(admin, req)

    let result: { status: number; body: unknown }
    switch (action) {
      case 'invite':
        result = await handleInvite(admin, caller, body, appUrl)
        break
      case 'resend':
        result = await handleResend(admin, caller, body, appUrl)
        break
      case 'cancel':
        result = await handleCancel(admin, caller, body)
        break
      case 'list':
        result = await handleList(admin, caller)
        break
      default:
        throw new HttpError(400, 'Ação inválida')
    }
    return json(result.body, result.status)
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status)
    }
    // Erro inesperado: registra só a ação, nunca dados do pedido
    console.error(`invite-employee: falha inesperada na ação "${action}"`)
    return json({ error: 'Erro interno. Tente novamente' }, 500)
  }
})
