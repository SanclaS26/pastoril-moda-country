'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AdminShell from '@/app/admin/components/AdminShell';
import { formatCurrency } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import { useProtectedRoute } from '@/lib/useAuth';

type Client = { auth_user_id: string; email: string | null; nome: string };
type Product = { codigo_produto: string; em_promocao: boolean; id: number; imagem_principal: string | null; nome: string; preco: number; preco_promocional: number | null };
type Summary = { client: Client | null; itemCount: number; lastUpdated: string; userId: string };
type DetailItem = { available: boolean; createdAt: string; product: Product };

async function getToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sessão administrativa expirada.');
  return data.session.access_token;
}

export default function AdminWishlistsPage() {
  useProtectedRoute();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('count');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const params = new URLSearchParams({ page: String(page), search, sort });
        const response = await fetch(`/api/admin/wishlists?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'Falha ao carregar listas.');
        setSummaries(Array.isArray(result.summaries) ? result.summaries : []);
        setTotal(Number(result.total) || 0);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar listas.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, search, sort]);

  const openDetails = async (summary: Summary) => {
    try {
      setSelectedClient(summary.client);
      setDetailItems([]);
      setDetailLoading(true);
      const token = await getToken();
      const response = await fetch(`/api/admin/wishlists?user_id=${encodeURIComponent(summary.userId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Falha ao carregar detalhes.');
      setSelectedClient(result.client ?? summary.client);
      setDetailItems(Array.isArray(result.items) ? result.items : []);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Falha ao carregar detalhes.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AdminShell title="Listas de desejos" subtitle="Consulta dos produtos favoritados pelos clientes." active="wishlists">
      <div className="space-y-5">
        <div className="grid gap-3 rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-sm md:grid-cols-[1fr_240px]">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar cliente, e-mail ou código" className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]" />
          <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm outline-none focus:border-[#C8722C]">
            <option value="count">Maior quantidade</option>
            <option value="recent">Atualização mais recente</option>
            <option value="name">Nome do cliente</option>
          </select>
        </div>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <div className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-sm">
          {loading ? <p className="p-8 text-center text-sm text-[#6E625A]">Carregando listas...</p> : summaries.length === 0 ? <p className="p-8 text-center text-sm text-[#6E625A]">Nenhuma lista encontrada.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-[#F7F0E7] text-left text-xs uppercase text-[#6E625A]"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">E-mail</th><th className="px-5 py-3">Produtos</th><th className="px-5 py-3">Última atualização</th><th className="px-5 py-3 text-right">Lista</th></tr></thead>
                <tbody>{summaries.map((summary) => <tr key={summary.userId} className="border-t border-[#E7E0D8]"><td className="px-5 py-4 text-sm font-semibold">{summary.client?.nome || 'Cliente sem perfil'}</td><td className="px-5 py-4 text-sm text-[#6E625A]">{summary.client?.email || '-'}</td><td className="px-5 py-4 text-sm font-bold">{summary.itemCount}</td><td className="px-5 py-4 text-sm text-[#6E625A]">{new Date(summary.lastUpdated).toLocaleString('pt-BR')}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => void openDetails(summary)} className="rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A]">Visualizar</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-[#6E625A]"><span>{total} cliente(s)</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div>
      </div>

      {(selectedClient || detailLoading) && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#241C17]/60 px-4 py-6"><button type="button" className="absolute inset-0" aria-label="Fechar detalhes" onClick={() => { setSelectedClient(null); setDetailItems([]); }} /><section className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-4 border-b pb-4"><div><h2 className="text-xl font-bold text-[#241C17]">{selectedClient?.nome || 'Lista do cliente'}</h2><p className="text-sm text-[#6E625A]">{selectedClient?.email || '-'}</p></div><button type="button" onClick={() => { setSelectedClient(null); setDetailItems([]); }} className="h-10 w-10 rounded-full bg-[#F7F0E7]" aria-label="Fechar">x</button></div>{detailLoading ? <p className="py-8 text-center">Carregando...</p> : <div className="space-y-3">{detailItems.map((item) => <article key={`${item.product.id}-${item.createdAt}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-xl border border-[#E7E0D8] p-3"><div className="relative h-16 w-16 overflow-hidden rounded-lg bg-[#F7F0E7]">{item.product.imagem_principal && <Image src={item.product.imagem_principal} alt={item.product.nome} fill sizes="64px" className="object-contain" />}</div><div className="min-w-0"><p className="truncate font-semibold">{item.product.nome}</p><p className="text-xs text-[#6E625A]">{item.product.codigo_produto} · {formatCurrency(item.product.em_promocao && item.product.preco_promocional !== null ? item.product.preco_promocional : item.product.preco)}</p><p className="text-xs text-[#6E625A]">Salvo em {new Date(item.createdAt).toLocaleString('pt-BR')} · {item.available ? 'Disponível' : 'Indisponível'}</p></div><Link href={`/produto/${item.product.id}`} target="_blank" className="text-xs font-bold text-[#C8722C]">Abrir</Link></article>)}</div>}</section></div>}
    </AdminShell>
  );
}
