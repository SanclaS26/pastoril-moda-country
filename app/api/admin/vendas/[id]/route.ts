import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import type { VendaItemRow, VendaUpdate } from '@/lib/supabase-admin';
import { normalizeVendaStatus } from '@/lib/vendas';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ItemUpdateInput = {
  id: string;
  quantidade_final: number;
  valor_unitario_final: number;
};

async function loadVenda(supabaseAdmin: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>, id: string) {
  const { data: venda, error } = await supabaseAdmin
    .from('vendas')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !venda) {
    throw new Error(error?.message || 'Venda nao encontrada.');
  }

  const { data: itens, error: itensError } = await supabaseAdmin
    .from('venda_itens')
    .select('*')
    .eq('venda_id', id);

  if (itensError) {
    throw new Error(itensError.message);
  }

  return { itens: (itens ?? []) as VendaItemRow[], venda };
}

async function baixarEstoque(
  supabaseAdmin: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>,
  vendaId: string,
  itens: VendaItemRow[],
) {
  for (const item of itens) {
    if (item.quantidade_final <= 0) continue;

    const { data: stock, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('id, quantidade')
      .eq('produto_id', item.produto_id)
      .eq('tamanho', item.tamanho)
      .single();

    if (stockError || !stock) {
      throw new Error(`Estoque nao encontrado para ${item.nome} (${item.tamanho}).`);
    }

    if (stock.quantidade < item.quantidade_final) {
      throw new Error(`Estoque insuficiente para ${item.nome} (${item.tamanho}).`);
    }

    const { error: updateError } = await supabaseAdmin
      .from('estoque_produtos')
      .update({ quantidade: stock.quantidade - item.quantidade_final })
      .eq('id', stock.id);

    if (updateError) {
      throw new Error(`Erro ao baixar estoque de ${item.nome}: ${updateError.message}`);
    }

    await supabaseAdmin.from('venda_estoque_movimentos').insert([{
      estoque_produto_id: stock.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade_final,
      tamanho: item.tamanho,
      tipo: 'baixa',
      venda_id: vendaId,
    }]);
  }
}

async function restaurarEstoque(
  supabaseAdmin: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>,
  vendaId: string,
  itens: VendaItemRow[],
) {
  for (const item of itens) {
    if (item.quantidade_final <= 0) continue;

    const { data: stock, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('id, quantidade')
      .eq('produto_id', item.produto_id)
      .eq('tamanho', item.tamanho)
      .single();

    if (stockError || !stock) {
      throw new Error(`Estoque nao encontrado para restaurar ${item.nome} (${item.tamanho}).`);
    }

    const { error: updateError } = await supabaseAdmin
      .from('estoque_produtos')
      .update({ quantidade: stock.quantidade + item.quantidade_final })
      .eq('id', stock.id);

    if (updateError) {
      throw new Error(`Erro ao restaurar estoque de ${item.nome}: ${updateError.message}`);
    }

    await supabaseAdmin.from('venda_estoque_movimentos').insert([{
      estoque_produto_id: stock.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade_final,
      tamanho: item.tamanho,
      tipo: 'restauracao',
      venda_id: vendaId,
    }]);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const nextStatus = normalizeVendaStatus(body?.status ?? null);
    const observacoesAdmin = typeof body?.observacoes_admin === 'string' ? body.observacoes_admin : undefined;
    const itemUpdates = Array.isArray(body?.itens) ? (body.itens as ItemUpdateInput[]) : [];
    const { venda } = await loadVenda(authorization.supabaseAdmin, id);

    if (action === 'restore') {
      const { data: restoredVenda, error: restoreError } = await authorization.supabaseAdmin
        .from('vendas')
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (restoreError || !restoredVenda) {
        return NextResponse.json({ error: `Erro ao restaurar venda: ${restoreError?.message ?? 'venda nao retornada.'}` }, { status: 500 });
      }

      const { data: restoredItems } = await authorization.supabaseAdmin
        .from('venda_itens')
        .select('*')
        .eq('venda_id', id);

      return NextResponse.json({ venda: { ...restoredVenda, itens: restoredItems ?? [] } });
    }

    for (const update of itemUpdates) {
      const quantidade = Number(update.quantidade_final);
      const valor = Number(update.valor_unitario_final);

      if (!update.id || !Number.isInteger(quantidade) || quantidade < 0 || !Number.isFinite(valor) || valor < 0) {
        return NextResponse.json({ error: 'Itens finais invalidos.' }, { status: 400 });
      }

      const { error } = await authorization.supabaseAdmin
        .from('venda_itens')
        .update({
          quantidade_final: quantidade,
          valor_unitario_final: valor,
        })
        .eq('id', update.id)
        .eq('venda_id', id);

      if (error) {
        return NextResponse.json({ error: `Erro ao ajustar item: ${error.message}` }, { status: 500 });
      }
    }

    const { itens: refreshedItems, venda: refreshedVenda } = await loadVenda(authorization.supabaseAdmin, id);
    const totalFinal = refreshedItems.reduce((total, item) => total + item.quantidade_final * item.valor_unitario_final, 0);
    const updateVenda: VendaUpdate = {
      total_final: totalFinal,
    };

    if (observacoesAdmin !== undefined) {
      updateVenda.observacoes_admin = observacoesAdmin;
    }

    if (nextStatus && nextStatus !== refreshedVenda.status) {
      if (nextStatus === 'concluida' && !refreshedVenda.estoque_baixado) {
        await baixarEstoque(authorization.supabaseAdmin, id, refreshedItems);
        updateVenda.estoque_baixado = true;
      }

      if (refreshedVenda.estoque_baixado && (nextStatus === 'cancelada' || nextStatus === 'em_aberto')) {
        await restaurarEstoque(authorization.supabaseAdmin, id, refreshedItems);
        updateVenda.estoque_baixado = false;
      }

      updateVenda.status = nextStatus;
    } else if (!nextStatus && venda.status === 'concluida' && !venda.estoque_baixado) {
      return NextResponse.json({ error: 'Venda concluida sem controle de estoque consistente.' }, { status: 409 });
    }

    const { data: updatedVenda, error: vendaError } = await authorization.supabaseAdmin
      .from('vendas')
      .update(updateVenda)
      .eq('id', id)
      .select('*')
      .single();

    if (vendaError || !updatedVenda) {
      return NextResponse.json({ error: `Erro ao atualizar venda: ${vendaError?.message ?? 'venda nao retornada.'}` }, { status: 500 });
    }

    const { data: updatedItems } = await authorization.supabaseAdmin
      .from('venda_itens')
      .select('*')
      .eq('venda_id', id);

    return NextResponse.json({ venda: { ...updatedVenda, itens: updatedItems ?? [] } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro inesperado ao atualizar venda.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { id } = await context.params;
    const { venda } = await loadVenda(authorization.supabaseAdmin, id);

    if (venda.deleted_at) {
      return NextResponse.json({ venda: { ...venda, itens: [] }, ok: true });
    }

    const { data: deletedVenda, error } = await authorization.supabaseAdmin
      .from('vendas')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: authorization.user.id,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !deletedVenda) {
      return NextResponse.json({ error: `Erro ao excluir venda: ${error?.message ?? 'venda nao retornada.'}` }, { status: 500 });
    }

    const { data: itens } = await authorization.supabaseAdmin
      .from('venda_itens')
      .select('*')
      .eq('venda_id', id);

    return NextResponse.json({ venda: { ...deletedVenda, itens: itens ?? [] }, ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro inesperado ao excluir venda.' },
      { status: 500 },
    );
  }
}
