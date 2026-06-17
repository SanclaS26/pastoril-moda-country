'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [redirectedError] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return new URLSearchParams(window.location.search).get('error') ?? '';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push('/admin');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <Image
        src="/brand/login/login-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#F9F6F1]/42" />

      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <section className="w-full max-w-[460px] rounded-[28px] border border-[#E7E0D8] bg-[#FFFDFC]/96 px-6 py-8 shadow-[0_18px_48px_rgba(74,45,26,0.12)] sm:px-9 sm:py-10">
          <div className="mx-auto mb-7 h-[78px] w-[112px] sm:h-[88px] sm:w-[128px]">
            <div className="relative h-full w-full">
              <Image
                src="/brand/pastoril-logo-header.png"
                alt="Pastoril Moda Country"
                fill
                priority
                sizes="(min-width: 640px) 128px, 112px"
                className="object-contain"
              />
            </div>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-[#4A2D1A] sm:text-[2rem]">Acesso administrativo</h1>
            <p className="mt-3 text-sm leading-6 text-[#6E625A]">
              Entre com seu e-mail e senha para acessar o painel da Pastoril.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#4A2D1A]">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3.5 text-[#241C17] placeholder-[#9A8D83] outline-none transition focus:border-[#C8722C] focus:bg-white focus:ring-4 focus:ring-[#C8722C]/10"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#4A2D1A]">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3.5 text-[#241C17] placeholder-[#9A8D83] outline-none transition focus:border-[#C8722C] focus:bg-white focus:ring-4 focus:ring-[#C8722C]/10"
                  required
                />
              </div>

              {(error || redirectedError) && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error || redirectedError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.22)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Carregando...' : 'Entrar'}
              </button>
            </form>

          <p className="mt-8 text-center text-xs text-[#6E625A]">
            © 2026 Pastoril Moda Country — Acesso restrito
          </p>
        </section>
      </main>
    </div>
  );
}

