'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useProtectedRoute } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import AdminShell from '../components/AdminShell';

type Banner = {
  id: number;
  titulo: string | null;
  imagem_url: string;
  imagem_path: string;
  imagem_desktop_url: string | null;
  imagem_desktop_path: string | null;
  imagem_mobile_url: string | null;
  imagem_mobile_path: string | null;
  ativo: boolean;
  principal: boolean;
  created_at?: string;
  updated_at?: string;
};

type BannerAction = 'principal' | 'toggle' | 'delete' | null;

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessao administrativa invalida ou expirada. Faca login novamente.');
  }

  return data.session.access_token;
}

function getDesktopUrl(banner: Banner) {
  return banner.imagem_desktop_url || banner.imagem_url;
}

function getMobileUrl(banner: Banner) {
  return banner.imagem_mobile_url || banner.imagem_url;
}

function validateImage(file: File | null, label: string, required: boolean) {
  if (!file) {
    return required ? `Selecione a imagem ${label} do banner.` : '';
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `A imagem ${label} deve ser JPG, PNG ou WebP.`;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `A imagem ${label} deve ter no maximo 5 MB.`;
  }

  return '';
}

export default function AdminBannersPage() {
  useProtectedRoute();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyBanner, setBusyBanner] = useState<{ id: number; action: BannerAction } | null>(null);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [titulo, setTitulo] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [principal, setPrincipal] = useState(false);
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [desktopPreview, setDesktopPreview] = useState('');
  const [mobilePreview, setMobilePreview] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isEditing = Boolean(editingBanner);

  const formTitle = useMemo(() => (isEditing ? 'Editar banner' : 'Novo banner'), [isEditing]);

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

  useEffect(() => {
    return () => {
      if (desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview);
      if (mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview);
    };
  }, [desktopPreview, mobilePreview]);

  const setDesktopImage = (file: File | null) => {
    if (desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview);
    setDesktopFile(file);
    setDesktopPreview(file ? URL.createObjectURL(file) : editingBanner ? getDesktopUrl(editingBanner) : '');
  };

  const setMobileImage = (file: File | null) => {
    if (mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview);
    setMobileFile(file);
    setMobilePreview(file ? URL.createObjectURL(file) : editingBanner ? getMobileUrl(editingBanner) : '');
  };

  const resetForm = () => {
    if (desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview);
    if (mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview);
    setEditingBanner(null);
    setTitulo('');
    setAtivo(true);
    setPrincipal(false);
    setDesktopFile(null);
    setMobileFile(null);
    setDesktopPreview('');
    setMobilePreview('');
  };

  const startEditing = (banner: Banner) => {
    if (desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview);
    if (mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview);
    setEditingBanner(banner);
    setTitulo(banner.titulo || '');
    setAtivo(banner.ativo);
    setPrincipal(banner.principal);
    setDesktopFile(null);
    setMobileFile(null);
    setDesktopPreview(getDesktopUrl(banner));
    setMobilePreview(getMobileUrl(banner));
    setError('');
    setSuccessMessage('');
  };

  const validateForm = () => {
    const desktopMessage = validateImage(desktopFile, 'desktop', !isEditing);
    if (desktopMessage) return desktopMessage;

    const mobileMessage = validateImage(mobileFile, 'celular', !isEditing);
    if (mobileMessage) return mobileMessage;

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
      formData.append('ativo', principal ? 'true' : String(ativo));
      formData.append('principal', String(principal));

      if (desktopFile) formData.append('imagem_desktop', desktopFile);
      if (mobileFile) formData.append('imagem_mobile', mobileFile);

      const response = await fetch(isEditing ? `/api/admin/banners/${editingBanner?.id}` : '/api/admin/banners', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar banner.');
      }

      resetForm();
      setSuccessMessage(isEditing ? 'Banner atualizado com sucesso.' : 'Banner cadastrado com sucesso.');
      await fetchBanners();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar banner.');
    } finally {
      setSaving(false);
    }
  };

  const runBannerAction = async (banner: Banner, action: Exclude<BannerAction, null>) => {
    if (busyBanner) return;

    if (action === 'delete') {
      const confirmed = window.confirm(`Excluir o banner "${banner.titulo || 'Banner sem titulo'}"? Esta acao remove o registro e as imagens do Storage.`);
      if (!confirmed) return;
    }

    setBusyBanner({ id: banner.id, action });
    setError('');
    setSuccessMessage('');

    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/banners/${banner.id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(action !== 'delete' ? { 'Content-Type': 'application/json' } : {}),
        },
        body: action === 'delete' ? undefined : JSON.stringify({ action: action === 'toggle' ? 'toggleActive' : 'setPrincipal' }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao atualizar banner.');
      }

      if (editingBanner?.id === banner.id && action === 'delete') {
        resetForm();
      }

      const messages = {
        principal: 'Banner definido como principal.',
        toggle: banner.ativo ? 'Banner inativado.' : 'Banner ativado.',
        delete: 'Banner excluido com sucesso.',
      };
      setSuccessMessage(messages[action]);
      await fetchBanners();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao atualizar banner.');
    } finally {
      setBusyBanner(null);
    }
  };

  const primaryInputClass =
    'w-full rounded-lg border border-[#E7E0D8] bg-white px-4 py-3 text-sm text-[#241C17] outline-none transition focus:border-[#C8722C] focus:ring-2 focus:ring-[rgba(200,114,44,0.18)]';

  return (
    <AdminShell title="Banners" subtitle="Gerencie banners desktop e celular da vitrine." active="banners">
      <div className="space-y-5">
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-lg border border-[#E7E0D8] bg-white p-5 shadow-[0_10px_24px_rgba(74,45,26,0.06)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#241C17]">{formTitle}</h2>
                <p className="mt-1 text-sm text-[#6E625A]">Envie imagens separadas para desktop e celular.</p>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-[#E7E0D8] px-3 py-2 text-xs font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                >
                  Cancelar
                </button>
              )}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">Titulo</span>
              <input
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                className={primaryInputClass}
                placeholder="Ex.: Colecao Country"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">Banner desktop</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setDesktopImage(event.target.files?.[0] ?? null)}
                className={primaryInputClass}
              />
            </label>

            <div className="relative mt-3 aspect-[16/7] overflow-hidden rounded-lg border border-[#E7E0D8] bg-[#F7F0E7]">
              {desktopPreview ? (
                <Image
                  src={desktopPreview}
                  alt="Previa desktop"
                  fill
                  sizes="(min-width: 1280px) 420px, 100vw"
                  unoptimized={desktopPreview.startsWith('blob:')}
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-medium text-[#6E625A]">
                  Previa desktop
                </div>
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">Banner celular</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setMobileImage(event.target.files?.[0] ?? null)}
                className={primaryInputClass}
              />
            </label>

            <div className="relative mt-3 aspect-[9/12] max-h-[360px] overflow-hidden rounded-lg border border-[#E7E0D8] bg-[#F7F0E7] sm:aspect-[4/5]">
              {mobilePreview ? (
                <Image
                  src={mobilePreview}
                  alt="Previa celular"
                  fill
                  sizes="(min-width: 1280px) 420px, 100vw"
                  unoptimized={mobilePreview.startsWith('blob:')}
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-medium text-[#6E625A]">
                  Previa celular
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3">
                <span className="text-sm font-bold text-[#4A2D1A]">Ativo</span>
                <input
                  type="checkbox"
                  checked={principal || ativo}
                  disabled={principal}
                  onChange={(event) => setAtivo(event.target.checked)}
                  className="h-5 w-5 accent-[#C8722C]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3">
                <span className="text-sm font-bold text-[#4A2D1A]">Principal</span>
                <input
                  type="checkbox"
                  checked={principal}
                  onChange={(event) => {
                    setPrincipal(event.target.checked);
                    if (event.target.checked) setAtivo(true);
                  }}
                  className="h-5 w-5 accent-[#C8722C]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full rounded-lg bg-[#C8722C] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(200,114,44,0.2)] transition hover:bg-[#9F5520] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </form>

          <section className="overflow-hidden rounded-lg border border-[#E7E0D8] bg-white shadow-[0_10px_24px_rgba(74,45,26,0.06)]">
            <div className="border-b border-[#E7E0D8] px-5 py-4 sm:px-6">
              <h2 className="text-2xl font-bold text-[#241C17]">Banners cadastrados</h2>
            </div>

            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-[#6E625A]">Carregando banners...</div>
            ) : banners.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#6E625A]">Nenhum banner cadastrado.</div>
            ) : (
              <div className="divide-y divide-[#EFE7DD]">
                {banners.map((banner) => {
                  const desktopUrl = getDesktopUrl(banner);
                  const mobileUrl = getMobileUrl(banner);
                  const currentAction = busyBanner?.id === banner.id ? busyBanner.action : null;

                  return (
                    <article key={banner.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[220px_1fr] xl:grid-cols-[260px_1fr_auto]">
                      <div className="grid grid-cols-[1fr_88px] gap-3">
                        <div>
                          <p className="mb-1 text-xs font-bold uppercase text-[#6E625A]">Desktop</p>
                          <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-[#F7F0E7]">
                            <Image
                              src={desktopUrl}
                              alt={banner.titulo || 'Banner desktop'}
                              fill
                              sizes="(min-width: 1280px) 180px, 60vw"
                              className="object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-bold uppercase text-[#6E625A]">Celular</p>
                          <div className="relative aspect-[9/12] overflow-hidden rounded-lg bg-[#F7F0E7]">
                            <Image
                              src={mobileUrl}
                              alt={banner.titulo || 'Banner celular'}
                              fill
                              sizes="88px"
                              className="object-cover"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-[#241C17]">{banner.titulo || 'Banner sem titulo'}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${banner.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-[#EFE7DD] text-[#6E625A]'}`}>
                            {banner.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          {banner.principal && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                              Principal
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:w-[340px]">
                        <button
                          type="button"
                          onClick={() => startEditing(banner)}
                          className="rounded-lg border border-[#E7E0D8] px-4 py-2 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => runBannerAction(banner, 'toggle')}
                          disabled={(banner.principal && banner.ativo) || Boolean(currentAction)}
                          className="rounded-lg border border-[#E7E0D8] px-4 py-2 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {currentAction === 'toggle' ? 'Alterando...' : banner.ativo ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => runBannerAction(banner, 'principal')}
                          disabled={(banner.principal && banner.ativo) || Boolean(currentAction)}
                          className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#C8722C] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {currentAction === 'principal' ? 'Definindo...' : 'Definir principal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => runBannerAction(banner, 'delete')}
                          disabled={Boolean(currentAction)}
                          className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {currentAction === 'delete' ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
