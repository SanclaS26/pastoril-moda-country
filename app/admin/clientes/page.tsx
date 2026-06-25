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
  must_change_password: boolean;
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
  const [success, setSuccess] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [clienteToReset, setClienteToReset] = useState<Cliente | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  const handleDeleteCliente = async () => {
    if (!clienteToDelete) return;

    try {
      setDeleting(true);
      setError('');
      setSuccess('');
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/clientes?id=${encodeURIComponent(String(clienteToDelete.id))}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Nao foi possivel excluir o cliente.');
      }

      setClientes((current) => current.filter((cliente) => cliente.id !== clienteToDelete.id));
      setSelectedCliente((current) => (current?.id === clienteToDelete.id ? null : current));
      setClienteToDelete(null);
      setSuccess(data?.message || 'Cliente excluido com sucesso.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erro ao excluir cliente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!clienteToReset) return;

    try {
      setResetting(true);
      setError('');
      setSuccess('');
      setTemporaryPassword('');
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/clientes/${encodeURIComponent(String(clienteToReset.id))}/reset-password`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Nao foi possivel redefinir a senha.');
      }

      setTemporaryPassword(String(data.temporaryPassword ?? ''));
      setClientes((current) =>
        current.map((cliente) =>
          cliente.id === clienteToReset.id ? { ...cliente, must_change_password: true } : cliente,
        ),
      );
      setSuccess('Senha temporaria gerada. Copie agora; ela nao sera exibida novamente.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Erro ao redefinir senha.');
    } finally {
      setResetting(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setSuccess('Senha temporaria copiada.');
  };

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

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
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
                          <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCliente(cliente)}
                            className="rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                          >
                            Ver dados
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTemporaryPassword('');
                              setClienteToReset(cliente);
                            }}
                            className="rounded-lg border border-[#E7E0D8] px-3 py-2 text-xs font-bold text-[#4A2D1A] transition hover:border-[#C8722C] hover:bg-[#F7F0E7]"
                          >
                            Redefinir senha
                          </button>
                          <button
                            type="button"
                            onClick={() => setClienteToDelete(cliente)}
                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                          >
                            Excluir
                          </button>
                          </div>
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
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCliente(cliente)}
                          className="rounded-lg border border-[#C8722C] px-3 py-2 text-xs font-bold text-[#4A2D1A]"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTemporaryPassword('');
                            setClienteToReset(cliente);
                          }}
                          className="rounded-lg border border-[#E7E0D8] px-3 py-2 text-xs font-bold text-[#4A2D1A]"
                        >
                          Senha
                        </button>
                        <button
                          type="button"
                          onClick={() => setClienteToDelete(cliente)}
                          className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700"
                        >
                          Excluir
                        </button>
                      </div>
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
                <dt className="font-bold text-[#4A2D1A]">Troca de senha</dt>
                <dd className="mt-1 text-[#241C17]">{selectedCliente.must_change_password ? 'Obrigatoria no proximo acesso' : 'Nao pendente'}</dd>
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

      {clienteToReset && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cancelar redefinicao"
            onClick={() => !resetting && setClienteToReset(null)}
          />

          <section
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#E7E0D8] bg-white p-5 text-[#241C17] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-cliente-title"
          >
            <div className="mb-4">
              <h2 id="reset-cliente-title" className="text-xl font-bold text-[#4A2D1A]">
                Redefinir senha
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6E625A]">
                As sessoes do cliente poderao ser encerradas. O cliente sera obrigado a criar uma nova senha no proximo acesso.
              </p>
            </div>

            <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-4 text-sm">
              <p className="font-bold text-[#241C17]">{clienteToReset.nome}</p>
              <p className="mt-1 text-[#6E625A]">{clienteToReset.email || 'Cliente sem e-mail cadastrado'}</p>
            </div>

            {temporaryPassword ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Esta senha temporaria sera exibida somente agora. Envie ao cliente por um canal seguro e nunca por URL.
                </div>
                <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 font-mono text-lg font-bold tracking-wide text-[#241C17]">
                  {temporaryPassword}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={copyTemporaryPassword}
                    className="rounded-xl bg-[#C8722C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#4A2D1A]"
                  >
                    Copiar senha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemporaryPassword('');
                      setClienteToReset(null);
                    }}
                    className="rounded-xl border border-[#C8722C] px-4 py-3 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setClienteToReset(null)}
                  disabled={resetting}
                  className="rounded-xl border border-[#C8722C] px-4 py-3 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetting}
                  className="rounded-xl bg-[#C8722C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resetting ? 'Gerando...' : 'Gerar senha temporaria'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {clienteToDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cancelar exclusao"
            onClick={() => !deleting && setClienteToDelete(null)}
          />

          <section
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#E7E0D8] bg-white p-5 text-[#241C17] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-cliente-title"
          >
            <div className="mb-4">
              <h2 id="delete-cliente-title" className="text-xl font-bold text-[#4A2D1A]">
                Excluir cliente?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6E625A]">
                Esta acao e sensivel. Clientes com pedidos ou vendas nao serao excluidos fisicamente para preservar o historico comercial.
              </p>
            </div>

            <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-4 text-sm">
              <p className="font-bold text-[#241C17]">{clienteToDelete.nome}</p>
              <p className="mt-1 text-[#6E625A]">{formatPhone(clienteToDelete.celular)}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setClienteToDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-[#C8722C] px-4 py-3 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCliente}
                disabled={deleting}
                className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir cliente'}
              </button>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
