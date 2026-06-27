'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { normalizeRequiredEmail } from '@/lib/cliente-utils';
import { clienteSupabase } from '@/lib/supabase-cliente';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';

const neutralMessage = 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.';

function getRedirectUrl() {
  if (typeof window === 'undefined') return undefined;

  return `${window.location.origin}/redefinir-senha`;
}

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = normalizeRequiredEmail(email);

    if (!normalizedEmail) {
      setError('Informe um e-mail valido.');
      return;
    }

    setLoading(true);

    try {
      await clienteSupabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getRedirectUrl(),
      });
      setEmail(normalizedEmail);
      setMessage(neutralMessage);
    } catch {
      setMessage(neutralMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100svh] bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <section className="mx-auto w-full max-w-[460px] rounded-2xl border border-[#E7E0D8] bg-white/95 p-6 shadow-[0_14px_36px_rgba(74,45,26,0.08)] sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/pastoril-logo-header.png" alt="Pastoril Moda Country" width={130} height={80} priority className="h-auto w-[120px] object-contain" />
          <h1 className="mt-5 text-2xl font-bold text-[#4A2D1A]">Recuperar senha</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E625A]">Informe o e-mail cadastrado na sua conta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">E-mail</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              placeholder="voce@email.com"
              required
            />
          </label>

          {(error || message) && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error || message}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? (
              <>
                <LoadingSpinner className="text-white" />
                <span>Enviando...</span>
              </>
            ) : (
              'Enviar instruções'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6E625A]">
          <Link href="/login" className="font-bold text-[#C8722C] hover:text-[#4A2D1A]">Voltar ao login</Link>
        </p>
      </section>
    </main>
  );
}
