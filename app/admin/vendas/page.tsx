'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminShell from '@/app/admin/components/AdminShell';
import AdminCurrencyInput from '@/app/admin/components/AdminCurrencyInput';
import ConfirmDialog from '@/app/admin/components/ConfirmDialog';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';
import { formatAdminCurrency, parseAdminCurrency } from '@/lib/admin-currency';
import { formatCpf, formatPhone } from '@/lib/cliente-utils';
import { formatCurrency } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import type { VendaStatus } from '@/lib/supabase-admin';
import { useProtectedRoute } from '@/lib/useAuth';
import type { VendaWithItems } from '@/lib/vendas';

type StatusFilter = VendaStatus;
type DeletedFilter = 'ativas' | 'excluidas';
type DraftItem = { quantidade_final: string; valor_unitario_final: string };
type ProductSearchResult = {
  id: number;
  codigo_produto: string;
  nome: string;
  ativo: boolean;
  em_promocao: boolean;
  preco: number;
  preco_promocional: number | null;
  estoque: Array<{ id?: number; tamanho: string; quantidade: number }>;
};
type AddedItemDraft = {
  estoque_produto_id: number;
  key: string;
  nome: string;
  quantidade_final: string;
  tamanho: string;
  valor_unitario_final: number;
};
type ConfirmState = {
  action: 'cancel' | 'delete' | 'restore' | 'status';
  status?: VendaStatus;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'neutral';
  venda: VendaWithItems;
} | null;

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatOpenTime(createdAt: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} dias`;
}

function statusLabel(status: VendaStatus) {
  return {
    cancelada: 'Cancelada',
    concluida: 'Concluida',
    em_aberto: 'Em aberto',
  }[status];
}

function clienteLabel(venda: VendaWithItems) {
  return venda.cliente_nome || '-';
}

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessao administrativa invalida ou expirada. Faca login novamente.');
  }

  return data.session.access_token;
}

export default function AdminVendasPage() {
  useProtectedRoute();
  const pathname = usePathname();
  const isOpenCarts = pathname.endsWith('/carrinhos-abertos');

  const [vendas, setVendas] = useState<VendaWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('em_aberto');
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>('ativas');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selectedVenda, setSelectedVenda] = useState<VendaWithItems | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [itemDrafts, setItemDrafts] = useState<Record<string, DraftItem>>({});
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [modalMessage, setModalMessage] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productSearch, setProductSearch] = useState<ProductSearchResult | null>(null);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSizeId, setProductSizeId] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [addedItems, setAddedItems] = useState<AddedItemDraft[]>([]);

  useEffect(() => {
    const fetchVendas = async () => {
      try {
        setLoading(true);
        const token = await getSessionToken();
        const params = new URLSearchParams();
        params.set('view', isOpenCarts ? 'open_carts' : 'sales');
        if (search) params.set('search', search);
        if (!isOpenCarts) params.set('status', status);
        if (!isOpenCarts) params.set('tipo', 'pedido_whatsapp');
        if (deletedFilter === 'excluidas') params.set('deleted', 'only');
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const response = await fetch(`/api/admin/vendas?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Falha ao carregar vendas.');
        }

        setVendas(Array.isArray(data.vendas) ? data.vendas : []);
        setError('');
      } catch (fetchError) {
        setVendas([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Erro desconhecido.');
      } finally {
        setLoading(false);
      }
    };

    const timeout = window.setTimeout(fetchVendas, 250);

    return () => window.clearTimeout(timeout);
  }, [deletedFilter, end, isOpenCarts, refreshKey, search, start, status]);

  const indicators = useMemo(
    () => ({
      canceladas: vendas.filter((venda) => venda.status === 'cancelada').length,
      carrinhos: vendas.filter((venda) => venda.tipo === 'carrinho' && venda.status === 'em_aberto').length,
      concluidas: vendas.filter((venda) => venda.status === 'concluida').length,
      emAberto: vendas.filter((venda) => venda.tipo === 'pedido_whatsapp' && venda.status === 'em_aberto').length,
    }),
    [vendas],
  );

  const openVenda = (venda: VendaWithItems) => {
    setSelectedVenda(venda);
    setAdminNotes(venda.observacoes_admin ?? '');
    setModalMessage('');
    setProductCode('');
    setProductSearch(null);
    setProductSizeId('');
    setProductQuantity('');
    setAddedItems([]);
    setItemDrafts(
      Object.fromEntries(
        venda.itens.map((item) => [
          item.id,
          {
            quantidade_final: String(item.quantidade_final),
            valor_unitario_final: formatAdminCurrency(item.valor_unitario_final),
          },
        ]),
      ),
    );
  };

  const getDraftQuantity = (itemId: string) => {
    const value = itemDrafts[itemId]?.quantidade_final ?? '';
    const quantity = Number(value);
    return Number.isInteger(quantity) ? quantity : NaN;
  };

  const normalizeItemQuantity = (item: VendaWithItems['itens'][number]) => {
    const rawValue = itemDrafts[item.id]?.quantidade_final ?? '';
    const parsed = Number(rawValue);
    const max = item.estoque_disponivel ?? Number.MAX_SAFE_INTEGER;
    const nextQuantity = !Number.isInteger(parsed) || parsed < 1 ? 1 : Math.min(parsed, max);
    setItemDrafts((current) => ({
      ...current,
      [item.id]: {
        ...current[item.id],
        quantidade_final: String(nextQuantity),
      },
    }));
    if (max !== Number.MAX_SAFE_INTEGER && parsed > max) {
      setModalMessage(`Quantidade ajustada para o estoque disponivel de ${item.nome}: ${max}.`);
    }
  };

  const updateVenda = async (nextStatus?: VendaStatus) => {
    if (!selectedVenda) return;

    try {
      setSaving(true);
      setModalMessage('');
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/vendas/${selectedVenda.id}`, {
        body: JSON.stringify({
          itens: selectedVenda.estoque_baixado
            ? []
            : selectedVenda.itens.map((item) => ({
                id: item.id,
                quantidade_final: getDraftQuantity(item.id),
                valor_unitario_final: parseAdminCurrency(itemDrafts[item.id]?.valor_unitario_final) ?? item.valor_unitario_final,
              })),
          add_itens: selectedVenda.estoque_baixado
            ? []
            : addedItems.map((item) => ({
                estoque_produto_id: item.estoque_produto_id,
                quantidade_final: Number(item.quantidade_final),
              })),
          observacoes_admin: adminNotes,
          status: nextStatus,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao atualizar venda.');
      }

      setVendas((current) => current.map((venda) => (venda.id === data.venda.id ? data.venda : venda)));
      setAddedItems([]);
      setProductCode('');
      setProductSearch(null);
      setProductSizeId('');
      setProductQuantity('');
      setSuccessMessage(nextStatus === 'concluida' ? 'Venda concluida com sucesso.' : nextStatus ? 'Status atualizado com sucesso.' : 'Ajustes salvos com sucesso.');

      if (nextStatus === 'concluida') {
        setSelectedVenda(null);
        setStatus('concluida');
        setRefreshKey((current) => current + 1);
      } else {
        openVenda(data.venda);
        setRefreshKey((current) => current + 1);
      }
    } catch (saveError) {
      setModalMessage(saveError instanceof Error ? saveError.message : 'Erro ao atualizar venda.');
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const softDeleteVenda = async (venda: VendaWithItems) => {
    try {
      setSaving(true);
      setError('');
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/vendas/${venda.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao excluir venda.');
      }

      setVendas((current) => current.filter((currentVenda) => currentVenda.id !== venda.id));
      if (selectedVenda?.id === venda.id) {
        setSelectedVenda(null);
      }
      setSuccessMessage('Venda excluida com sucesso.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir venda.');
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const restoreVenda = async (venda: VendaWithItems) => {
    try {
      setSaving(true);
      setError('');
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/vendas/${venda.id}`, {
        body: JSON.stringify({ action: 'restore' }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao restaurar venda.');
      }

      setVendas((current) => current.filter((currentVenda) => currentVenda.id !== venda.id));
      if (selectedVenda?.id === venda.id) {
        setSelectedVenda(null);
      }
      setSuccessMessage('Venda restaurada com sucesso.');
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Erro ao restaurar venda.');
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const requestStatusChange = (venda: VendaWithItems, nextStatus: VendaStatus) => {
    setConfirmState({
      action: 'status',
      confirmLabel: nextStatus === 'concluida' ? 'Concluir venda' : nextStatus === 'cancelada' ? 'Cancelar venda' : 'Reabrir venda',
      message: `Confirme a acao para a venda ${venda.codigo}. Cliente: ${clienteLabel(venda)}.`,
      status: nextStatus,
      title: nextStatus === 'concluida' ? 'Concluir venda?' : nextStatus === 'cancelada' ? 'Cancelar venda?' : 'Reabrir venda?',
      tone: nextStatus === 'cancelada' ? 'danger' : 'neutral',
      venda,
    });
  };

  const requestDelete = (venda: VendaWithItems) => {
    setConfirmState({
      action: 'delete',
      confirmLabel: 'Excluir venda',
      message: `A venda ${venda.codigo} sera ocultada da lista principal. Itens, pedido, movimentos de estoque e historico serao preservados.`,
      title: 'Excluir venda?',
      tone: 'danger',
      venda,
    });
  };

  const requestRestore = (venda: VendaWithItems) => {
    setConfirmState({
      action: 'restore',
      confirmLabel: 'Restaurar venda',
      message: `A venda ${venda.codigo} voltara para a lista principal com seus dados preservados.`,
      title: 'Restaurar venda?',
      venda,
    });
  };

  const runConfirmedAction = () => {
    if (!confirmState) return;
    if (confirmState.action === 'delete') void softDeleteVenda(confirmState.venda);
    if (confirmState.action === 'restore') void restoreVenda(confirmState.venda);
    if (confirmState.action === 'status') void updateVenda(confirmState.status);
  };

  const searchProductByCode = async () => {
    const code = productCode.trim();
    if (!code) {
      setModalMessage('Digite o codigo do produto.');
      return;
    }

    try {
      setProductSearchLoading(true);
      setModalMessage('');
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/produtos?code=${encodeURIComponent(code)}&pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao buscar produto.');
      const product = Array.isArray(data.products) ? data.products[0] : null;
      if (!product) throw new Error('Produto inexistente ou inativo.');
      const availableStock = (product.estoque ?? []).filter((item: { quantidade: number }) => item.quantidade > 0);
      if (!availableStock.length) throw new Error('Produto sem tamanhos disponiveis em estoque.');
      setProductSearch({ ...product, estoque: availableStock });
      setProductSizeId('');
      setProductQuantity('');
    } catch (searchError) {
      setProductSearch(null);
      setProductSizeId('');
      setProductQuantity('');
      setModalMessage(searchError instanceof Error ? searchError.message : 'Erro ao buscar produto.');
    } finally {
      setProductSearchLoading(false);
    }
  };

  const addProductDraft = () => {
    if (!productSearch) {
      setModalMessage('Busque um produto antes de adicionar.');
      return;
    }

    const selectedStock = productSearch.estoque.find((item) => String(item.id) === productSizeId);
    const quantity = Number(productQuantity);

    if (!selectedStock?.id) {
      setModalMessage('Selecione um tamanho disponivel.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setModalMessage('Informe uma quantidade inteira maior que zero.');
      return;
    }

    const existingDraftQuantity = addedItems
      .filter((item) => item.estoque_produto_id === selectedStock.id)
      .reduce((sum, item) => sum + Number(item.quantidade_final || 0), 0);
    const existingSaleQuantity = selectedVenda?.itens
      .filter((item) => item.estoque_produto_id === selectedStock.id)
      .reduce((sum, item) => sum + getDraftQuantity(item.id), 0) ?? 0;
    const nextTotal = existingDraftQuantity + existingSaleQuantity + quantity;

    if (nextTotal > selectedStock.quantidade) {
      setModalMessage(`Estoque insuficiente. Disponivel: ${selectedStock.quantidade}, solicitado: ${nextTotal}.`);
      return;
    }

    const key = `${selectedStock.id}-${Date.now()}`;
    const unitPrice = productSearch.em_promocao && productSearch.preco_promocional !== null ? productSearch.preco_promocional : productSearch.preco;
    setAddedItems((current) => [
      ...current,
      {
        estoque_produto_id: selectedStock.id!,
        key,
        nome: productSearch.nome,
        quantidade_final: String(quantity),
        tamanho: selectedStock.tamanho,
        valor_unitario_final: unitPrice,
      },
    ]);
    setProductCode('');
    setProductSearch(null);
    setProductSizeId('');
    setProductQuantity('');
    setModalMessage('');
  };

  const removeAddedItem = (key: string) => {
    setAddedItems((current) => current.filter((item) => item.key !== key));
  };

  return (
    <AdminShell
      title={isOpenCarts ? 'Carrinhos abertos' : 'Vendas'}
      subtitle={isOpenCarts ? 'Carrinhos ainda não enviados ou finalizados.' : 'Pedidos enviados e vendas processadas.'}
      active={isOpenCarts ? 'carrinhos' : 'vendas'}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isOpenCarts ? (
            <Indicator label="Carrinhos abertos" value={loading ? '...' : indicators.carrinhos} />
          ) : (
            <>
              <Indicator label="Vendas em aberto" value={loading ? '...' : indicators.emAberto} />
              <Indicator label="Concluidas" value={loading ? '...' : indicators.concluidas} />
              <Indicator label="Canceladas" value={loading ? '...' : indicators.canceladas} />
            </>
          )}
        </div>

        <section className={`admin-filter-bar grid gap-3 p-4 ${isOpenCarts ? 'md:grid-cols-4' : 'md:grid-cols-6'}`}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="admin-input rounded-xl px-4 py-3 text-sm outline-none" placeholder="Codigo, nome, CPF ou celular" />
          <select value={deletedFilter} onChange={(event) => setDeletedFilter(event.target.value as DeletedFilter)} className="admin-input rounded-xl px-4 py-3 text-sm outline-none">
            <option value="ativas">Ativas</option>
            <option value="excluidas">Excluidas</option>
          </select>
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="admin-input rounded-xl px-4 py-3 text-sm outline-none" />
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="admin-input rounded-xl px-4 py-3 text-sm outline-none" />
        </section>

        {successMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {!isOpenCarts && (
          <div className="admin-tab-group grid grid-cols-3 gap-2 p-2">
            {[
              { label: 'Abertas', value: 'em_aberto' as const },
              { label: 'Concluidas', value: 'concluida' as const },
              { label: 'Canceladas', value: 'cancelada' as const },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                aria-pressed={status === option.value}
                className="admin-tab"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <section className="admin-table-shell">
          {loading ? (
            <div className="admin-empty-state px-4 py-12 text-center text-sm">Carregando vendas...</div>
          ) : vendas.length === 0 ? (
            <div className="admin-empty-state px-4 py-12 text-center text-sm">{isOpenCarts ? 'Nenhum carrinho aberto encontrado.' : 'Nenhuma venda encontrada.'}</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="admin-table w-full min-w-[1080px]">
                  <thead>
                    <tr>
                      <Th>Codigo</Th>
                      <Th>Data</Th>
                      <Th>Cliente</Th>
                      {isOpenCarts && <Th>Telefone</Th>}
                      <Th>{isOpenCarts ? 'Quantidade de itens' : 'Produtos'}</Th>
                      <Th>Total</Th>
                      {isOpenCarts && <Th>Tempo aberto</Th>}
                      <Th>Status</Th>
                      <Th>Acoes</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((venda) => (
                      <tr key={venda.id} className="border-b border-[color:var(--admin-border)] last:border-0 hover:bg-[color:var(--admin-row-hover)]">
                        <Td>{venda.codigo}</Td>
                        <Td>{formatDateTime(venda.whatsapp_enviado_em ?? venda.created_at)}</Td>
                        <Td>{clienteLabel(venda)}</Td>
                        {isOpenCarts && <Td>{venda.cliente_celular ? formatPhone(venda.cliente_celular) : '-'}</Td>}
                        <Td>{isOpenCarts ? venda.itens.reduce((sum, item) => sum + item.quantidade_final, 0) : venda.itens.map((item) => `${item.quantidade_final}x ${item.nome} (${item.tamanho})`).join(' | ')}</Td>
                        <Td>{formatCurrency(venda.total_final ?? venda.total_original)}</Td>
                        {isOpenCarts && <Td>{formatOpenTime(venda.created_at)}</Td>}
                        <Td>{statusLabel(venda.status)}</Td>
                        <Td>
                          <div className="admin-table-actions">
                            <button onClick={() => openVenda(venda)} className="admin-table-action-secondary px-3 py-2 text-xs">
                              Detalhes
                            </button>
                            {deletedFilter === 'excluidas' ? (
                              <button disabled={saving} onClick={() => requestRestore(venda)} className="admin-table-action-secondary px-3 py-2 text-xs disabled:opacity-50">
                                Restaurar
                              </button>
                            ) : (
                              <button disabled={saving} onClick={() => requestDelete(venda)} className="admin-table-action-danger px-3 py-2 text-xs disabled:opacity-50">
                                Excluir
                              </button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 lg:hidden">
                {vendas.map((venda) => (
                  <article key={venda.id} className="admin-panel-soft rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-[color:var(--admin-text)]">{venda.codigo}</h2>
                        <p className="text-xs text-[color:var(--admin-muted)]">{clienteLabel(venda)} - {statusLabel(venda.status)}</p>
                        {isOpenCarts && <p className="text-xs text-[color:var(--admin-muted)]">{venda.cliente_celular ? formatPhone(venda.cliente_celular) : 'Sem telefone'} · {formatOpenTime(venda.created_at)}</p>}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => openVenda(venda)} className="admin-table-action-secondary px-3 py-2 text-xs">Ver</button>
                        {deletedFilter === 'excluidas' ? (
                          <button disabled={saving} onClick={() => requestRestore(venda)} className="admin-table-action-secondary px-3 py-2 text-xs disabled:opacity-50">
                            Restaurar
                          </button>
                        ) : (
                          <button disabled={saving} onClick={() => requestDelete(venda)} className="admin-table-action-danger px-3 py-2 text-xs disabled:opacity-50">
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[color:var(--admin-muted)]">{venda.itens.map((item) => `${item.quantidade_final}x ${item.nome} (${item.tamanho})`).join(' | ')}</p>
                    <p className="mt-3 text-sm font-bold text-[color:var(--admin-text)]">{formatCurrency(venda.total_final ?? venda.total_original)}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedVenda && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <section className="admin-modal-surface max-h-[92svh] w-full max-w-4xl overflow-y-auto rounded-2xl p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[color:var(--admin-border)] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[color:var(--admin-text)]">{selectedVenda.codigo}</h2>
                <p className="mt-1 text-sm text-[color:var(--admin-muted)]">{clienteLabel(selectedVenda)} - {selectedVenda.cliente_cpf ? formatCpf(selectedVenda.cliente_cpf) : 'sem CPF'} - {selectedVenda.cliente_celular ? formatPhone(selectedVenda.cliente_celular) : 'sem telefone'}</p>
              </div>
              <button onClick={() => setSelectedVenda(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--admin-surface-soft)] text-xl text-[color:var(--admin-text)]" aria-label="Fechar">x</button>
            </div>

            {modalMessage && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">{modalMessage}</div>}

            <div className="space-y-3">
              {selectedVenda.itens.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-soft)] p-3 md:grid-cols-[1fr_120px_150px]">
                  <div>
                    <p className="text-sm font-bold text-[color:var(--admin-text)]">{item.nome}</p>
                    <p className="text-xs text-[color:var(--admin-muted)]">{item.codigo_produto} - Tam. {item.tamanho} - Original: {item.quantidade_original} x {formatCurrency(item.valor_unitario_original)}</p>
                  </div>
                  <label className="text-xs font-bold text-[color:var(--admin-text)]">
                    Quantidade final
                    <input
                      inputMode="numeric"
                      value={itemDrafts[item.id]?.quantidade_final ?? ''}
                      onBlur={() => normalizeItemQuantity(item)}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, '');
                        const max = item.estoque_disponivel ?? Number.MAX_SAFE_INTEGER;
                        if (value && Number(value) > max) {
                          setModalMessage(`Estoque disponivel para ${item.nome} (${item.tamanho}): ${max}.`);
                          setItemDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], quantidade_final: String(max) } }));
                          return;
                        }
                        setItemDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], quantidade_final: value } }));
                      }}
                      className="admin-input mt-1 w-full rounded-lg px-3 py-2"
                    />
                    {item.estoque_disponivel !== null && item.estoque_disponivel !== undefined && <span className="mt-1 block font-normal text-[color:var(--admin-muted)]">Estoque: {item.estoque_disponivel}</span>}
                  </label>
                  <label className="text-xs font-bold text-[color:var(--admin-text)]">
                    Valor unitario final
                    <AdminCurrencyInput
                      value={itemDrafts[item.id]?.valor_unitario_final ?? ''}
                      onValueChange={(value) => setItemDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], valor_unitario_final: value } }))}
                      className="mt-1 w-full rounded-lg"
                    />
                  </label>
                </div>
              ))}
            </div>

            {!isOpenCarts && !selectedVenda.estoque_baixado && (
              <section className="mt-4 rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-soft)] p-4">
                <h3 className="text-sm font-bold text-[color:var(--admin-text)]">Adicionar produto</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input value={productCode} onChange={(event) => setProductCode(event.target.value)} className="admin-input rounded-lg px-3 py-2 text-sm outline-none" placeholder="Codigo do produto" />
                  <button type="button" disabled={productSearchLoading} onClick={() => void searchProductByCode()} className="admin-table-action-secondary rounded-lg px-4 py-2 text-sm disabled:opacity-60">
                    {productSearchLoading ? (
                      <>
                        <LoadingSpinner className="text-current" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      'Buscar'
                    )}
                  </button>
                </div>
                {productSearch && (
                  <div className="mt-3 grid gap-3 rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-3 md:grid-cols-[1fr_150px_120px_auto]">
                    <div>
                      <p className="text-sm font-bold text-[color:var(--admin-text)]">{productSearch.nome}</p>
                      <p className="text-xs text-[color:var(--admin-muted)]">{productSearch.codigo_produto}</p>
                    </div>
                    <select value={productSizeId} onChange={(event) => setProductSizeId(event.target.value)} className="admin-input rounded-lg px-3 py-2 text-sm">
                      <option value="">Tamanho</option>
                      {productSearch.estoque.map((item) => <option key={item.id} value={item.id}>{item.tamanho} - {item.quantidade}</option>)}
                    </select>
                    <input
                      inputMode="numeric"
                      value={productQuantity}
                      onBlur={() => {
                        if (!productQuantity) setProductQuantity('1');
                      }}
                      onChange={(event) => setProductQuantity(event.target.value.replace(/\D/g, ''))}
                      className="admin-input rounded-lg px-3 py-2 text-sm"
                      placeholder="Qtd."
                    />
                    <button type="button" onClick={addProductDraft} className="rounded-lg bg-[color:var(--admin-text)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
                      Adicionar
                    </button>
                  </div>
                )}
                {addedItems.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {addedItems.map((item) => (
                      <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-semibold text-[color:var(--admin-text)]">{item.quantidade_final}x {item.nome} ({item.tamanho})</span>
                        <button type="button" onClick={() => removeAddedItem(item.key)} className="text-xs font-bold text-rose-700 dark:text-rose-300">Remover</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <label className="mt-4 block text-sm font-bold text-[color:var(--admin-text)]">
              Observacoes administrativas
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} className="admin-input mt-2 min-h-20 w-full rounded-xl px-4 py-3 text-sm outline-none" />
            </label>

            <div className="mt-4 rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-soft)] px-4 py-3 text-right">
              <p className="text-xs font-bold uppercase text-[color:var(--admin-muted)]">Total previsto</p>
              <p className="mt-1 text-xl font-black text-[color:var(--admin-text)]">
                {formatCurrency(selectedVenda.itens.reduce((total, item) => {
                  const quantity = Number(itemDrafts[item.id]?.quantidade_final || 0);
                  const unitPrice = parseAdminCurrency(itemDrafts[item.id]?.valor_unitario_final) ?? item.valor_unitario_final;
                  return total + quantity * unitPrice;
                }, addedItems.reduce((total, item) => total + Number(item.quantidade_final || 0) * item.valor_unitario_final, 0)))}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-[color:var(--admin-border)] pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
              {selectedVenda.deleted_at ? (
                <button disabled={saving} onClick={() => requestRestore(selectedVenda)} className="admin-table-action-secondary rounded-lg px-4 py-3 text-sm disabled:opacity-50">Restaurar venda</button>
              ) : (
                <button disabled={saving} onClick={() => requestDelete(selectedVenda)} className="admin-table-action-danger rounded-lg px-4 py-3 text-sm disabled:opacity-50">Excluir venda</button>
              )}
              <button disabled={saving} onClick={() => updateVenda()} className="admin-table-action-secondary rounded-lg px-4 py-3 text-sm disabled:opacity-50">Salvar ajustes</button>
              <button disabled={saving} onClick={() => requestStatusChange(selectedVenda, 'em_aberto')} className="admin-table-action-secondary rounded-lg px-4 py-3 text-sm disabled:opacity-50">Reabrir</button>
              <button disabled={saving} onClick={() => requestStatusChange(selectedVenda, 'cancelada')} className="admin-table-action-danger rounded-lg px-4 py-3 text-sm disabled:opacity-50">Cancelar</button>
              <button disabled={saving} onClick={() => requestStatusChange(selectedVenda, 'concluida')} className="admin-button admin-button-primary">Concluir venda</button>
            </div>
          </section>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          loading={saving}
          onCancel={() => {
            if (!saving) setConfirmState(null);
          }}
          onConfirm={runConfirmedAction}
          tone={confirmState.tone}
        />
      )}
    </AdminShell>
  );
}

function Indicator({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-panel rounded-2xl p-4">
      <p className="text-sm font-bold text-[color:var(--admin-text)]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[color:var(--admin-text)]">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[color:var(--admin-muted)]">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-5 py-4 text-sm text-[color:var(--admin-text)]">{children}</td>;
}
