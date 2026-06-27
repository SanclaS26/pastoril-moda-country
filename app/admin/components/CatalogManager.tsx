'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ConfirmDialog from './ConfirmDialog';

type Item = { id: number; nome: string; ativo: boolean };
type Props = { endpoint: 'categorias' | 'marcas'; itemLabel: string };

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sessão expirada.');
  return data.session.access_token;
}

export default function CatalogManager({ endpoint, itemLabel }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/${endpoint}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body[endpoint] ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/admin/${endpoint}${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setName(''); setEditing(null); setMessage(`${itemLabel} salva com sucesso.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao salvar.'); }
  };

  const toggle = async (item: Item) => {
    const response = await fetch(`/api/admin/${endpoint}/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !item.ativo }),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error);
    await load();
  };

  const remove = async () => {
    if (!deleting) return;
    const response = await fetch(`/api/admin/${endpoint}/${deleting.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${await token()}` },
    });
    const body = await response.json();
    setDeleting(null);
    if (!response.ok) return setMessage(body.error);
    setMessage(`${itemLabel} excluída com sucesso.`);
    await load();
  };

  return <>
    <form onSubmit={save} className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#E7E0D8] bg-white p-5 sm:flex-row">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Nome da ${itemLabel.toLowerCase()}`} required className="flex-1 rounded-lg border border-[#D9CEC2] px-4 py-3 outline-none focus:border-[#C8722C]" />
      <button className="rounded-lg bg-[#C8722C] px-6 py-3 font-bold text-white">{editing ? 'Salvar alteração' : `Cadastrar ${itemLabel.toLowerCase()}`}</button>
      {editing && <button type="button" onClick={() => { setEditing(null); setName(''); }} className="rounded-lg border px-5 py-3">Cancelar</button>}
    </form>
    {message && <p className="mb-4 rounded-lg bg-[#F7F0E7] px-4 py-3 text-sm">{message}</p>}
    <div className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white">
      {loading ? <p className="p-8 text-center">Carregando...</p> : items.length === 0 ? <p className="p-8 text-center">Nenhum cadastro.</p> :
        <div className="divide-y divide-[#E7E0D8]">{items.map((item) =>
          <div key={item.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="min-w-0 flex-1 font-semibold">{item.nome}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{item.ativo ? 'Ativa' : 'Inativa'}</span>
            <button onClick={() => { setEditing(item); setName(item.nome); }} className="text-sm font-bold text-[#C8722C]">Editar</button>
            <button onClick={() => void toggle(item)} className="text-sm font-bold">{item.ativo ? 'Inativar' : 'Ativar'}</button>
            <button onClick={() => setDeleting(item)} className="text-sm font-bold text-red-700">Excluir</button>
          </div>)}</div>}
    </div>
    {deleting && <ConfirmDialog title={`Excluir ${itemLabel.toLowerCase()}`} message={`Deseja excluir “${deleting.nome}”?`} confirmLabel="Excluir" tone="danger" onCancel={() => setDeleting(null)} onConfirm={() => void remove()} />}
  </>;
}
