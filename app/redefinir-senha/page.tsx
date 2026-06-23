'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clienteSupabase } from '@/lib/supabase-cliente';

function isStrongPassword(value: string) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await clienteSupabase.auth.getSession();

      if (mounted) {
        setReady(Boolean(data.session));
      }
    };

    void checkSession();

    const { data: listener } = clienteSupabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (senha !== confirmarSenha) {
      setError('A confirmacao da senha nao confere.');
      return;
    }

    if (!isStrongPassword(senha)) {
      setError('Use ao menos 8 caracteres com maiusculas, minusculas, numeros e simbolos.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await clienteSupabase.auth.updateUser({ password: senha });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await clienteSupabase.auth.signOut();
    setSuccess('Senha redefinida com sucesso. Entre novamente com sua nova senha.');
    setLoading(false);
    window.setTimeout(() => router.push('/login'), 1800);
  };

  return (
    <main className="min-h-[100svh] bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <section className="mx-auto w-full max-w-[460px] rounded-2xl border border-[#E7E0D8] bg-white/95 p-6 shadow-[0_14px_36px_rgba(74,45,26,0.08)] sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/pastoril-logo-header.png" alt="Pastoril Moda Country" width={130} height={80} priority className="h-auto w-[120px] object-contain" />
          <h1 className="mt-5 text-2xl font-bold text-[#4A2D1A]">Criar nova senha</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E625A]">Digite uma senha nova para sua conta Pastoril.</p>
        </div>

        {!ready ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Abra esta pagina pelo link enviado no e-mail de recuperação. O link pode expirar por segurança.
            </div>
            <Link href="/recuperar-senha" className="block rounded-xl bg-[#C8722C] px-6 py-3.5 text-center text-base font-bold text-white transition hover:bg-[#4A2D1A]">
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Nova senha</span>
              <input value={senha} onChange={(event) => setSenha(event.target.value)} type="password" className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10" required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Confirmar nova senha</span>
              <input value={confirmarSenha} onChange={(event) => setConfirmarSenha(event.target.value)} type="password" className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10" required />
            </label>

            {(error || success) && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error || success}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
