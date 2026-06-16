import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

function parseDepartamentoId(value: string | null) {
  const departamentoId = Number(value);

  if (!Number.isInteger(departamentoId) || departamentoId <= 0) {
    throw new Error('Departamento inválido.');
  }

  return departamentoId;
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const departamentoId = parseDepartamentoId(searchParams.get('departamento_id'));

    const { data, error } = await authorization.supabaseAdmin
      .from('categorias')
      .select('id, departamento_id, nome, ativo, ordem')
      .eq('departamento_id', departamentoId)
      .eq('ativo', true)
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('nome', { ascending: true });

    if (error) {
      return NextResponse.json({ error: `Erro ao listar categorias: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ categorias: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao listar categorias.' }, { status: 500 });
  }
}
