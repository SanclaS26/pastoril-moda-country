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

function parseBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return value === 'true' || value === '1' || value === 'on';
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateImage(file: File | null) {
  if (!file || file.size === 0) {
    throw new Error('Selecione uma imagem para o banner.');
  }

  const extension = ALLOWED_IMAGE_TYPES.get(file.type);

  if (!extension) {
    throw new Error('A imagem deve ser JPG, PNG ou WebP.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
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

async function ensureBucket(supabaseAdmin: Awaited<ReturnType<typeof requireActiveAdmin>>['supabaseAdmin']) {
  if (!supabaseAdmin) return;

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
  let uploadedPath: string | null = null;

  try {
    await ensureBucket(supabaseAdmin);

    const formData = await request.formData();
    const titulo = parseOptionalString(formData.get('titulo'));
    const principal = parseBoolean(formData.get('principal'), true);
    const ativo = principal ? true : parseBoolean(formData.get('ativo'), true);
    const imageFile = formData.get('imagem');
    const image = imageFile instanceof File ? imageFile : null;
    const extension = validateImage(image);
    const fileName = `${sanitizeFileName(titulo || 'banner-principal')}-${crypto.randomUUID()}.${extension}`;

    uploadedPath = `principal/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(uploadedPath, image as File, {
        contentType: image?.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Erro ao enviar imagem do banner: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(uploadedPath);

    const { data: previousPrincipal } = principal
      ? await supabaseAdmin.from('banners').select('id').eq('ativo', true).eq('principal', true).maybeSingle()
      : { data: null };

    const payload: BannerInsert = {
      titulo,
      imagem_url: publicUrlData.publicUrl,
      imagem_path: uploadedPath,
      ativo,
      principal: false,
    };

    const { data: banner, error: insertError } = await supabaseAdmin
      .from('banners')
      .insert([payload])
      .select('*')
      .single();

    if (insertError || !banner) {
      await supabaseAdmin.storage.from(BUCKET).remove([uploadedPath]);
      return NextResponse.json(
        { error: `Erro ao salvar banner no banco: ${insertError?.message ?? 'banner não retornado.'}` },
        { status: 500 },
      );
    }

    if (principal) {
      const { error: clearPrincipalError } = await supabaseAdmin
        .from('banners')
        .update({ principal: false })
        .eq('principal', true);

      if (clearPrincipalError) {
        await supabaseAdmin.storage.from(BUCKET).remove([uploadedPath]);
        await supabaseAdmin.from('banners').delete().eq('id', banner.id);
        return NextResponse.json(
          { error: `Erro ao substituir banner principal anterior: ${clearPrincipalError.message}` },
          { status: 500 },
        );
      }

      const { data: principalBanner, error: principalError } = await supabaseAdmin
        .from('banners')
        .update({ principal: true, ativo: true })
        .eq('id', banner.id)
        .select('*')
        .single();

      if (principalError || !principalBanner) {
        if (previousPrincipal?.id) {
          await supabaseAdmin.from('banners').update({ principal: true, ativo: true }).eq('id', previousPrincipal.id);
        }

        await supabaseAdmin.storage.from(BUCKET).remove([uploadedPath]);
        await supabaseAdmin.from('banners').delete().eq('id', banner.id);
        return NextResponse.json(
          { error: `Erro ao ativar novo banner principal: ${principalError?.message ?? 'banner não retornado.'}` },
          { status: 500 },
        );
      }

      revalidatePath('/');
      revalidatePath('/admin/banners');

      return NextResponse.json({ banner: principalBanner }, { status: 201 });
    }

    revalidatePath('/');
    revalidatePath('/admin/banners');

    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      await supabaseAdmin.storage.from(BUCKET).remove([uploadedPath]);
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar banner.' }, { status: 500 });
  }
}
