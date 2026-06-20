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
    .order('created_at', { ascending: false });

  if (deleted === 'only') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  if (view === 'open_carts') {
    query = query.eq('tipo', CART_TYPE).eq('status', OPEN_STATUS);
  } else {
    query = query.or('tipo.neq.carrinho,status.neq.em_aberto');
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

  const withItems = (vendas ?? []).map((venda) => ({
    ...venda,
    itens: (itens ?? []).filter((item) => item.venda_id === venda.id),
  }));

  const filtered = withItems.filter((venda) => {
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
