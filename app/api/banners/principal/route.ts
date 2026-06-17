import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('banners')
      .select('*')
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: `Erro ao buscar banners ativos: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(
      { banners: data ?? [] },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar banners.' }, { status: 500 });
  }
}
