'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { clienteSupabase } from '@/lib/supabase-cliente';

export default function AlterarSenhaPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await clienteSupabase.auth.getSession();

      if (!data.session) {
        router.push('/login');
        return;
      }

      setChecking(false);
    };

    void checkSession();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { data } = await clienteSupabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/clientes/senha', {
        body: JSON.stringify({ confirmPassword, currentPassword, newPassword }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Nao foi possivel alterar a senha.');
      }

      setSuccess('Senha alterada com sucesso. Entre novamente para continuar.');
      await clienteSupabase.auth.signOut();
      window.setTimeout(() => router.push('/login'), 1800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100svh] bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <section className="mx-auto w-full max-w-[500px] rounded-2xl border border-[#E7E0D8] bg-white/95 p-6 shadow-[0_14px_36px_rgba(74,45,26,0.08)] sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/pastoril-logo-header.png" alt="Pastoril Moda Country" width={130} height={80} priority className="h-auto w-[120px] object-contain" />
          <h1 className="mt-5 text-2xl font-bold text-[#4A2D1A]">Alterar senha</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E625A]">
            Por segurança, crie uma senha nova antes de continuar usando sua conta.
          </p>
        </div>

        {checking ? (
          <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-8 text-center text-sm text-[#6E625A]">
            Verificando sessao...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Senha temporária</span>
              <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10" required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Nova senha</span>
              <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10" required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Confirmar nova senha</span>
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10" required />
            </label>

            {(error || success) && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error || success}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
