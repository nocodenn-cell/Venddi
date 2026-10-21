// Venddi - Edge Function: convidar funcionário por e-mail
//
// Roda com a service role (só no servidor). Antes de convidar, confere que quem
// chama é owner ou admin ativo de uma empresa ativa. Cria o usuário no Auth com
// convite por e-mail e grava o registro em `users` já vinculado ao auth_id.
//
// Deploy: npx supabase functions deploy invite-employee
// Variável opcional: APP_URL (URL pública do app, usada no link do convite).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ROLES = ['admin', 'manager', 'cashier', 'salesperson'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Quem está chamando?
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller.user) {
    return json({ error: 'Não autenticado' }, 401)
  }

  // 2) Ele é owner/admin ativo, numa empresa ativa?
  const { data: me } = await admin
    .from('users')
    .select('id, company_id, role, is_active')
    .eq('auth_id', caller.user.id)
    .maybeSingle()

  if (!me || !me.is_active || !['owner', 'admin'].includes(me.role)) {
    return json({ error: 'Apenas owner ou admin podem convidar funcionários' }, 403)
  }

  const { data: company } = await admin
    .from('companies')
    .select('status')
    .eq('id', me.company_id)
    .maybeSingle()

  if (!company || company.status !== 'active') {
    return json({ error: 'Empresa inativa' }, 403)
  }

  // 3) Dados do convite
  let body: { email?: string; fullName?: string; role?: string; commissionPercent?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido' }, 400)
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const fullName = (body.fullName ?? '').trim()
  const role = body.role ?? ''
  const commission = Number(body.commissionPercent ?? 0)

  if (!EMAIL_RE.test(email)) return json({ error: 'E-mail inválido' }, 400)
  if (fullName.length < 2) return json({ error: 'Nome deve ter pelo menos 2 caracteres' }, 400)
  if (!(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return json({ error: 'Papel inválido' }, 400)
  }
  // Só o owner cria outro admin
  if (role === 'admin' && me.role !== 'owner') {
    return json({ error: 'Apenas o dono pode convidar administradores' }, 403)
  }
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    return json({ error: 'Comissão deve estar entre 0 e 100' }, 400)
  }

  // 4) E-mail já usado nesta empresa ou em outra?
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return json({ error: 'Este e-mail já está cadastrado' }, 409)
  }

  // 5) Convite por e-mail
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${appUrl}/convite`,
  })
  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? 'Não foi possível enviar o convite' }, 400)
  }

  // 6) Registro do funcionário, já vinculado ao usuário convidado
  const { data: created, error: insertError } = await admin
    .from('users')
    .insert({
      company_id: me.company_id,
      auth_id: invited.user.id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      commission_percent: commission,
    })
    .select('id')
    .single()

  if (insertError) {
    // Evita usuário órfão no Auth se o registro não puder ser criado
    await admin.auth.admin.deleteUser(invited.user.id)
    return json({ error: insertError.message }, 400)
  }

  return json({ success: true, userId: created.id }, 201)
})
