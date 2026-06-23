'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInClienteWithPhone } from '@/lib/cliente-login';
import { formatPhone, normalizeClientePhone } from '@/lib/cliente-utils';

export default function ClienteLoginPage() {
  const router = useRouter();
  const [celular, setCelular] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedPhone = normalizeClientePhone(celular);

    if (!normalizedPhone) {
      setError('Informe um celular valido com DDD.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signInClienteWithPhone(celular, senha);
      if (result.must_change_password) {
        router.push('/alterar-senha');
        return;
      }
      if (!result.email) {
        router.push('/minha-conta?email=obrigatorio');
        return;
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Nao foi possivel autenticar o cliente.');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    router.push('/minha-conta');
  };

  return (
    <main className="min-h-[100svh] bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <section className="mx-auto w-full max-w-[460px] rounded-2xl border border-[#E7E0D8] bg-white/95 p-6 shadow-[0_14px_36px_rgba(74,45,26,0.08)] sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/brand/pastoril-logo-header.png"
            alt="Pastoril Moda Country"
            width={130}
            height={80}
            priority
            className="h-auto w-[120px] object-contain"
          />
          <h1 className="mt-5 text-2xl font-bold text-[#4A2D1A]">Entrar na minha conta</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E625A]">Acesse com seu celular e senha.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Celular</span>
            <input
              value={celular}
              onChange={(event) => setCelular(formatPhone(event.target.value))}
              inputMode="tel"
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              placeholder="(68) 99999-9999"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Senha</span>
            <input
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              type="password"
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              required
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link href="/recuperar-senha" className="font-bold text-[#C8722C] hover:text-[#4A2D1A]">
            Esqueci minha senha
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-[#6E625A]">
          Ainda nao tem conta?{' '}
          <Link href="/cadastro" className="font-bold text-[#C8722C] hover:text-[#4A2D1A]">
            Criar cadastro
          </Link>
        </p>
      </section>
    </main>
  );
}
