import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CatalogQueryError, type CatalogProductSanitized, type CatalogStockItem, type SearchProductsInput, type SearchProductsResult } from '@/lib/whatsapp/catalog/types';

const MAX_RESULTS = 8;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 60;
const FETCH_BATCH_SIZE = 40;

function normalizeText(value: string | undefined, maxLength: number) {
  if (!value) return null;

  const normalized = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  return normalized || null;
}

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

function normalizeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 5;

  const normalized = Number(value);
  return Math.max(1, Math.min(MAX_RESULTS, Math.trunc(normalized)));
}

function normalizeIlikePattern(value: string) {
  const token = value.replace(/[%_]/g, '').replace(/\s+/g, '%');
  return `%${token}%`;
}

function buildStockMap(stockRows: CatalogStockItemWithProductId[]) {
  return stockRows.reduce<Map<number, CatalogStockItem[]>>((accumulator, item) => {
    const current = accumulator.get(item.produto_id) ?? [];

    current.push({
      quantidade: item.quantidade,
      tamanho: item.tamanho,
    });

    accumulator.set(item.produto_id, current);
    return accumulator;
  }, new Map<number, CatalogStockItem[]>());
}

function mapProduct(product: ProdutoSearchRow, stockItems: CatalogStockItem[]): CatalogProductSanitized {
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

function scoreProduct(product: CatalogProductSanitized, query: string | null) {
  if (!query) return 0;

  const normalizedQuery = query.toLowerCase();
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const name = product.nome.toLowerCase();
  const code = product.codigo_produto.toLowerCase();
  const description = (product.descricao_curta ?? '').toLowerCase();

  let score = 0;

  if (name.includes(normalizedQuery)) score += 30;
  if (code.includes(normalizedQuery)) score += 20;
  if (description.includes(normalizedQuery)) score += 10;

  for (const token of queryTokens) {
    if (name.includes(token)) score += 8;
    if (code.includes(token)) score += 5;
    if (description.includes(token)) score += 3;
  }

  return score;
}

type ProdutoSearchRow = {
  ativo: boolean;
  categoria: string | null;
  codigo_produto: string;
  departamento: string | null;
  descricao: string | null;
  destaque: boolean;
  em_promocao: boolean;
  id: number;
  imagem_principal: string | null;
  nome: string;
  preco: number;
  preco_promocional: number | null;
};

type CatalogStockItemWithProductId = {
  produto_id: number;
  quantidade: number;
  tamanho: string;
};

export async function searchProducts(input: SearchProductsInput): Promise<SearchProductsResult> {
  const query = normalizeText(input.query, MAX_QUERY_LENGTH);
  const category = normalizeText(input.category, MAX_FILTER_LENGTH);
  const department = normalizeText(input.department, MAX_FILTER_LENGTH);
  const size = normalizeSize(input.size);
  const limit = normalizeLimit(input.limit);
  const inStockOnly = input.inStockOnly === true;

  if (!query && !category && !department) {
    return { products: [] };
  }

  const supabaseAdmin = getSupabaseAdmin();

  let productsQuery = supabaseAdmin
    .from('produtos')
    .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, destaque, ativo')
    .eq('ativo', true)
    .limit(FETCH_BATCH_SIZE)
    .order('destaque', { ascending: false })
    .order('id', { ascending: false });

  if (query) {
    const pattern = normalizeIlikePattern(query);
    productsQuery = productsQuery.or(`nome.ilike.${pattern},descricao.ilike.${pattern},codigo_produto.ilike.${pattern}`);
  }

  if (category) {
    productsQuery = productsQuery.ilike('categoria', normalizeIlikePattern(category));
  }

  if (department) {
    productsQuery = productsQuery.ilike('departamento', normalizeIlikePattern(department));
  }

  const { data: products, error: productsError } = await productsQuery;

  if (productsError) {
    throw new CatalogQueryError('Falha ao consultar produtos no catalogo.');
  }

  const productRows = (products ?? []) as ProdutoSearchRow[];

  if (!productRows.length) {
    return { products: [] };
  }

  const { data: stockRows, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('produto_id, tamanho, quantidade')
    .in('produto_id', productRows.map((product) => product.id));

  if (stockError) {
    throw new CatalogQueryError('Falha ao consultar estoque no catalogo.');
  }

  const stockMap = buildStockMap((stockRows ?? []) as CatalogStockItemWithProductId[]);

  const filtered = productRows
    .map((product) => {
      const rawStock = stockMap.get(product.id) ?? [];
      const sizeFilteredStock = size ? rawStock.filter((item) => item.tamanho.toUpperCase() === size) : rawStock;
      const effectiveStock = inStockOnly ? sizeFilteredStock.filter((item) => item.quantidade > 0) : sizeFilteredStock;

      return {
        product: mapProduct(product, effectiveStock),
        relevance: scoreProduct(mapProduct(product, effectiveStock), query),
      };
    })
    .filter(({ product }) => {
      if (size) {
        return product.estoque_por_tamanho.some((item) => item.quantidade > 0);
      }

      if (inStockOnly) {
        return product.estoque_por_tamanho.some((item) => item.quantidade > 0);
      }

      return true;
    })
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return b.product.id - a.product.id;
    })
    .slice(0, limit)
    .map(({ product }) => product);

  return { products: filtered };
}
