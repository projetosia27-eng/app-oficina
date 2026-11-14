import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('seu-projeto.supabase.co') &&
    !supabaseAnonKey.includes('sua-chave-anon')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function formatSupabaseError(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.';
  const message =
    typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }
  if (lower.includes('user already registered')) {
    return 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Permissão negada no Supabase. Verifique se o script SQL de RLS foi executado.';
  }
  if (lower.includes('relation') && lower.includes('does not exist')) {
    return 'As tabelas ainda não foram criadas no Supabase. Execute o Script SQL de configuração.';
  }
  if (lower.includes('bucket not found')) {
    return 'O bucket "logos" não foi encontrado no Supabase Storage. Execute o Script SQL.';
  }
  if (lower.includes('payload too large') || lower.includes('object exceeded the maximum allowed size')) {
    return 'O arquivo ultrapassou o limite de 1 MB permitido no plano gratuito.';
  }
  if (lower.includes('foreign key') || lower.includes('violates foreign key constraint')) {
    return 'Não é possível excluir porque existem orçamentos vinculados a este registro.';
  }
  return message;
}
