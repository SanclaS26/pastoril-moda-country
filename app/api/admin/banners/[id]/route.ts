import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { type BannerUpdate } from '@/lib/supabase-admin';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const BUCKET = 'banners';
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SupabaseAdmin = NonNullable<Awaited<ReturnType<typeof requireActiveAdmin>>['supabaseAdmin']>;
type BannerOperation = 'edit' | 'toggleActive' | 'setPrincipal' | 'delete';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBannerId(value: string) {
  const bannerId = decodeURIComponent(value || '').trim();

  if (!UUID_PATTERN.test(bannerId)) {
    throw new Error('Banner invalido.');
  }

  return bannerId;
}

function getSupabaseError(error: unknown) {
  if (!error || typeof error !== 'object') return null;

  return {
    code: 'code' in error ? error.code : undefined,
    message: 'message' in error ? error.message : undefined,
    details: 'details' in error ? error.details : undefined,
    hint: 'hint' in error ? error.hint : undefined,
  };
}

function logBannerApiError(operation: BannerOperation, id: string, error: unknown) {
  console.error('[admin/banners]', {
    operation,
    receivedId: id,
    receivedIdType: typeof id,
    supabaseError: getSupabaseError(error),
    error: error instanceof Error ? error.message : error,
  });
}

function isMissingResponsiveColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';

  return code === '42703' && /imagem_(desktop|mobile)_(url|path)/.test(message);
}

function parseBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return value === 'true' || value === '1' || value === 'on';
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateOptionalImage(file: File | null, label: string) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = ALLOWED_IMAGE_TYPES.get(file.type);

  if (!extension) {
    throw new Error(`A imagem ${label} deve ser JPG, PNG ou WebP.`);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`A imagem ${label} deve ter no maximo 5 MB.`);
  }

  return extension;
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function uniquePaths(paths: Array<string | null | undefined>) {
  return Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
}

async function getBannerOwnedStoragePaths(
  supabaseAdmin: SupabaseAdmin,
  bannerId: string,
  paths: string[],
) {
  if (paths.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('banners')
    .select('id, imagem_path, imagem_desktop_path, imagem_mobile_path')
    .neq('id', bannerId);

  if (error) {
    logBannerApiError('delete', bannerId, error);
    throw new Error(`Erro ao verificar imagens vinculadas a outros banners: ${error.message}`);
  }

  const pathsUsedByOtherBanners = new Set(
    (data ?? []).flatMap((banner) =>
      uniquePaths([
        banner.imagem_path,
        banner.imagem_desktop_path,
        banner.imagem_mobile_path,
      ]),
    ),
  );

  return paths.filter((path) => !pathsUsedByOtherBanners.has(path));
}

async function uploadBannerImage(
  supabaseAdmin: SupabaseAdmin,
  file: File,
  folder: 'desktop' | 'mobile',
  baseName: string,
  extension: string,
) {
  const path = `${folder}/${baseName}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    throw new Error(`Erro ao enviar imagem ${folder === 'desktop' ? 'desktop' : 'celular'}: ${uploadError.message}`);
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function getExistingBanner(supabaseAdmin: SupabaseAdmin, bannerId: string, operation: BannerOperation) {
  const { data: banner, error } = await supabaseAdmin.from('banners').select('*').eq('id', bannerId).maybeSingle();

  if (error) {
    logBannerApiError(operation, bannerId, error);
    throw new Error(`Erro ao buscar banner: ${error.message}`);
  }

  if (!banner) {
    throw new Error('Banner nao encontrado.');
  }

  return banner;
}

async function setPrincipal(supabaseAdmin: SupabaseAdmin, bannerId: string) {
  const existing = await getExistingBanner(supabaseAdmin, bannerId, 'setPrincipal');

  const { data: previousPrincipal } = await supabaseAdmin
    .from('banners')
    .select('id')
    .eq('principal', true)
    .maybeSingle();

  const { error: clearPrincipalError } = await supabaseAdmin
    .from('banners')
    .update({ principal: false })
    .eq('principal', true);

  if (clearPrincipalError) {
    logBannerApiError('setPrincipal', bannerId, clearPrincipalError);
    throw new Error(`Erro ao remover banner principal anterior: ${clearPrincipalError.message}`);
  }

  const { data: banner, error: updateError } = await supabaseAdmin
    .from('banners')
    .update({ principal: true, ativo: true })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (updateError || !banner) {
    logBannerApiError('setPrincipal', bannerId, updateError ?? new Error('banner nao retornado.'));

    if (previousPrincipal?.id) {
      await supabaseAdmin.from('banners').update({ principal: true, ativo: true }).eq('id', previousPrincipal.id);
    }

    throw new Error(`Erro ao definir banner principal: ${updateError?.message ?? 'banner nao retornado.'}`);
  }

  return banner;
}

async function toggleActive(supabaseAdmin: SupabaseAdmin, bannerId: string) {
  const existing = await getExistingBanner(supabaseAdmin, bannerId, 'toggleActive');

  if (existing.principal && existing.ativo) {
    throw new Error('O banner principal deve permanecer ativo. Defina outro principal antes de inativar este banner.');
  }

  const { data: banner, error } = await supabaseAdmin
    .from('banners')
    .update({ ativo: !existing.ativo })
    .eq('id', bannerId)
    .select('*')
    .single();

  if (error || !banner) {
    logBannerApiError('toggleActive', bannerId, error ?? new Error('banner nao retornado.'));
    throw new Error(`Erro ao alterar status do banner: ${error?.message ?? 'banner nao retornado.'}`);
  }

  return banner;
}

async function updateBanner(request: Request, supabaseAdmin: SupabaseAdmin, bannerId: string) {
  const existing = await getExistingBanner(supabaseAdmin, bannerId, 'edit');
  const formData = await request.formData();
  const titulo = parseOptionalString(formData.get('titulo'));
  const wantsPrincipal = parseBoolean(formData.get('principal'), existing.principal);
  const ativo = wantsPrincipal ? true : parseBoolean(formData.get('ativo'), existing.ativo);
  const desktopFile = formData.get('imagem_desktop');
  const mobileFile = formData.get('imagem_mobile');
  const desktopImage = desktopFile instanceof File ? desktopFile : null;
  const mobileImage = mobileFile instanceof File ? mobileFile : null;
  const desktopExtension = validateOptionalImage(desktopImage, 'desktop');
  const mobileExtension = validateOptionalImage(mobileImage, 'celular');
  const baseName = sanitizeFileName(titulo || existing.titulo || 'banner');
  const uploadedPaths: string[] = [];

  try {
    const desktop = desktopExtension
      ? await uploadBannerImage(supabaseAdmin, desktopImage as File, 'desktop', baseName, desktopExtension)
      : null;
    if (desktop) uploadedPaths.push(desktop.path);

    const mobile = mobileExtension
      ? await uploadBannerImage(supabaseAdmin, mobileImage as File, 'mobile', baseName, mobileExtension)
      : null;
    if (mobile) uploadedPaths.push(mobile.path);

    if (wantsPrincipal) {
      const { error: clearPrincipalError } = await supabaseAdmin
        .from('banners')
        .update({ principal: false })
        .eq('principal', true)
        .neq('id', bannerId);

      if (clearPrincipalError) {
        logBannerApiError('edit', bannerId, clearPrincipalError);
        throw new Error(`Erro ao remover banner principal anterior: ${clearPrincipalError.message}`);
      }
    }

    const currentDesktopUrl = existing.imagem_desktop_url || existing.imagem_url;
    const currentDesktopPath = existing.imagem_desktop_path || existing.imagem_path;
    const currentMobileUrl = existing.imagem_mobile_url || existing.imagem_url;
    const currentMobilePath = existing.imagem_mobile_path || existing.imagem_path;

    const payload: BannerUpdate = {
      titulo,
      ativo,
      principal: wantsPrincipal,
      imagem_url: desktop?.url ?? currentDesktopUrl,
      imagem_path: desktop?.path ?? currentDesktopPath,
      imagem_desktop_url: desktop?.url ?? currentDesktopUrl,
      imagem_desktop_path: desktop?.path ?? currentDesktopPath,
      imagem_mobile_url: mobile?.url ?? currentMobileUrl,
      imagem_mobile_path: mobile?.path ?? currentMobilePath,
    };

    let usedLegacyColumns = false;
    let { data: banner, error } = await supabaseAdmin
      .from('banners')
      .update(payload)
      .eq('id', bannerId)
      .select('*')
      .single();

    if (isMissingResponsiveColumnError(error)) {
      usedLegacyColumns = true;
      const legacyPayload: BannerUpdate = {
        titulo,
        ativo,
        principal: wantsPrincipal,
        imagem_url: payload.imagem_url,
        imagem_path: payload.imagem_path,
      };
      const legacyResult = await supabaseAdmin
        .from('banners')
        .update(legacyPayload)
        .eq('id', bannerId)
        .select('*')
        .single();

      banner = legacyResult.data;
      error = legacyResult.error;
    }

    if (error || !banner) {
      logBannerApiError('edit', bannerId, error ?? new Error('banner nao retornado.'));
      throw new Error(`Erro ao salvar banner: ${error?.message ?? 'banner nao retornado.'}`);
    }

    const retainedPaths = usedLegacyColumns
      ? uniquePaths([payload.imagem_path])
      : uniquePaths([payload.imagem_desktop_path, payload.imagem_mobile_path]);
    const candidatePathsToDelete = usedLegacyColumns
      ? uniquePaths([desktop ? currentDesktopPath : null, mobile?.path])
      : uniquePaths([
          desktop ? currentDesktopPath : null,
          mobile ? currentMobilePath : null,
        ]);
    const oldPathsToDelete = candidatePathsToDelete.filter((path) => !retainedPaths.includes(path));

    if (oldPathsToDelete.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(oldPathsToDelete);
    }

    return banner;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
    }

    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  let rawId = '';
  let operation: BannerOperation = 'setPrincipal';

  try {
    const { id } = await context.params;
    rawId = id;
    const { supabaseAdmin } = authorization;
    const contentType = request.headers.get('content-type') || '';
    let banner;

    if (contentType.includes('multipart/form-data')) {
      operation = 'edit';
      const bannerId = parseBannerId(id);
      banner = await updateBanner(request, supabaseAdmin, bannerId);
    } else if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => ({}))) as { action?: string };
      operation = body.action === 'toggleActive' ? 'toggleActive' : 'setPrincipal';
      const bannerId = parseBannerId(id);

      if (body.action === 'toggleActive') {
        banner = await toggleActive(supabaseAdmin, bannerId);
      } else {
        banner = await setPrincipal(supabaseAdmin, bannerId);
      }
    } else {
      const bannerId = parseBannerId(id);
      banner = await setPrincipal(supabaseAdmin, bannerId);
    }

    revalidatePath('/');
    revalidatePath('/admin/banners');

    return NextResponse.json({ banner });
  } catch (error) {
    logBannerApiError(operation, rawId, error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar banner.';
    const status = message.includes('nao encontrado') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  let rawId = '';

  try {
    const { id } = await context.params;
    rawId = id;
    const bannerId = parseBannerId(id);
    const { supabaseAdmin } = authorization;
    const existing = await getExistingBanner(supabaseAdmin, bannerId, 'delete');
    const candidatePathsToDelete = uniquePaths([
      existing.imagem_path,
      existing.imagem_desktop_path,
      existing.imagem_mobile_path,
    ]);
    const pathsToDelete = await getBannerOwnedStoragePaths(supabaseAdmin, bannerId, candidatePathsToDelete);

    const { error: deleteError } = await supabaseAdmin.from('banners').delete().eq('id', bannerId);

    if (deleteError) {
      logBannerApiError('delete', bannerId, deleteError);
      throw new Error(`Erro ao excluir banner: ${deleteError.message}`);
    }

    if (pathsToDelete.length) {
      const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove(pathsToDelete);

      if (storageError) {
        logBannerApiError('delete', bannerId, storageError);
        throw new Error(`Banner excluido, mas houve erro ao remover imagens do Storage: ${storageError.message}`);
      }
    }

    revalidatePath('/');
    revalidatePath('/admin/banners');

    return NextResponse.json({ ok: true });
  } catch (error) {
    logBannerApiError('delete', rawId, error);
    const message = error instanceof Error ? error.message : 'Erro ao excluir banner.';
    const status = message.includes('nao encontrado') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
