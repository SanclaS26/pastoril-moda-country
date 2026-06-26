import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CatalogQueryError, type CatalogProductSanitized, type CatalogStockItem, type GetProductDetailsInput, type GetProductDetailsResult } from '@/lib/whatsapp/catalog/types';

function normalizeSize(value: string | undefined) {
  if (!value) return null;

  const normalized = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
    .toUpperCase();

  return normalized || null;
}

type ProdutoDetailsRow = {
  ativo: boolean;
  categoria: string | null;
  codigo_produto: string;
  departamento: string | null;
  descricao: string | null;
  em_promocao: boolean;
  id: number;
  imagem_principal: string | null;
  nome: string;
  preco: number;
  preco_promocional: number | null;
};

type StockRow = {
  quantidade: number;
  tamanho: string;
};

function mapProduct(product: ProdutoDetailsRow, stockItems: CatalogStockItem[]): CatalogProductSanitized {
  const inStock = stockItems.filter((item) => item.quantidade > 0);

  return {
    categoria: product.categoria ?? null,
    codigo_produto: product.codigo_produto,
    departamento: product.departamento ?? null,
    descricao_curta: product.descricao ? product.descricao.slice(0, 280) : null,
    em_promocao: product.em_promocao,
    estoque_por_tamanho: stockItems,
    id: product.id,
    imagem_principal: product.imagem_principal,
    nome: product.nome,
    preco: product.preco,
    preco_promocional: product.preco_promocional,
    tamanhos_disponiveis: inStock.map((item) => item.tamanho),
  };
}

export async function getProductDetails(input: GetProductDetailsInput): Promise<GetProductDetailsResult> {
  const productId = Number(input.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return { product: null };
  }

  const size = normalizeSize(input.size);
  const inStockOnly = input.inStockOnly === true;

  const supabaseAdmin = getSupabaseAdmin();

  const { data: product, error: productError } = await supabaseAdmin
    .from('produtos')
    .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, ativo')
    .eq('id', productId)
    .eq('ativo', true)
    .maybeSingle();

  if (productError) {
    throw new CatalogQueryError('Falha ao consultar produto no catalogo.');
  }

  if (!product) {
    return { product: null };
  }

  const { data: stockRows, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('tamanho, quantidade')
    .eq('produto_id', product.id)
    .order('id', { ascending: true });

  if (stockError) {
    throw new CatalogQueryError('Falha ao consultar estoque do produto.');
  }

  const stock = ((stockRows ?? []) as StockRow[])
    .filter((item) => (size ? item.tamanho.toUpperCase() === size : true))
    .filter((item) => (inStockOnly ? item.quantidade > 0 : true));

  return {
    product: mapProduct(product as ProdutoDetailsRow, stock),
  };
}
