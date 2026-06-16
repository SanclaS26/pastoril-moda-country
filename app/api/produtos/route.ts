import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('produtos')
      .select('id, codigo_produto, nome, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, destaque')
      .eq('ativo', true)
      .order('destaque', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      return NextResponse.json({ error: `Erro ao listar produtos: ${error.message}` }, { status: 500 });
    }

    const products = data ?? [];

    if (!products.length) {
      return NextResponse.json({ products: [] });
    }

    const { data: stock, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('*')
      .in('produto_id', products.map((product) => product.id))
      .gt('quantidade', 0)
      .order('id', { ascending: true });

    if (stockError) {
      return NextResponse.json({ error: `Erro ao listar estoque: ${stockError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      products: products.map((product) => ({
        ...product,
        estoque: (stock ?? []).filter((item) => item.produto_id === product.id),
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao carregar produtos.' }, { status: 500 });
  }
}
