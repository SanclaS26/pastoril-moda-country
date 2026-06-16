'use client';

import { useRouter } from 'next/navigation';
import { useProtectedRoute } from '@/lib/useAuth';

export default function AdminBannersPage() {
  const router = useRouter();
  useProtectedRoute();

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Banners</h1>
            <p className="mt-2 text-sm text-slate-600">Nenhum banner cadastrado.</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
          >
            Voltar ao painel
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-600">Cadastre banners reais antes de exibir conteúdo nesta área.</p>
        </div>
      </div>
    </div>
  );
}
