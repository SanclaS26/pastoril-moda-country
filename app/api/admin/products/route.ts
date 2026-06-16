import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { data, error } = await authorization.supabaseAdmin
    .from('produtos')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Erro ao listar produtos: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}
