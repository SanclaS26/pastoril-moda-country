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

export async function DELETE(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const id = new URL(request.url).searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Informe o cliente que sera excluido.' }, { status: 400 });
  }

  const { data: cliente, error: clienteError } = await authorization.supabaseAdmin
    .from('clientes')
    .select('id, auth_user_id, nome, celular')
    .eq('id', id)
    .maybeSingle();

  if (clienteError) {
    return NextResponse.json({ error: `Erro ao localizar cliente: ${clienteError.message}` }, { status: 500 });
  }

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
  }

  if (!cliente.auth_user_id) {
    return NextResponse.json(
      { error: 'Este cliente nao possui auth_user_id vinculado ao Supabase Auth.' },
      { status: 409 },
    );
  }

  const { data: authUser, error: authLookupError } = await authorization.supabaseAdmin.auth.admin.getUserById(cliente.auth_user_id);

  if (authLookupError || !authUser.user) {
    return NextResponse.json(
      {
        error:
          authLookupError?.message ||
          'Nao foi encontrado um usuario de autenticacao vinculado a este cliente.',
      },
      { status: 409 },
    );
  }

  const { error: deleteAuthError } = await authorization.supabaseAdmin.auth.admin.deleteUser(cliente.auth_user_id);

  if (deleteAuthError) {
    return NextResponse.json(
      { error: `Nao foi possivel excluir o acesso de login: ${deleteAuthError.message}` },
      { status: 500 },
    );
  }

  const { error: deleteClienteError } = await authorization.supabaseAdmin
    .from('clientes')
    .delete()
    .eq('id', cliente.id);

  if (deleteClienteError) {
    return NextResponse.json(
      {
        error:
          `O acesso de login foi excluido, mas o perfil do cliente nao foi removido automaticamente: ${deleteClienteError.message}. ` +
          'Revise a constraint entre clientes.auth_user_id e auth.users(id) antes de tentar novamente.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: `Cliente ${cliente.nome} excluido com sucesso. O acesso de login tambem foi removido.`,
  });
}
