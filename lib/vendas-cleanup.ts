import 'server-only';
import type { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function cleanupExpiredOpenCarts(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const expirationDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.rpc('excluir_carrinhos_expirados', {
    p_expira_antes: expirationDate,
  });

  if (error) {
    console.info('[expired-open-carts-cleanup-error]', {
      message: error.message,
    });
  }
}
