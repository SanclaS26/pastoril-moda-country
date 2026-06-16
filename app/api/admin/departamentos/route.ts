import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { data, error } = await authorization.supabaseAdmin
      .from('departamentos')
      .select('id, nome, ativo, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true });

    if (error) {
      return NextResponse.json({ error: `Erro ao listar departamentos: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ departamentos: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao listar departamentos.' }, { status: 500 });
  }
}
