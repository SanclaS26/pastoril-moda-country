import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseBannerId(value: string) {
  const bannerId = Number(value);

  if (!Number.isInteger(bannerId) || bannerId <= 0) {
    throw new Error('Banner inválido.');
  }

  return bannerId;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { id } = await context.params;
    const bannerId = parseBannerId(id);
    const { supabaseAdmin } = authorization;

    const { data: existingBanner, error: existingError } = await supabaseAdmin
      .from('banners')
      .select('id')
      .eq('id', bannerId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: `Erro ao buscar banner: ${existingError.message}` }, { status: 500 });
    }

    if (!existingBanner) {
      return NextResponse.json({ error: 'Banner não encontrado.' }, { status: 404 });
    }

    const { error: clearPrincipalError } = await supabaseAdmin
      .from('banners')
      .update({ principal: false })
      .eq('principal', true);

    if (clearPrincipalError) {
      return NextResponse.json(
        { error: `Erro ao remover banner principal anterior: ${clearPrincipalError.message}` },
        { status: 500 },
      );
    }

    const { data: banner, error: updateError } = await supabaseAdmin
      .from('banners')
      .update({ principal: true, ativo: true })
      .eq('id', bannerId)
      .select('*')
      .single();

    if (updateError || !banner) {
      return NextResponse.json(
        { error: `Erro ao definir banner principal: ${updateError?.message ?? 'banner não retornado.'}` },
        { status: 500 },
      );
    }

    revalidatePath('/');
    revalidatePath('/admin/banners');

    return NextResponse.json({ banner });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar banner.' }, { status: 500 });
  }
}
