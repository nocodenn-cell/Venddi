import { supabase } from '@/lib/supabase'

/**
 * Cadastro real (Supabase): a empresa, o vínculo (owner) e a assinatura "pending" são
 * criados no servidor (gatilho em auth.users + RPC idempotente bootstrap_my_company,
 * migration 012). O navegador nunca escolhe company_id nem papel e não abre sessão
 * operacional: a equipe libera a avaliação depois.
 *
 * - 'pending_approval': conta e empresa criadas; aguardando liberação.
 * - 'confirm_email': o Supabase exige confirmação de e-mail; a empresa é criada pelo gatilho.
 */
export type RegistrationStatus = 'pending_approval' | 'confirm_email'

export interface CompanyRegistrationData {
  fullName: string
  email: string
  password: string
  companyName: string
  cnpj: string
}

export async function registerCompanyAccount(
  data: CompanyRegistrationData
): Promise<{ status: RegistrationStatus }> {
  if (!supabase) throw new Error('Cadastro indisponível no momento')
  try {
    const { data: signUp, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          company_name: data.companyName,
          cnpj: data.cnpj,
        },
      },
    })
    if (error) throw error

    if (!signUp.session) {
      return { status: 'confirm_email' }
    }

    const { error: bootstrapError } = await supabase.rpc('bootstrap_my_company', {
      p_full_name: data.fullName,
      p_company_name: data.companyName,
      p_cnpj: data.cnpj,
    })
    if (bootstrapError) throw bootstrapError

    return { status: 'pending_approval' }
  } catch (err) {
    throw new Error(err instanceof Error && err.message ? err.message : 'Erro ao criar conta')
  }
}
