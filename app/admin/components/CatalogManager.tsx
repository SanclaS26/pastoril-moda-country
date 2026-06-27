'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { supabase } from '@/lib/supabase';

type Item = { id: number; nome: string; ativo: boolean; tipo_grade?: string };
type Props = { endpoint: 'categorias' | 'marcas'; itemLabel: string };

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export default function CatalogManager({ endpoint, itemLabel }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [gradeType, setGradeType] = useState('unico');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);

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
        body: JSON.stringify({ nome: name, ...(endpoint === 'categorias' ? { tipo_grade: gradeType } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setName('');
      setGradeType('unico');
      setEditing(null);
      setMessage(`${itemLabel} salva com sucesso.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar.');
    }
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
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await token()}` },
    });
    const body = await response.json();
    setDeleting(null);
    if (!response.ok) return setMessage(body.error);
    setMessage(`${itemLabel} excluída com sucesso.`);
    await load();
  };

  return (
    <>
      <form onSubmit={save} className="admin-panel mb-6 flex flex-col gap-3 rounded-2xl p-5 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nome da ${itemLabel.toLowerCase()}`}
          required
          className="admin-input flex-1 rounded-lg px-4 py-3 outline-none"
        />
        {endpoint === 'categorias' && (
          <select
            value={gradeType}
            onChange={(event) => setGradeType(event.target.value)}
            className="admin-input rounded-lg px-4 py-3 outline-none"
            aria-label="Tipo de grade"
          >
            <option value="roupas">Roupas</option>
            <option value="calcados">Calçados</option>
            <option value="chapeus_bones">Chapéus e bonés</option>
            <option value="cintos">Cintos</option>
            <option value="unico">Tamanho único</option>
          </select>
        )}
        <button className="rounded-lg bg-[color:var(--admin-accent)] px-6 py-3 font-bold text-white">
          {editing ? 'Salvar alteração' : `Cadastrar ${itemLabel.toLowerCase()}`}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setName('');
              setGradeType('unico');
            }}
            className="admin-table-action-secondary rounded-lg px-5 py-3"
          >
            Cancelar
          </button>
        )}
      </form>

      {message && <p className="admin-empty-state mb-4 rounded-lg px-4 py-3 text-sm">{message}</p>}

      <div className="admin-table-shell overflow-hidden rounded-2xl">
        {loading ? (
          <p className="admin-empty-state p-8 text-center">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="admin-empty-state p-8 text-center">Nenhum cadastro.</p>
        ) : (
          <div className="divide-y divide-[color:var(--admin-border)]">
            {items.map((item) => (
              <div key={item.id} className="admin-list-row flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1 font-semibold text-[color:var(--admin-text)]">{item.nome}</span>
                {item.tipo_grade && <span className="admin-badge">{item.tipo_grade.replace('_', ' ')}</span>}
                <span className={`admin-badge ${item.ativo ? 'admin-badge-success' : ''}`}>
                  {item.ativo ? 'Ativa' : 'Inativa'}
                </span>
                <button
                  onClick={() => {
                    setEditing(item);
                    setName(item.nome);
                    setGradeType(item.tipo_grade ?? 'unico');
                  }}
                  className="admin-table-action-secondary text-sm"
                >
                  Editar
                </button>
                <button onClick={() => void toggle(item)} className="admin-table-action-secondary text-sm">
                  {item.ativo ? 'Inativar' : 'Ativar'}
                </button>
                <button onClick={() => setDeleting(item)} className="admin-table-action-danger text-sm">
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Excluir ${itemLabel.toLowerCase()}`}
          message={`Deseja excluir “${deleting.nome}”?`}
          confirmLabel="Excluir"
          tone="danger"
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
