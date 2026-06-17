'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useProtectedRoute } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import AdminShell from '../components/AdminShell';

type Banner = {
  id: number;
  titulo: string | null;
  imagem_url: string;
  imagem_path: string;
  ativo: boolean;
  principal: boolean;
  created_at?: string;
  updated_at?: string;
};

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessão administrativa inválida ou expirada. Faça login novamente.');
  }

  return data.session.access_token;
}

export default function AdminBannersPage() {
  const router = useRouter();
  useProtectedRoute();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const response = await fetch('/api/admin/banners', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao carregar banners.');
      }

      setBanners(Array.isArray(data.banners) ? data.banners : []);
      setError('');
    } catch (fetchError) {
      setBanners([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar banners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchBanners(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : '');
  };

  const validateForm = () => {
    if (!imageFile) return 'Selecione uma imagem para o banner.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) return 'A imagem deve ser JPG, PNG ou WebP.';
    if (imageFile.size > 5 * 1024 * 1024) return 'A imagem deve ter no máximo 5 MB.';
    return '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      setSuccessMessage('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append('titulo', titulo.trim());
      formData.append('principal', 'true');
      formData.append('ativo', 'true');

      if (imageFile) {
        formData.append('imagem', imageFile);
      }

      const response = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar banner.');
      }

      setTitulo('');
      setImageFile(null);
      setImagePreview('');
      setSuccessMessage('Banner principal atualizado com sucesso.');
      await fetchBanners();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar banner.');
    } finally {
      setSaving(false);
    }
  };

  const setAsPrincipal = async (bannerId: number) => {
    if (activatingId) return;

    setActivatingId(bannerId);
    setError('');
    setSuccessMessage('');

    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/banners/${bannerId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao definir banner principal.');
      }

      setSuccessMessage('Banner principal alterado com sucesso.');
      await fetchBanners();
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'Erro ao definir banner principal.');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <AdminShell title="Banners" subtitle="Atualize o banner principal exibido na vitrine." active="banners">
      <div>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Banners</h1>
            <p className="mt-2 text-sm text-slate-600">Atualize o banner principal exibido na vitrine.</p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
          >
            Voltar ao painel
          </button>
        </div>

        {successMessage && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Novo banner principal</h2>
            <p className="mt-1 text-sm text-slate-600">Ao salvar, ele passa a ser o banner principal ativo.</p>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Título</span>
              <input
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Ex.: Coleção Country"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Imagem</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
              />
            </label>

            <div className="relative mt-4 aspect-[16/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Prévia do banner"
                  fill
                  sizes="(min-width: 1024px) 420px, 100vw"
                  unoptimized={imagePreview.startsWith('blob:')}
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Prévia do banner</div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Salvando banner...' : 'Salvar banner principal'}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Banners cadastrados</h2>
            </div>

            {loading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-600">Carregando banners...</div>
            ) : banners.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-600">Nenhum banner cadastrado.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {banners.map((banner) => (
                  <div key={banner.id} className="grid gap-4 px-6 py-4 md:grid-cols-[180px_1fr_auto] md:items-center">
                    <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-slate-100">
                      <Image
                        src={banner.imagem_url}
                        alt={banner.titulo || 'Banner'}
                        fill
                        sizes="(min-width: 768px) 180px, 100vw"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{banner.titulo || 'Banner sem título'}</p>
                        {banner.principal && banner.ativo && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Principal</span>
                        )}
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${banner.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                          {banner.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs text-slate-500">{banner.imagem_path}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAsPrincipal(banner.id)}
                      disabled={(banner.principal && banner.ativo) || activatingId === banner.id}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activatingId === banner.id ? 'Alterando...' : 'Definir principal'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </AdminShell>
  );
}
