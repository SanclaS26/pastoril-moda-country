import { NextResponse } from 'next/server';
import { requireClienteReady } from '@/lib/cliente-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authorization = await requireClienteReady(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { supabaseAdmin, user } = authorization;

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
