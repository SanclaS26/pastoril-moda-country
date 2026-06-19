import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteRow } from '@/lib/supabase-admin';
import {
  WHATSAPP_STORE_PHONE,
  createVendaItemPayload,
  createVendaPayload,
  generateVendaCode,
  type PublicVendaItemInput,
} from '@/lib/vendas';

export const dynamic = 'force-dynamic';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

async function getClienteFromRequest(request: Request, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const token = getBearerToken(request);

  if (!token) return null;

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (!user) return null;

  const { data } = await supabaseAdmin
    .from('clientes')
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (data as ClienteRow | null) ?? null;
}

function parseItems(value: unknown): PublicVendaItemInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      codigo_produto: String(item?.codigo_produto ?? '').trim(),
      estoque_produto_id: Number.isInteger(Number(item?.estoque_produto_id)) ? Number(item.estoque_produto_id) : null,
      nome: String(item?.nome ?? '').trim(),
      produto_id: Number(item?.produto_id),
      quantidade: Number(item?.quantidade),
      tamanho: String(item?.tamanho ?? '').trim(),
      valor_unitario: Number(item?.valor_unitario),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.produto_id) &&
        item.produto_id > 0 &&
        Number.isInteger(item.quantidade) &&
        item.quantidade > 0 &&
        Number.isFinite(item.valor_unitario) &&
        item.codigo_produto &&
        item.nome &&
        item.tamanho,
    );
}

function buildWhatsAppMessage(codigo: string, items: PublicVendaItemInput[], total: number) {
  const lines = items.map((item) => `${item.quantidade}x ${item.nome} (${item.codigo_produto}) tamanho ${item.tamanho} - R$ ${item.valor_unitario.toFixed(2)}`);

  return encodeURIComponent(
    `Olá, gostaria de fazer um pedido na Pastoril Moda Country.\nPedido: ${codigo}\n${lines.join('\n')}\nTotal: R$ ${total.toFixed(2)}`,
  );
}

export async function POST(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar pedido.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const items = parseItems(body?.items);
    const sessionId = String(body?.sessionId ?? '').trim() || null;
    const codigo = generateVendaCode('PED');

    if (!items.length) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    const cliente = await getClienteFromRequest(request, supabaseAdmin);
    const vendaPayload = createVendaPayload({ cliente, codigo, items, sessionId, tipo: 'pedido_whatsapp' });
    const { data: venda, error: vendaError } = await supabaseAdmin
      .from('vendas')
      .insert([vendaPayload])
      .select('*')
      .single();

    if (vendaError || !venda) {
      return NextResponse.json({ error: `Erro ao registrar pedido: ${vendaError?.message ?? 'venda nao retornada.'}` }, { status: 500 });
    }

    const { error: itensError } = await supabaseAdmin
      .from('venda_itens')
      .insert(items.map((item) => createVendaItemPayload(venda.id, item)));

    if (itensError) {
      await supabaseAdmin.from('vendas').delete().eq('id', venda.id);
      return NextResponse.json({ error: `Erro ao registrar itens: ${itensError.message}` }, { status: 500 });
    }

    const whatsappUrl = `https://wa.me/${WHATSAPP_STORE_PHONE}?text=${buildWhatsAppMessage(venda.codigo, items, venda.total_original)}`;

    return NextResponse.json({ codigo: venda.codigo, id: venda.id, ok: true, whatsappUrl });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao registrar pedido.' }, { status: 500 });
  }
}
