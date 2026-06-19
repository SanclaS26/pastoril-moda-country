'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/admin/components/AdminShell';
import { formatCpf, formatPhone } from '@/lib/cliente-utils';
import { formatCurrency } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import type { VendaStatus } from '@/lib/supabase-admin';
import { useProtectedRoute } from '@/lib/useAuth';
import type { VendaWithItems } from '@/lib/vendas';

type StatusFilter = VendaStatus | 'todos';
type TipoFilter = 'todos' | 'carrinho' | 'pedido_whatsapp';
type DeletedFilter = 'ativas' | 'excluidas';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
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

  const [vendas, setVendas] = useState<VendaWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [tipo, setTipo] = useState<TipoFilter>('todos');
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>('ativas');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selectedVenda, setSelectedVenda] = useState<VendaWithItems | null>(null);
  const [saving, setSaving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [itemDrafts, setItemDrafts] = useState<Record<string, { quantidade_final: number; valor_unitario_final: number }>>({});

  useEffect(() => {
    const fetchVendas = async () => {
      try {
        setLoading(true);
        const token = await getSessionToken();
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status !== 'todos') params.set('status', status);
        if (tipo !== 'todos') params.set('tipo', tipo);
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
  }, [deletedFilter, end, search, start, status, tipo]);

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
    setItemDrafts(
      Object.fromEntries(
        venda.itens.map((item) => [
          item.id,
          {
            quantidade_final: item.quantidade_final,
            valor_unitario_final: item.valor_unitario_final,
          },
        ]),
      ),
    );
  };

  const updateVenda = async (nextStatus?: VendaStatus) => {
    if (!selectedVenda) return;

    const label = nextStatus ? statusLabel(nextStatus).toLowerCase() : 'salvar ajustes';
    if (nextStatus && !window.confirm(`Confirmar acao: ${label}?`)) {
      return;
    }

    try {
      setSaving(true);
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/vendas/${selectedVenda.id}`, {
        body: JSON.stringify({
          itens: selectedVenda.itens.map((item) => ({
            id: item.id,
            ...itemDrafts[item.id],
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
      openVenda(data.venda);
    } catch (saveError) {
      window.alert(saveError instanceof Error ? saveError.message : 'Erro ao atualizar venda.');
    } finally {
      setSaving(false);
    }
  };

  const softDeleteVenda = async (venda: VendaWithItems) => {
    const confirmed = window.confirm(
      `Excluir venda ${venda.codigo}?\nCliente: ${clienteLabel(venda)}\nStatus: ${statusLabel(venda.status)}\n\nA venda sera ocultada da lista principal, mas itens, pedidos, movimentos de estoque e historico serao preservados.`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
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
      window.alert('Venda excluida com sucesso.');
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir venda.');
    } finally {
      setSaving(false);
    }
  };

  const restoreVenda = async (venda: VendaWithItems) => {
    const confirmed = window.confirm(
      `Restaurar venda ${venda.codigo}?\nCliente: ${clienteLabel(venda)}\nStatus: ${statusLabel(venda.status)}`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
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
      window.alert('Venda restaurada com sucesso.');
    } catch (restoreError) {
      window.alert(restoreError instanceof Error ? restoreError.message : 'Erro ao restaurar venda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Vendas" subtitle="Carrinhos em aberto e pedidos enviados pelo WhatsApp." active="vendas">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicator label="Carrinhos abertos" value={loading ? '...' : indicators.carrinhos} />
          <Indicator label="Vendas em aberto" value={loading ? '...' : indicators.emAberto} />
          <Indicator label="Concluidas" value={loading ? '...' : indicators.concluidas} />
          <Indicator label="Canceladas" value={loading ? '...' : indicators.canceladas} />
        </div>

        <section className="grid gap-3 rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-[0_8px_18px_rgba(74,45,26,0.04)] md:grid-cols-6">
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]" placeholder="Codigo, nome, CPF ou celular" />
          <select value={tipo} onChange={(event) => setTipo(event.target.value as TipoFilter)} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]">
            <option value="todos">Todos os tipos</option>
            <option value="carrinho">Carrinhos</option>
            <option value="pedido_whatsapp">WhatsApp</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]">
            <option value="todos">Todos os status</option>
            <option value="em_aberto">Em aberto</option>
            <option value="concluida">Concluida</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select value={deletedFilter} onChange={(event) => setDeletedFilter(event.target.value as DeletedFilter)} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]">
            <option value="ativas">Ativas</option>
            <option value="excluidas">Excluidas</option>
          </select>
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]" />
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]" />
        </section>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-[0_8px_18px_rgba(74,45,26,0.04)]">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-[#6E625A]">Carregando vendas...</div>
          ) : vendas.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[#6E625A]">Nenhuma venda encontrada.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1080px]">
                  <thead className="border-b border-[#E7E0D8] bg-[#F7F0E7]">
                    <tr>
                      <Th>Codigo</Th>
                      <Th>Data</Th>
                      <Th>Cliente</Th>
                      <Th>Produtos</Th>
                      <Th>Total</Th>
                      <Th>Status</Th>
                      <Th>Acoes</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((venda) => (
                      <tr key={venda.id} className="border-b border-[#F1EAE2] last:border-0 hover:bg-[#F9F6F1]">
                        <Td>{venda.codigo}</Td>
                        <Td>{formatDateTime(venda.whatsapp_enviado_em ?? venda.created_at)}</Td>
                        <Td>{clienteLabel(venda)}</Td>
                        <Td>{venda.itens.map((item) => `${item.quantidade_final}x ${item.nome} (${item.tamanho})`).join(' | ')}</Td>
                        <Td>{formatCurrency(venda.total_final ?? venda.total_original)}</Td>
                        <Td>{statusLabel(venda.status)}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => openVenda(venda)} className="rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A] hover:bg-[#F7F0E7]">
                              Detalhes
                            </button>
                            {deletedFilter === 'excluidas' ? (
                              <button disabled={saving} onClick={() => restoreVenda(venda)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                                Restaurar
                              </button>
                            ) : (
                              <button disabled={saving} onClick={() => softDeleteVenda(venda)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
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
                  <article key={venda.id} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-[#241C17]">{venda.codigo}</h2>
                        <p className="text-xs text-[#6E625A]">{clienteLabel(venda)} - {statusLabel(venda.status)}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => openVenda(venda)} className="rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A]">Ver</button>
                        {deletedFilter === 'excluidas' ? (
                          <button disabled={saving} onClick={() => restoreVenda(venda)} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">
                            Restaurar
                          </button>
                        ) : (
                          <button disabled={saving} onClick={() => softDeleteVenda(venda)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[#6E625A]">{venda.itens.map((item) => `${item.quantidade_final}x ${item.nome} (${item.tamanho})`).join(' | ')}</p>
                    <p className="mt-3 text-sm font-bold text-[#4A2D1A]">{formatCurrency(venda.total_final ?? venda.total_original)}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedVenda && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <section className="max-h-[92svh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#E7E0D8] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#241C17]">{selectedVenda.codigo}</h2>
                <p className="mt-1 text-sm text-[#6E625A]">{clienteLabel(selectedVenda)} - {selectedVenda.cliente_cpf ? formatCpf(selectedVenda.cliente_cpf) : 'sem CPF'} - {selectedVenda.cliente_celular ? formatPhone(selectedVenda.cliente_celular) : 'sem telefone'}</p>
              </div>
              <button onClick={() => setSelectedVenda(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F0E7] text-xl text-[#4A2D1A]" aria-label="Fechar">x</button>
            </div>

            <div className="space-y-3">
              {selectedVenda.itens.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-3 md:grid-cols-[1fr_120px_150px]">
                  <div>
                    <p className="text-sm font-bold text-[#241C17]">{item.nome}</p>
                    <p className="text-xs text-[#6E625A]">{item.codigo_produto} - Tam. {item.tamanho} - Original: {item.quantidade_original} x {formatCurrency(item.valor_unitario_original)}</p>
                  </div>
                  <label className="text-xs font-bold text-[#4A2D1A]">
                    Quantidade final
                    <input type="number" min={0} value={itemDrafts[item.id]?.quantidade_final ?? 0} onChange={(event) => setItemDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], quantidade_final: Number(event.target.value) } }))} className="mt-1 w-full rounded-lg border border-[#E7E0D8] px-3 py-2" />
                  </label>
                  <label className="text-xs font-bold text-[#4A2D1A]">
                    Valor unitario final
                    <input type="number" min={0} step="0.01" value={itemDrafts[item.id]?.valor_unitario_final ?? 0} onChange={(event) => setItemDrafts((current) => ({ ...current, [item.id]: { ...current[item.id], valor_unitario_final: Number(event.target.value) } }))} className="mt-1 w-full rounded-lg border border-[#E7E0D8] px-3 py-2" />
                  </label>
                </div>
              ))}
            </div>

            <label className="mt-4 block text-sm font-bold text-[#4A2D1A]">
              Observacoes administrativas
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]" />
            </label>

            <div className="mt-5 flex flex-col gap-3 border-t border-[#E7E0D8] pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
              {selectedVenda.deleted_at ? (
                <button disabled={saving} onClick={() => restoreVenda(selectedVenda)} className="rounded-lg border border-emerald-300 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Restaurar venda</button>
              ) : (
                <button disabled={saving} onClick={() => softDeleteVenda(selectedVenda)} className="rounded-lg border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Excluir venda</button>
              )}
              <button disabled={saving} onClick={() => updateVenda()} className="rounded-lg border border-[#C8722C] px-4 py-3 text-sm font-bold text-[#4A2D1A] hover:bg-[#F7F0E7] disabled:opacity-50">Salvar ajustes</button>
              <button disabled={saving} onClick={() => updateVenda('em_aberto')} className="rounded-lg border border-[#C8722C] px-4 py-3 text-sm font-bold text-[#4A2D1A] hover:bg-[#F7F0E7] disabled:opacity-50">Reabrir</button>
              <button disabled={saving} onClick={() => updateVenda('cancelada')} className="rounded-lg border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancelar</button>
              <button disabled={saving} onClick={() => updateVenda('concluida')} className="rounded-lg bg-[#C8722C] px-4 py-3 text-sm font-bold text-white hover:bg-[#4A2D1A] disabled:opacity-50">Concluir venda</button>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function Indicator({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-[0_8px_18px_rgba(74,45,26,0.04)]">
      <p className="text-sm font-bold text-[#4A2D1A]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#241C17]">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-5 py-4 text-sm text-[#241C17]">{children}</td>;
}
