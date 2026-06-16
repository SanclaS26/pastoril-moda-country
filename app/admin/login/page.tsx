'use client';

import { useState } from 'react';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white border border-amber-900/20 shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-amber-600 to-amber-700"></div>
          
          <div className="px-6 sm:px-8 py-12 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 shadow-lg mb-6">
              <span className="text-2xl font-bold text-white">P</span>
            </div>

            <h1 className="mt-4 text-3xl font-bold text-slate-900">Pastoril</h1>
            <p className="text-sm font-semibold text-amber-700 mt-1">Moda Country</p>
            
            <p className="mt-6 text-sm uppercase tracking-wider text-slate-600">Acesso administrativo</p>
          </div>

          <div className="px-6 sm:px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-900 mb-2">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-900 mb-2">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
                  required
                />
              </div>

              {(error || redirectedError) && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                  {error || redirectedError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-3 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:from-amber-700 hover:to-amber-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Carregando...' : 'Entrar'}
              </button>
            </form>

          </div>
        </div>

        <p className="text-center text-xs text-stone-300 mt-6">
          © 2026 Pastoril Moda Country - Acesso Administrativo
        </p>
      </div>
    </div>
  );
}

