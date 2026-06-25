import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  status?: number;
};

type ClienteDeleteRow = {
  auth_user_id: string | null;
  celular: string;
  cpf: string;
  email: string | null;
  endereco_completo: string | null;
  id: number | string;
  must_change_password: boolean;
  nome: string;
};

function getErrorParts(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: '' };
  }

  const source = error as SupabaseErrorLike;

  return {
    code: source.code,
    details: source.details,
    hint: source.hint,
    message: source.message ?? '',
    status: source.status,
  };
}

function formatSupabaseError(error: unknown) {
  const parts = getErrorParts(error);
  const details = [parts.message, parts.code && `codigo ${parts.code}`, parts.details, parts.hint]
    .filter(Boolean)
    .join(' | ');

  return details || 'Sem detalhes retornados pelo Supabase.';
}

function isAuthUserNotFound(error: unknown, user: unknown) {
  if (user) return false;

  const parts = getErrorParts(error);
  const message = parts.message.toLowerCase();

  return (
    parts.status === 404 ||
    message.includes('not found') ||
    message.includes('user not found') ||
    message.includes('no user')
  );
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const search = new URL(request.url).searchParams.get('search')?.trim().toLowerCase() ?? '';
  const searchDigits = search.replace(/\D/g, '');

  const { data, error } = await authorization.supabaseAdmin
    .from('clientes')
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password, created_at')
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
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password')
    .eq('id', id)
    .maybeSingle();

  if (clienteError) {
    return NextResponse.json({ error: `Erro ao localizar cliente: ${formatSupabaseError(clienteError)}` }, { status: 500 });
  }

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
  }

  const clienteRow = cliente as ClienteDeleteRow;
  const authUserId = clienteRow.auth_user_id;

  if (!authUserId) {
    const { error: deleteClienteError } = await authorization.supabaseAdmin
      .from('clientes')
      .delete()
      .eq('id', clienteRow.id);

    if (deleteClienteError) {
      return NextResponse.json(
        { error: `Cliente sem vinculo com Auth, mas o perfil nao pode ser excluido: ${formatSupabaseError(deleteClienteError)}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: `Cliente ${clienteRow.nome} excluido. O cadastro nao possuia vinculo com Supabase Auth.`,
    });
  }

  const { data: relatedVendas, error: vendasError } = await authorization.supabaseAdmin
    .from('vendas')
    .select('id, codigo, tipo, status, whatsapp_enviado_em, estoque_baixado')
    .eq('cliente_auth_user_id', authUserId);

  if (vendasError) {
    return NextResponse.json(
      { error: `Erro ao verificar pedidos, vendas e carrinhos do cliente: ${formatSupabaseError(vendasError)}` },
      { status: 500 },
    );
  }

  const vendas = relatedVendas ?? [];
  const commercialHistory = vendas.filter((venda) => venda.tipo !== 'carrinho' || venda.whatsapp_enviado_em || venda.estoque_baixado);

  if (commercialHistory.length > 0) {
    return NextResponse.json(
      {
        error:
          `Cliente possui ${commercialHistory.length} pedido(s), venda(s) ou historico comercial vinculado(s). ` +
          'A exclusao fisica foi bloqueada para preservar o historico financeiro e comercial.',
      },
      { status: 409 },
    );
  }

  const { data: authUser, error: authLookupError } = await authorization.supabaseAdmin.auth.admin.getUserById(authUserId);
  const authAlreadyMissing = isAuthUserNotFound(authLookupError, authUser?.user);

  if (authLookupError && !authAlreadyMissing) {
    return NextResponse.json(
      { error: `Falha ao verificar a conta no Supabase Auth: ${formatSupabaseError(authLookupError)}` },
      { status: 500 },
    );
  }

  const { error: wishlistError } = await authorization.supabaseAdmin
    .from('wishlist_items')
    .delete()
    .eq('user_id', authUserId);

  if (wishlistError) {
    return NextResponse.json(
      { error: `Falha ao remover wishlist do cliente: ${formatSupabaseError(wishlistError)}` },
      { status: 500 },
    );
  }

  const openCartIds = vendas
    .filter((venda) => venda.tipo === 'carrinho' && venda.status === 'em_aberto' && !venda.whatsapp_enviado_em && !venda.estoque_baixado)
    .map((venda) => venda.id);

  if (openCartIds.length > 0) {
    const { error: deleteCartItemsError } = await authorization.supabaseAdmin
      .from('venda_itens')
      .delete()
      .in('venda_id', openCartIds);

    if (deleteCartItemsError) {
      return NextResponse.json(
        { error: `Falha ao remover itens de carrinho aberto: ${formatSupabaseError(deleteCartItemsError)}` },
        { status: 500 },
      );
    }

    const { error: deleteCartsError } = await authorization.supabaseAdmin
      .from('vendas')
      .delete()
      .in('id', openCartIds);

    if (deleteCartsError) {
      return NextResponse.json(
        { error: `Falha ao remover carrinhos abertos do cliente: ${formatSupabaseError(deleteCartsError)}` },
        { status: 500 },
      );
    }
  }

  const { error: deleteClienteError } = await authorization.supabaseAdmin
    .from('clientes')
    .delete()
    .eq('id', clienteRow.id);

  if (deleteClienteError) {
    return NextResponse.json(
      { error: `Falha ao excluir perfil publico do cliente: ${formatSupabaseError(deleteClienteError)}` },
      { status: 500 },
    );
  }

  if (!authAlreadyMissing) {
    const { error: deleteAuthError } = await authorization.supabaseAdmin.auth.admin.deleteUser(authUserId);

    if (deleteAuthError) {
      const { error: restoreError } = await authorization.supabaseAdmin
        .from('clientes')
        .insert([{
          auth_user_id: authUserId,
          celular: clienteRow.celular,
          cpf: clienteRow.cpf,
          email: clienteRow.email,
          endereco_completo: clienteRow.endereco_completo,
          must_change_password: clienteRow.must_change_password,
          nome: clienteRow.nome,
        }]);

      return NextResponse.json(
        {
          error:
            `Falha ao excluir usuario no Supabase Auth: ${formatSupabaseError(deleteAuthError)}. ` +
            (restoreError
              ? `Tentativa de restaurar o perfil tambem falhou: ${formatSupabaseError(restoreError)}.`
              : 'O perfil publico foi restaurado para evitar exclusao parcial.'),
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: authAlreadyMissing
      ? `Cliente ${clienteRow.nome} excluido. O usuario Auth vinculado ja nao existia.`
      : `Cliente ${clienteRow.nome} excluido com sucesso. O acesso de login tambem foi removido.`,
  });
}
