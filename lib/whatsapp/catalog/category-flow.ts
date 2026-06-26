import { departamentosProduto } from '@/config/grades-tamanho';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const FEATURED_PRODUCTS_PAGE_SIZE = 200;

const DEPARTMENT_ALIASES: Record<string, string> = {
  acessorio: 'Bolsas',
  acessorios: 'Bolsas',
  bota: 'Botas',
  botas: 'Botas',
  botina: 'Botinas',
  botinas: 'Botinas',
  bolsa: 'Bolsas',
  bolsas: 'Bolsas',
  bone: 'Bonés',
  bones: 'Bonés',
  cachecol: 'Lenços',
  cachecois: 'Lenços',
  calcado: 'Botas',
  calcados: 'Botas',
  calca: 'Calças',
  calcas: 'Calças',
  camisa: 'Camisas',
  camisas: 'Camisas',
  cinto: 'Cintos',
  cintos: 'Cintos',
  chapeu: 'Chapéus',
  chapeus: 'Chapéus',
  fivela: 'Fivelas',
  fivelas: 'Fivelas',
  lenco: 'Lenços',
  lencos: 'Lenços',
  saia: 'Saias',
  saias: 'Saias',
  sandalia: 'Sandálias',
  sandalias: 'Sandálias',
  tenis: 'Tênis',
  vestido: 'Vestidos',
  vestidos: 'Vestidos',
};

type ProdutoRow = {
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
  publico: string | null;
};

type StockRow = {
  produto_id: number;
  quantidade: number;
  tamanho: string;
};

export type WhatsAppCatalogProduct = {
  categoria: string | null;
  codigoProduto: string;
  departamento: string | null;
  descricao: string | null;
  emPromocao: boolean;
  estoqueDisponivel: Array<{
    quantidade: number;
    tamanho: string;
  }>;
  id: number;
  imagemPrincipal: string;
  nome: string;
  preco: number;
  precoPromocional: number | null;
  publico: string | null;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapDepartmentAliases() {
  const map = new Map<string, string>();

  for (const department of departamentosProduto) {
    map.set(normalizeText(department), department);
  }

  for (const [alias, department] of Object.entries(DEPARTMENT_ALIASES)) {
    map.set(normalizeText(alias), department);
  }

  return map;
}

const DEPARTMENT_ALIAS_MAP = mapDepartmentAliases();

function isValidPublicImageUrl(imageUrl: string | null) {
  if (!imageUrl) return false;

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function mapProductsWithStock(products: ProdutoRow[], stockRows: StockRow[]) {
  const stockByProduct = new Map<number, Array<{ quantidade: number; tamanho: string }>>();

  for (const stock of stockRows) {
    if (stock.quantidade <= 0) {
      continue;
    }

    const current = stockByProduct.get(stock.produto_id) ?? [];
    current.push({ quantidade: stock.quantidade, tamanho: stock.tamanho });
    stockByProduct.set(stock.produto_id, current);
  }

  return products
    .filter((product) => isValidPublicImageUrl(product.imagem_principal))
    .map((product) => {
      const estoqueDisponivel = stockByProduct.get(product.id) ?? [];

      return {
        categoria: product.categoria,
        codigoProduto: product.codigo_produto,
        departamento: product.departamento,
        descricao: product.descricao,
        emPromocao: product.em_promocao,
        estoqueDisponivel,
        id: product.id,
        imagemPrincipal: product.imagem_principal ?? '',
        nome: product.nome,
        preco: product.preco,
        precoPromocional: product.preco_promocional,
        publico: product.publico,
      } satisfies WhatsAppCatalogProduct;
    })
    .filter((product) => product.estoqueDisponivel.length > 0);
}

export function detectDepartmentFromMessage(text: string) {
  const normalized = normalizeText(text);
  const tokens = normalized.split(' ').filter(Boolean);

  for (const size of [3, 2, 1]) {
    for (let index = 0; index + size <= tokens.length; index += 1) {
      const candidate = tokens.slice(index, index + size).join(' ');
      const matched = DEPARTMENT_ALIAS_MAP.get(candidate);

      if (matched) {
        return matched;
      }
    }
  }

  return null;
}

export function extractProductPositionFromMessage(text: string) {
  const normalized = text
    .normalize('NFKC')
    .trim();

  const match = normalized.match(/\d+/);

  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export async function getFeaturedProductsByDepartment(department: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const allProducts: ProdutoRow[] = [];
  let pageStart = 0;

  while (true) {
    const pageEnd = pageStart + FEATURED_PRODUCTS_PAGE_SIZE - 1;

    const { data: products, error: productsError } = await supabaseAdmin
      .from('produtos')
      .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, publico, destaque, ativo')
      .eq('ativo', true)
      .eq('destaque', true)
      .eq('departamento', department)
      .order('id', { ascending: false })
      .range(pageStart, pageEnd);

    if (productsError) {
      throw productsError;
    }

    const pageProducts = (products ?? []) as ProdutoRow[];
    if (!pageProducts.length) {
      break;
    }

    allProducts.push(...pageProducts);

    if (pageProducts.length < FEATURED_PRODUCTS_PAGE_SIZE) {
      break;
    }

    pageStart += FEATURED_PRODUCTS_PAGE_SIZE;
  }

  const dedupedProducts = Array.from(new Map(allProducts.map((product) => [product.id, product])).values());
  if (!dedupedProducts.length) {
    return [];
  }

  const { data: stockRows, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('produto_id, tamanho, quantidade')
    .in('produto_id', dedupedProducts.map((product) => product.id))
    .gt('quantidade', 0);

  if (stockError) {
    throw stockError;
  }

  return mapProductsWithStock(dedupedProducts, (stockRows ?? []) as StockRow[]);
}

export async function getProductByCode(productCode: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const normalizedCode = productCode
    .normalize('NFKC')
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  let { data: product, error: productError } = await supabaseAdmin
    .from('produtos')
    .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, publico, destaque, ativo')
    .eq('ativo', true)
    .eq('codigo_produto', normalizedCode)
    .maybeSingle<ProdutoRow>();

  if (productError) {
    throw productError;
  }

  if (!product) {
    const fallback = await supabaseAdmin
      .from('produtos')
      .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, publico, destaque, ativo')
      .eq('ativo', true)
      .ilike('codigo_produto', normalizedCode)
      .limit(1)
      .maybeSingle<ProdutoRow>();

    product = fallback.data ?? null;
    productError = fallback.error;

    if (productError) {
      throw productError;
    }
  }

  if (!product || !product.imagem_principal) {
    return null;
  }

  const { data: stockRows, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('produto_id, tamanho, quantidade')
    .eq('produto_id', product.id)
    .gt('quantidade', 0)
    .order('id', { ascending: true });

  if (stockError) {
    throw stockError;
  }

  const mapped = mapProductsWithStock([product], (stockRows ?? []) as StockRow[]);
  return mapped[0] ?? null;
}

export async function getProductById(productId: number) {
  if (!Number.isInteger(productId) || productId <= 0) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: product, error: productError } = await supabaseAdmin
    .from('produtos')
    .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, publico, destaque, ativo')
    .eq('ativo', true)
    .eq('id', productId)
    .maybeSingle<ProdutoRow>();

  if (productError) {
    throw productError;
  }

  if (!product || !product.imagem_principal) {
    return null;
  }

  const { data: stockRows, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('produto_id, tamanho, quantidade')
    .eq('produto_id', product.id)
    .gt('quantidade', 0)
    .order('id', { ascending: true });

  if (stockError) {
    throw stockError;
  }

  const mapped = mapProductsWithStock([product], (stockRows ?? []) as StockRow[]);
  return mapped[0] ?? null;
}