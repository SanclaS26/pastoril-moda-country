import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export async function GET(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar compras do cliente.' }, { status: 500 });
  }

  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Sessao do cliente ausente.' }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Sessao invalida ou expirada.' }, { status: 401 });
  }

  const { data: vendas, error } = await supabaseAdmin
    .from('vendas')
    .select('*')
    .eq('cliente_auth_user_id', user.id)
    .neq('tipo', 'carrinho')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Erro ao carregar compras: ${error.message}` }, { status: 500 });
  }

  const vendaIds = (vendas ?? []).map((venda) => venda.id);
  const { data: itens, error: itensError } = vendaIds.length
    ? await supabaseAdmin
        .from('venda_itens')
        .select('*')
        .in('venda_id', vendaIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null };

  if (itensError) {
    return NextResponse.json({ error: `Erro ao carregar itens das compras: ${itensError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    compras: (vendas ?? []).map((venda) => ({
      ...venda,
      itens: (itens ?? []).filter((item) => item.venda_id === venda.id),
    })),
  });
}
