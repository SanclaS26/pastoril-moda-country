import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('banners')
      .select('id, titulo, imagem_url, imagem_path, ativo, principal, created_at, updated_at')
      .eq('ativo', true)
      .eq('principal', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Erro ao buscar banner principal: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(
      { banner: data ?? null },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar banner principal.' }, { status: 500 });
  }
}
