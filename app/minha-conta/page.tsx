'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCpf, formatPhone } from '@/lib/cliente-utils';
import { clienteSupabase } from '@/lib/supabase-cliente';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';

type Cliente = {
  id: number | string;
  auth_user_id: string;
  nome: string;
  cpf: string;
  celular: string;
  email: string | null;
  endereco_completo: string | null;
  must_change_password: boolean;
};

export default function MinhaContaPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailRequiredFromRedirect] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('email') === 'obrigatorio'
      : false,
  );

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      const { data } = await clienteSupabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/clientes/perfil', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || 'Nao foi possivel carregar seu perfil.');
        }

        if (!mounted) return;

        const loadedCliente = result.cliente as Cliente;
        if (loadedCliente.must_change_password) {
          router.push('/alterar-senha');
          return;
        }
        setCliente(loadedCliente);
        setNome(loadedCliente.nome ?? '');
        setEmail(loadedCliente.email ?? '');
        setEnderecoCompleto(loadedCliente.endereco_completo ?? '');
        setError('');
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar perfil.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const { data } = await clienteSupabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/clientes/perfil', {
        body: JSON.stringify({
          email,
          enderecoCompleto,
          nome,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Nao foi possivel atualizar seu perfil.');
      }

      const updatedCliente = result.cliente as Cliente;
      setCliente(updatedCliente);
      setNome(updatedCliente.nome ?? '');
      setEmail(updatedCliente.email ?? '');
      setEnderecoCompleto(updatedCliente.endereco_completo ?? '');
      setSuccess('Perfil atualizado com sucesso.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await clienteSupabase.auth.signOut();
    router.push('/login');
  };

  return (
    <main className="min-h-[100svh] bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-[#E7E0D8] bg-white/95 p-6 shadow-[0_14px_36px_rgba(74,45,26,0.08)] sm:p-8">
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/pastoril-logo-header.png"
              alt="Pastoril Moda Country"
              width={120}
              height={74}
              priority
              className="h-auto w-[96px] object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-[#4A2D1A]">Minha conta</h1>
              <p className="mt-1 text-sm text-[#6E625A]">Visualize e atualize seus dados.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-[#C8722C] px-4 py-2.5 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
          >
            Sair
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-10 text-center text-sm text-[#6E625A]">
            Carregando seus dados...
          </div>
        ) : (
          <>
            {cliente && (
              <div className="mb-5 grid gap-3 rounded-2xl border border-[#E7E0D8] bg-[#F9F6F1] p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#4A2D1A]">CPF</p>
                  <p className="mt-1 text-[#6E625A]">{formatCpf(cliente.cpf)}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#4A2D1A]">Celular de acesso</p>
                  <p className="mt-1 text-[#6E625A]">{formatPhone(cliente.celular)}</p>
                </div>
              </div>
            )}

            {cliente && !cliente.email && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                {emailRequiredFromRedirect
                  ? 'Cadastre um e-mail para continuar usando os recursos da sua conta.'
                  : 'Seu cadastro ainda nao possui e-mail. Informe um e-mail para manter a conta segura.'}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Nome</span>
                <input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">E-mail</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value.toLowerCase())}
                  type="email"
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                  placeholder="voce@email.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Endereco completo opcional</span>
                <textarea
                  value={enderecoCompleto}
                  onChange={(event) => setEnderecoCompleto(event.target.value)}
                  className="min-h-28 w-full resize-y rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                />
              </label>

              {(error || success) && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                    error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {error || success}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/" className="text-center text-sm font-bold text-[#C8722C] hover:text-[#4A2D1A]">
                  Voltar para a vitrine
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#C8722C] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner className="text-white" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    'Salvar alteracoes'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
