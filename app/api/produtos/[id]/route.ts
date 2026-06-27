import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseProductId(value: string) {
  const productId = Number(value);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Produto invalido.');
  }

  return productId;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const productId = parseProductId(id);
    const supabaseAdmin = getSupabaseAdmin();

    const { data: product, error: productError } = await supabaseAdmin
      .from('produtos')
      .select('id, codigo_produto, nome, preco, preco_promocional, em_promocao, descricao, imagem_principal, categoria_id, categoria, departamento_id, departamento, publico, ativo, destaque')
      .eq('id', productId)
      .eq('ativo', true)
      .maybeSingle();

    if (productError) {
      return NextResponse.json({ error: `Erro ao buscar produto: ${productError.message}` }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ error: 'Produto nao encontrado.' }, { status: 404 });
    }

    const { data: stock, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('*')
      .eq('produto_id', product.id)
      .order('id', { ascending: true });

    if (stockError) {
      return NextResponse.json({ error: `Erro ao buscar estoque: ${stockError.message}` }, { status: 500 });
    }

    const { data: images, error: imagesError } = await supabaseAdmin
      .from('produto_imagens')
      .select('id, url, ordem, principal, tipo_midia')
      .eq('produto_id', product.id)
      .order('ordem', { ascending: true });

    if (imagesError) {
      return NextResponse.json({ error: `Erro ao buscar galeria: ${imagesError.message}` }, { status: 500 });
    }

    const { data: category, error: categoryError } = product.categoria_id
      ? await supabaseAdmin.from('categorias').select('tipo_grade').eq('id', product.categoria_id).maybeSingle()
      : { data: null, error: null };

    if (categoryError) {
      return NextResponse.json({ error: `Erro ao buscar categoria: ${categoryError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      product: {
        ...product,
        tipo_grade: category?.tipo_grade,
        estoque: stock ?? [],
        imagens: images ?? [],
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar produto.' }, { status: 500 });
  }
}
