import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const search = new URL(request.url).searchParams.get('search')?.trim().toLowerCase() ?? '';
  const searchDigits = search.replace(/\D/g, '');

  const { data, error } = await authorization.supabaseAdmin
    .from('clientes')
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Erro ao carregar clientes: ${error.message}` }, { status: 500 });
  }

  const clientes = (data ?? []).filter((cliente) => {
    if (!search) return true;

    const nome = cliente.nome?.toLowerCase() ?? '';
    const cpf = cliente.cpf ?? '';
    const celular = cliente.celular ?? '';

    return (
      nome.includes(search) ||
      (searchDigits.length > 0 && cpf.includes(searchDigits)) ||
      (searchDigits.length > 0 && celular.includes(searchDigits))
    );
  });

  return NextResponse.json({ clientes });
}
