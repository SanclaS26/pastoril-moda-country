import { NextResponse } from 'next/server';
import { getClienteAccessBlock } from '@/lib/cliente-access';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteRow } from '@/lib/supabase-admin';
import {
  createVendaItemPayload,
  createVendaPayload,
  generateVendaCode,
  type PublicVendaItemInput,
} from '@/lib/vendas';
import { cleanupExpiredOpenCarts } from '@/lib/vendas-cleanup';

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
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password')
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

export async function POST(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar carrinho.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const items = parseItems(body?.items);
    const codigo = String(body?.codigo ?? '').trim() || generateVendaCode('CAR');
    const cliente = await getClienteFromRequest(request, supabaseAdmin);

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente autenticado obrigatorio para sincronizar o carrinho.' }, { status: 401 });
    }

    const block = getClienteAccessBlock(cliente);

    if (block) {
      return NextResponse.json({ code: block.code, error: block.error }, { status: block.status });
    }

    if (!cliente.nome?.trim() || !cliente.cpf?.trim() || !cliente.celular?.trim()) {
      return NextResponse.json({ error: 'Perfil do cliente incompleto para sincronizar o carrinho.' }, { status: 422 });
    }

    await cleanupExpiredOpenCarts(supabaseAdmin);

    if (!items.length) {
      const { data: deleted, error } = await supabaseAdmin.rpc('excluir_carrinho_em_aberto', {
        p_cliente_auth_user_id: cliente.auth_user_id,
        p_codigo: codigo,
        p_session_id: null,
      });

      if (error) {
        return NextResponse.json({ error: `Erro ao limpar carrinho vazio: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({ deleted: Boolean(deleted), ok: true });
    }

    const vendaPayload = createVendaPayload({ cliente, codigo, items, sessionId: null, tipo: 'carrinho' });

    const { data: existing } = await supabaseAdmin
      .from('vendas')
      .select('id, status, tipo')
      .eq('codigo', codigo)
      .eq('cliente_auth_user_id', cliente.auth_user_id)
      .eq('tipo', 'carrinho')
      .maybeSingle();

    if (existing?.status && existing.status !== 'em_aberto') {
      return NextResponse.json({ ok: true, codigo });
    }

    const { data: venda, error: vendaError } = existing
      ? await (() => {
          const { codigo: _codigo, ...vendaUpdatePayload } = vendaPayload;
          void _codigo;

          return supabaseAdmin
            .from('vendas')
            .update(vendaUpdatePayload)
            .eq('id', existing.id)
            .select('*')
            .single();
        })()
      : await supabaseAdmin
          .from('vendas')
          .insert([vendaPayload])
          .select('*')
          .single();

    if (vendaError || !venda) {
      return NextResponse.json({ error: `Erro ao salvar carrinho: ${vendaError?.message ?? 'venda nao retornada.'}` }, { status: 500 });
    }

    await supabaseAdmin.from('venda_itens').delete().eq('venda_id', venda.id);

    const { error: itensError } = await supabaseAdmin
      .from('venda_itens')
      .insert(items.map((item) => createVendaItemPayload(venda.id, item)));

    if (itensError) {
      return NextResponse.json({ error: `Erro ao salvar itens do carrinho: ${itensError.message}` }, { status: 500 });
    }

    return NextResponse.json({ codigo: venda.codigo, id: venda.id, ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao salvar carrinho.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar limpeza do carrinho.' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const params = new URL(request.url).searchParams;
    const codigo = String(body?.codigo ?? params.get('codigo') ?? '').trim();
    const cliente = await getClienteFromRequest(request, supabaseAdmin);

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente autenticado obrigatorio para encerrar o carrinho.' }, { status: 401 });
    }

    const block = getClienteAccessBlock(cliente);

    if (block) {
      return NextResponse.json({ code: block.code, error: block.error }, { status: block.status });
    }

    await cleanupExpiredOpenCarts(supabaseAdmin);

    if (!codigo) {
      return NextResponse.json({ error: 'Codigo do carrinho nao informado.' }, { status: 400 });
    }

    const { data: deleted, error } = await supabaseAdmin.rpc('excluir_carrinho_em_aberto', {
      p_cliente_auth_user_id: cliente.auth_user_id,
      p_codigo: codigo,
      p_session_id: null,
    });

    if (error) {
      return NextResponse.json({ error: `Erro ao limpar carrinho: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ deleted: Boolean(deleted), ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao limpar carrinho.' }, { status: 500 });
  }
}
