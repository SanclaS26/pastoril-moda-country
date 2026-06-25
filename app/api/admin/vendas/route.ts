import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { normalizeVendaStatus } from '@/lib/vendas';
import { cleanupExpiredOpenCarts } from '@/lib/vendas-cleanup';
import { CART_TYPE, OPEN_STATUS } from '@/lib/admin-dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  await cleanupExpiredOpenCarts(authorization.supabaseAdmin);

  const params = new URL(request.url).searchParams;
  const status = normalizeVendaStatus(params.get('status'));
  const tipo = params.get('tipo');
  const search = params.get('search')?.trim().toLowerCase() ?? '';
  const start = params.get('start');
  const end = params.get('end');
  const deleted = params.get('deleted');
  const view = params.get('view') === 'open_carts' ? 'open_carts' : 'sales';
  const searchDigits = search.replace(/\D/g, '');

  let query = authorization.supabaseAdmin
    .from('vendas')
    .select('*')
    .not('cliente_auth_user_id', 'is', null)
    .order(view === 'open_carts' ? 'updated_at' : 'whatsapp_enviado_em', { ascending: true, nullsFirst: false });

  if (deleted === 'only') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  if (view === 'open_carts') {
    query = query.eq('tipo', CART_TYPE).eq('status', OPEN_STATUS).is('whatsapp_enviado_em', null);
  } else {
    query = query.eq('tipo', 'pedido_whatsapp').not('whatsapp_enviado_em', 'is', null);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (tipo === 'carrinho' || tipo === 'pedido_whatsapp') {
    query = query.eq('tipo', tipo);
  }

  if (start) {
    query = query.gte('created_at', `${start}T00:00:00.000Z`);
  }

  if (end) {
    query = query.lte('created_at', `${end}T23:59:59.999Z`);
  }

  const { data: vendas, error } = await query;

  if (error) {
    return NextResponse.json({ error: `Erro ao carregar vendas: ${error.message}` }, { status: 500 });
  }

  const vendaIds = (vendas ?? []).map((venda) => venda.id);
  const { data: itens, error: itensError } = vendaIds.length
    ? await authorization.supabaseAdmin
        .from('venda_itens')
        .select('*')
        .in('venda_id', vendaIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null };

  if (itensError) {
    return NextResponse.json({ error: `Erro ao carregar itens das vendas: ${itensError.message}` }, { status: 500 });
  }

  const stockIds = [...new Set((itens ?? []).map((item) => item.estoque_produto_id).filter((id): id is number => typeof id === 'number'))];
  const { data: stocks, error: stocksError } = stockIds.length
    ? await authorization.supabaseAdmin
        .from('estoque_produtos')
        .select('id, quantidade')
        .in('id', stockIds)
    : { data: [], error: null };

  if (stocksError) {
    return NextResponse.json({ error: `Erro ao carregar estoque dos itens: ${stocksError.message}` }, { status: 500 });
  }

  const stockById = new Map((stocks ?? []).map((stock) => [stock.id, stock.quantidade]));

  const withItems = (vendas ?? []).map((venda) => ({
    ...venda,
    itens: (itens ?? [])
      .filter((item) => item.venda_id === venda.id)
      .map((item) => ({
        ...item,
        estoque_disponivel: item.estoque_produto_id ? (stockById.get(item.estoque_produto_id) ?? null) : null,
      })),
  }));

  const filtered = withItems.filter((venda) => {
    if (view === 'open_carts' && venda.itens.length === 0) return false;
    if (!search) return true;

    return (
      venda.codigo.toLowerCase().includes(search) ||
      (venda.cliente_nome ?? '').toLowerCase().includes(search) ||
      (searchDigits.length > 0 && (venda.cliente_cpf ?? '').includes(searchDigits)) ||
      (searchDigits.length > 0 && (venda.cliente_celular ?? '').includes(searchDigits))
    );
  });

  return NextResponse.json({ vendas: filtered });
}
