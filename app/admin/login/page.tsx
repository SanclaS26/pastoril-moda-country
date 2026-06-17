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
    <div className="relative min-h-[100svh] overflow-hidden bg-[#F9F6F1] px-5 text-[#241C17]">
      <Image
        src="/brand/login/login-bg2.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="z-0 object-cover object-[center_bottom]"
      />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(249,246,241,0.48)_0%,rgba(249,246,241,0.34)_56%,rgba(36,28,23,0.18)_100%)]" />

      <main className="relative z-10 flex min-h-[100svh] flex-col items-center justify-start pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 sm:pt-10 lg:pt-12">
        <section className="w-full max-w-[430px] rounded-[26px] border border-[#E7E0D8]/90 bg-[#FFFDFC]/91 px-6 py-7 shadow-[0_18px_46px_rgba(74,45,26,0.14)] backdrop-blur-[2px] sm:max-w-[450px] sm:px-9 sm:py-9">
          <div className="mx-auto mb-6 h-[72px] w-[104px] sm:h-[82px] sm:w-[120px]">
            <div className="relative h-full w-full">
              <Image
                src="/brand/pastoril-logo-header.png"
                alt="Pastoril Moda Country"
                fill
                priority
                sizes="(min-width: 640px) 120px, 104px"
                className="object-contain"
              />
            </div>
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-[1.8rem] font-bold leading-tight text-[#4A2D1A] sm:text-[2rem]">
              Acesso administrativo
            </h1>
            <p className="mx-auto mt-3 max-w-[320px] text-sm leading-6 text-[#6E625A]">
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
                className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1]/92 px-4 py-3.5 text-[#241C17] placeholder-[#9A8D83] outline-none transition focus:border-[#C8722C] focus:bg-white focus:ring-4 focus:ring-[#C8722C]/10"
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
                placeholder="********"
                className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1]/92 px-4 py-3.5 text-[#241C17] placeholder-[#9A8D83] outline-none transition focus:border-[#C8722C] focus:bg-white focus:ring-4 focus:ring-[#C8722C]/10"
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
        </section>

        <p className="mt-auto pb-3 pt-8 text-center text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(36,28,23,0.55)] sm:pb-4">
          Pastoril Moda Country &copy; 2026
        </p>
      </main>
    </div>
  );
}
