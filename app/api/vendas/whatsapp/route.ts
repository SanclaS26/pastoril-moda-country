import { NextResponse } from 'next/server';
import { getClienteAccessBlock } from '@/lib/cliente-access';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteRow, type VendaRow } from '@/lib/supabase-admin';
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

function formatCurrency(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function formatCpfForMessage(value: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length !== 11) return null;

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function formatPhoneForMessage(value: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;

  if (localDigits.length === 10) {
    return localDigits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  if (localDigits.length === 11) {
    return localDigits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }

  return null;
}

function getOrderCustomer(venda: VendaRow) {
  const nome = venda.cliente_nome?.trim() ?? '';
  const cpf = formatCpfForMessage(venda.cliente_cpf);
  const celular = formatPhoneForMessage(venda.cliente_celular);

  if (!venda.cliente_auth_user_id || !nome || !cpf || !celular) return null;

  return {
    celular,
    cpf,
    nome,
  };
}

function buildWhatsAppMessage(
  codigo: string,
  cliente: NonNullable<ReturnType<typeof getOrderCustomer>>,
  items: PublicVendaItemInput[],
  total: number,
  observacoes: string,
) {
  const lines = items.map((item) => [
    `Produto: ${item.nome}`,
    `Codigo: ${item.codigo_produto}`,
    `Tamanho: ${item.tamanho}`,
    `Quantidade: ${item.quantidade}`,
    `Valor unitario: R$ ${formatCurrency(item.valor_unitario)}`,
    `Subtotal: R$ ${formatCurrency(item.valor_unitario * item.quantidade)}`,
  ].join('\n'));

  return encodeURIComponent(
    [
      'Olá! Gostaria de enviar este pedido.',
      '',
      `Pedido: ${codigo}`,
      `Cliente: ${cliente.nome}`,
      `CPF: ${cliente.cpf}`,
      `Celular: ${cliente.celular}`,
      '',
      'Itens:',
      lines.join('\n\n'),
      '',
      `Total: R$ ${formatCurrency(total)}`,
      `Observacoes: ${observacoes || 'Nenhuma'}`,
    ].join('\n'),
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
    const requestedCode = String(body?.codigo ?? '').trim();
    const codigo = /^PED-[A-Z0-9-]+$/.test(requestedCode) ? requestedCode : generateVendaCode('PED');
    const observacoes = String(body?.observacoes ?? '').trim().slice(0, 1000);

    if (!items.length) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    const cliente = await getClienteFromRequest(request, supabaseAdmin);

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente nao autenticado.' }, { status: 401 });
    }

    const block = getClienteAccessBlock(cliente);

    if (block) {
      return NextResponse.json({ code: block.code, error: block.error }, { status: block.status });
    }

    const { data: existing } = await supabaseAdmin
      .from('vendas')
      .select('*')
      .eq('codigo', codigo)
      .eq('tipo', 'pedido_whatsapp')
      .maybeSingle();

    if (existing) {
      if (existing.cliente_auth_user_id !== cliente.auth_user_id) {
        return NextResponse.json({ error: 'Codigo de pedido invalido.' }, { status: 409 });
      }

      const orderCustomer = getOrderCustomer(existing);

      if (!orderCustomer) {
        return NextResponse.json({ error: 'Pedido sem nome ou CPF completo vinculado ao cliente.' }, { status: 422 });
      }

      const whatsappUrl = `https://wa.me/${WHATSAPP_STORE_PHONE}?text=${buildWhatsAppMessage(existing.codigo, orderCustomer, items, existing.total_original, observacoes)}`;
      return NextResponse.json({ codigo: existing.codigo, id: existing.id, ok: true, whatsappUrl });
    }

    if (!cliente.nome.trim() || !formatCpfForMessage(cliente.cpf) || !formatPhoneForMessage(cliente.celular)) {
      return NextResponse.json({ error: 'Cliente sem nome, CPF ou celular completo para registrar o pedido.' }, { status: 422 });
    }

    const vendaPayload = createVendaPayload({ cliente, codigo, items, sessionId: null, tipo: 'pedido_whatsapp' });
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

    const orderCustomer = getOrderCustomer(venda);

    if (!orderCustomer) {
      return NextResponse.json({ error: 'Pedido registrado sem nome ou CPF completo vinculado ao cliente.' }, { status: 500 });
    }

    const whatsappUrl = `https://wa.me/${WHATSAPP_STORE_PHONE}?text=${buildWhatsAppMessage(venda.codigo, orderCustomer, items, venda.total_original, observacoes)}`;

    return NextResponse.json({ codigo: venda.codigo, id: venda.id, ok: true, whatsappUrl });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao registrar pedido.' }, { status: 500 });
  }
}
