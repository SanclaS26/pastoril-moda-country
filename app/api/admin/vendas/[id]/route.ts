import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import type { VendaItemInsert, VendaItemRow, VendaUpdate } from '@/lib/supabase-admin';
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

type ItemAddInput = {
  estoque_produto_id: number;
  quantidade_final: number;
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
    .eq('venda_id', id)
    .order('created_at', { ascending: true });

  if (itensError) {
    throw new Error(itensError.message);
  }

  const stockIds = [...new Set((itens ?? []).map((item) => item.estoque_produto_id).filter((stockId): stockId is number => typeof stockId === 'number'))];
  const { data: stocks, error: stockError } = stockIds.length
    ? await supabaseAdmin.from('estoque_produtos').select('id, quantidade').in('id', stockIds)
    : { data: [], error: null };

  if (stockError) {
    throw new Error(stockError.message);
  }

  const stockById = new Map((stocks ?? []).map((stock) => [stock.id, stock.quantidade]));
  const itensWithStock = (itens ?? []).map((item) => ({
    ...item,
    estoque_disponivel: item.estoque_produto_id ? (stockById.get(item.estoque_produto_id) ?? null) : null,
  }));

  return { itens: itensWithStock as Array<VendaItemRow & { estoque_disponivel?: number | null }>, venda };
}

async function ensureStockAvailable(
  supabaseAdmin: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>,
  item: Pick<VendaItemRow, 'estoque_produto_id' | 'nome' | 'produto_id' | 'quantidade_final' | 'tamanho'>,
) {
  if (!item.estoque_produto_id) {
    throw new Error(`Item ${item.nome} nao possui estoque vinculado.`);
  }

  const { data: stock, error } = await supabaseAdmin
    .from('estoque_produtos')
    .select('id, produto_id, tamanho, quantidade')
    .eq('id', item.estoque_produto_id)
    .eq('produto_id', item.produto_id)
    .eq('tamanho', item.tamanho)
    .single();

  if (error || !stock) {
    throw new Error(`Estoque nao encontrado para ${item.nome} (${item.tamanho}).`);
  }

  if (stock.quantidade < item.quantidade_final) {
    throw new Error(`Estoque insuficiente para ${item.nome} (${item.tamanho}). Disponivel: ${stock.quantidade}, solicitado: ${item.quantidade_final}.`);
  }
}

async function addItemToVenda(
  supabaseAdmin: ReturnType<typeof import('@/lib/supabase-admin').getSupabaseAdmin>,
  vendaId: string,
  input: ItemAddInput,
) {
  const quantidade = Number(input.quantidade_final);
  const estoqueProdutoId = Number(input.estoque_produto_id);

  if (!Number.isInteger(estoqueProdutoId) || estoqueProdutoId <= 0 || !Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error('Produto e quantidade para adicionar sao obrigatorios.');
  }

  const { data: stock, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('id, produto_id, tamanho, quantidade')
    .eq('id', estoqueProdutoId)
    .single();

  if (stockError || !stock) {
    throw new Error('Tamanho com estoque nao encontrado.');
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from('produtos')
    .select('id, codigo_produto, nome, preco, preco_promocional, em_promocao, ativo')
    .eq('id', stock.produto_id)
    .eq('ativo', true)
    .single();

  if (productError || !product) {
    throw new Error('Produto inexistente ou inativo.');
  }

  const { data: existingItem, error: existingError } = await supabaseAdmin
    .from('venda_itens')
    .select('*')
    .eq('venda_id', vendaId)
    .eq('produto_id', product.id)
    .eq('tamanho', stock.tamanho)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao verificar item existente: ${existingError.message}`);
  }

  const nextQuantity = (existingItem?.quantidade_final ?? 0) + quantidade;

  if (stock.quantidade < nextQuantity) {
    throw new Error(`Estoque insuficiente para ${product.nome} (${stock.tamanho}). Disponivel: ${stock.quantidade}, solicitado: ${nextQuantity}.`);
  }

  if (existingItem) {
    const { error: updateError } = await supabaseAdmin
      .from('venda_itens')
      .update({ quantidade_final: nextQuantity })
      .eq('id', existingItem.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar item existente: ${updateError.message}`);
    }
    return;
  }

  const unitPrice = product.em_promocao && product.preco_promocional !== null ? product.preco_promocional : product.preco;
  const itemPayload: VendaItemInsert = {
    codigo_produto: product.codigo_produto,
    estoque_produto_id: stock.id,
    nome: product.nome,
    produto_id: product.id,
    quantidade_final: quantidade,
    quantidade_original: quantidade,
    tamanho: stock.tamanho,
    valor_unitario_final: unitPrice,
    valor_unitario_original: unitPrice,
    venda_id: vendaId,
  };

  const { error: insertError } = await supabaseAdmin.from('venda_itens').insert([itemPayload]);

  if (insertError) {
    throw new Error(`Erro ao adicionar produto a venda: ${insertError.message}`);
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
    const itemAdds = Array.isArray(body?.add_itens) ? (body.add_itens as ItemAddInput[]) : [];
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

      if (!update.id || !Number.isInteger(quantidade) || quantidade < 1 || !Number.isFinite(valor) || valor < 0) {
        return NextResponse.json({ error: 'Itens finais invalidos.' }, { status: 400 });
      }

      const currentItem = (await loadVenda(authorization.supabaseAdmin, id)).itens.find((item) => item.id === update.id);
      if (!currentItem) {
        return NextResponse.json({ error: 'Item da venda nao encontrado.' }, { status: 404 });
      }

      await ensureStockAvailable(authorization.supabaseAdmin, {
        ...currentItem,
        quantidade_final: quantidade,
      });

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

    for (const itemAdd of itemAdds) {
      await addItemToVenda(authorization.supabaseAdmin, id, itemAdd);
    }

    const { itens: refreshedItems, venda: refreshedVenda } = await loadVenda(authorization.supabaseAdmin, id);
    const totalFinal = refreshedItems.reduce((total, item) => total + item.quantidade_final * item.valor_unitario_final, 0);
    const updateVenda: VendaUpdate = {
      total_final: totalFinal,
    };

    if (observacoesAdmin !== undefined) {
      updateVenda.observacoes_admin = observacoesAdmin;
    }

    if (!nextStatus && venda.status === 'concluida' && !venda.estoque_baixado) {
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

    let finalVenda = updatedVenda;

    if (nextStatus && nextStatus !== refreshedVenda.status) {
      const rpcName = nextStatus === 'concluida'
        ? 'concluir_venda'
        : nextStatus === 'cancelada'
          ? 'cancelar_venda'
          : 'reabrir_venda';
      const { data: rpcVenda, error: rpcError } = await authorization.supabaseAdmin.rpc(rpcName, { p_venda_id: id });

      if (rpcError || !rpcVenda) {
        return NextResponse.json({ error: `Erro ao mudar status da venda: ${rpcError?.message ?? 'venda nao retornada.'}` }, { status: 500 });
      }

      finalVenda = rpcVenda;
    } else if (observacoesAdmin !== undefined || itemUpdates.length > 0 || itemAdds.length > 0) {
      const { data: responseVenda, error: responseError } = await authorization.supabaseAdmin.rpc('registrar_primeira_resposta_admin', { p_venda_id: id });

      if (responseError || !responseVenda) {
        return NextResponse.json({ error: `Erro ao registrar primeira resposta: ${responseError?.message ?? 'venda nao retornada.'}` }, { status: 500 });
      }

      finalVenda = responseVenda;
    }

    const { data: updatedItems } = await authorization.supabaseAdmin
      .from('venda_itens')
      .select('*')
      .eq('venda_id', id);

    return NextResponse.json({ venda: { ...finalVenda, itens: updatedItems ?? [] } });
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
