'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/admin/components/AdminShell';
import { formatCpf, formatPhone } from '@/lib/cliente-utils';
import { supabase } from '@/lib/supabase';
import { useProtectedRoute } from '@/lib/useAuth';

type Cliente = {
  id: number | string;
  auth_user_id: string;
  nome: string;
  cpf: string;
  celular: string;
  email: string | null;
  endereco_completo: string | null;
  created_at?: string | null;
};

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, '').padStart(11, '0').slice(-11);

  return `***.***.***-${digits.slice(-2)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessao administrativa invalida ou expirada. Faca login novamente.');
  }

  return data.session.access_token;
}

export default function AdminClientesPage() {
  useProtectedRoute();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setLoading(true);
        const token = await getSessionToken();
        const response = await fetch(`/api/admin/clientes?search=${encodeURIComponent(search)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Falha ao carregar clientes.');
        }

        setClientes(Array.isArray(data.clientes) ? data.clientes : []);
        setError('');
      } catch (fetchError) {
        setClientes([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Erro desconhecido.');
      } finally {
        setLoading(false);
      }
    };

    const timeout = window.setTimeout(fetchClientes, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const totalClientes = useMemo(() => clientes.length, [clientes]);

  return (
    <AdminShell
      title="Clientes"
      subtitle="Cadastros da vitrine publica."
      active="clientes"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-[0_8px_18px_rgba(74,45,26,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#4A2D1A]">Clientes cadastrados</p>
            <p className="mt-1 text-2xl font-black text-[#241C17]">{loading ? '...' : totalClientes}</p>
          </div>

          <label className="w-full sm:max-w-md">
            <span className="sr-only">Buscar clientes</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm text-[#241C17] outline-none transition focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              placeholder="Buscar por nome, CPF ou celular"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-[0_8px_18px_rgba(74,45,26,0.04)]">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-[#6E625A]">Carregando clientes...</div>
          ) : clientes.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[#6E625A]">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px]">
                  <thead className="border-b border-[#E7E0D8] bg-[#F7F0E7]">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">Nome</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">CPF</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">Celular</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">E-mail</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">Endereco</th>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">Cadastro</th>
                      <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[#6E625A]">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cliente) => (
                      <tr key={cliente.id} className="border-b border-[#F1EAE2] last:border-0 hover:bg-[#F9F6F1]">
                        <td className="px-5 py-4 text-sm font-bold text-[#241C17]">{cliente.nome}</td>
                        <td className="px-5 py-4 text-sm text-[#6E625A]">{maskCpf(cliente.cpf)}</td>
                        <td className="px-5 py-4 text-sm text-[#6E625A]">{formatPhone(cliente.celular)}</td>
                        <td className="px-5 py-4 text-sm text-[#6E625A]">{cliente.email || '-'}</td>
                        <td className="max-w-[220px] truncate px-5 py-4 text-sm text-[#6E625A]">
                          {cliente.endereco_completo || '-'}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#6E625A]">{formatDate(cliente.created_at)}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedCliente(cliente)}
                            className="rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                          >
                            Ver dados
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 lg:hidden">
                {clientes.map((cliente) => (
                  <article key={cliente.id} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-[#241C17]">{cliente.nome}</h2>
                        <p className="mt-1 text-xs text-[#6E625A]">{maskCpf(cliente.cpf)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCliente(cliente)}
                        className="shrink-0 rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A]"
                      >
                        Ver
                      </button>
                    </div>
                    <dl className="mt-4 grid gap-2 text-xs text-[#6E625A]">
                      <div>
                        <dt className="font-bold text-[#4A2D1A]">Celular</dt>
                        <dd>{formatPhone(cliente.celular)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-[#4A2D1A]">E-mail</dt>
                        <dd>{cliente.email || '-'}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-[#4A2D1A]">Cadastro</dt>
                        <dd>{formatDate(cliente.created_at)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedCliente && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <section className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#E7E0D8] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#241C17]">{selectedCliente.nome}</h2>
                <p className="mt-1 text-sm text-[#6E625A]">Dados completos do cliente.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCliente(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F0E7] text-xl text-[#4A2D1A]"
                aria-label="Fechar"
              >
                x
              </button>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-bold text-[#4A2D1A]">CPF</dt>
                <dd className="mt-1 text-[#241C17]">{formatCpf(selectedCliente.cpf)}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#4A2D1A]">Celular</dt>
                <dd className="mt-1 text-[#241C17]">{formatPhone(selectedCliente.celular)}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#4A2D1A]">E-mail</dt>
                <dd className="mt-1 text-[#241C17]">{selectedCliente.email || '-'}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#4A2D1A]">Data de cadastro</dt>
                <dd className="mt-1 text-[#241C17]">{formatDate(selectedCliente.created_at)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-bold text-[#4A2D1A]">Endereco</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[#241C17]">{selectedCliente.endereco_completo || '-'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
