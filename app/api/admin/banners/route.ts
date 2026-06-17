import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { type BannerInsert } from '@/lib/supabase-admin';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const BUCKET = 'banners';
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

type SupabaseAdmin = NonNullable<Awaited<ReturnType<typeof requireActiveAdmin>>['supabaseAdmin']>;

function parseBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return value === 'true' || value === '1' || value === 'on';
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateImage(file: File | null, label: string) {
  if (!file || file.size === 0) {
    throw new Error(`Selecione a imagem ${label} do banner.`);
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

function isMissingResponsiveColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';

  return code === '42703' && /imagem_(desktop|mobile)_(url|path)/.test(message);
}

async function ensureBucket(supabaseAdmin: SupabaseAdmin) {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw new Error(`Erro ao verificar bucket de banners: ${listError.message}`);
  }

  if (buckets.some((bucket) => bucket.name === BUCKET)) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true });

  if (createError) {
    throw new Error(`Erro ao criar bucket de banners: ${createError.message}`);
  }
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

async function clearPreviousPrincipal(supabaseAdmin: SupabaseAdmin) {
  const { error } = await supabaseAdmin.from('banners').update({ principal: false }).eq('principal', true);

  if (error) {
    throw new Error(`Erro ao remover banner principal anterior: ${error.message}`);
  }
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { data, error } = await authorization.supabaseAdmin
      .from('banners')
      .select('*')
      .order('principal', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      return NextResponse.json({ error: `Erro ao listar banners: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ banners: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao listar banners.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { supabaseAdmin } = authorization;
  const uploadedPaths: string[] = [];

  try {
    await ensureBucket(supabaseAdmin);

    const formData = await request.formData();
    const titulo = parseOptionalString(formData.get('titulo'));
    const principal = parseBoolean(formData.get('principal'), false);
    const ativo = principal ? true : parseBoolean(formData.get('ativo'), true);
    const desktopFile = formData.get('imagem_desktop');
    const mobileFile = formData.get('imagem_mobile');
    const desktopImage = desktopFile instanceof File ? desktopFile : null;
    const mobileImage = mobileFile instanceof File ? mobileFile : null;
    const desktopExtension = validateImage(desktopImage, 'desktop');
    const mobileExtension = validateImage(mobileImage, 'celular');
    const baseName = sanitizeFileName(titulo || 'banner');

    const desktop = await uploadBannerImage(supabaseAdmin, desktopImage as File, 'desktop', baseName, desktopExtension);
    uploadedPaths.push(desktop.path);
    const mobile = await uploadBannerImage(supabaseAdmin, mobileImage as File, 'mobile', baseName, mobileExtension);
    uploadedPaths.push(mobile.path);

    if (principal) {
      await clearPreviousPrincipal(supabaseAdmin);
    }

    const payload: BannerInsert = {
      titulo,
      imagem_url: desktop.url,
      imagem_path: desktop.path,
      imagem_desktop_url: desktop.url,
      imagem_desktop_path: desktop.path,
      imagem_mobile_url: mobile.url,
      imagem_mobile_path: mobile.path,
      ativo,
      principal,
    };

    let usedLegacyColumns = false;
    let { data: banner, error: insertError } = await supabaseAdmin
      .from('banners')
      .insert([payload])
      .select('*')
      .single();

    if (isMissingResponsiveColumnError(insertError)) {
      usedLegacyColumns = true;
      const legacyPayload: BannerInsert = {
        titulo,
        imagem_url: desktop.url,
        imagem_path: desktop.path,
        ativo,
        principal,
      };
      const legacyResult = await supabaseAdmin
        .from('banners')
        .insert([legacyPayload])
        .select('*')
        .single();

      banner = legacyResult.data;
      insertError = legacyResult.error;
    }

    if (insertError || !banner) {
      throw new Error(`Erro ao salvar banner no banco: ${insertError?.message ?? 'banner nao retornado.'}`);
    }

    if (usedLegacyColumns && mobile.path !== desktop.path) {
      await supabaseAdmin.storage.from(BUCKET).remove([mobile.path]);
    }

    revalidatePath('/');
    revalidatePath('/admin/banners');

    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    if (uploadedPaths.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar banner.' }, { status: 500 });
  }
}
