import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { departamentosProduto } from '@/config/grades-tamanho';
import { CatalogQueryError, type CatalogProductSanitized, type CatalogStockItem, type SearchProductsInput, type SearchProductsResult } from '@/lib/whatsapp/catalog/types';

const MAX_RESULTS = 8;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 60;
const FETCH_BATCH_SIZE = 120;

const STOP_WORDS = new Set([
  'a',
  'as',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'o',
  'os',
  'por',
  'pra',
  'para',
  'qual',
  'quais',
  'que',
  'tem',
  'tenho',
  'ter',
  'têm',
  'temos',
  'voces',
  'voce',
]);

const TERM_ALIASES: Record<string, string> = {
  acessorio: 'acessorio',
  acessorios: 'acessorio',
  bota: 'bota',
  botas: 'bota',
  botina: 'bota',
  botinas: 'bota',
  calcas: 'calca',
  calca: 'calca',
  camisas: 'camisa',
  camisa: 'camisa',
  camisetas: 'camiseta',
  camiseta: 'camiseta',
  texana: 'bota',
  texanas: 'bota',
  feminina: 'feminino',
  femininas: 'feminino',
  feminino: 'feminino',
  masculina: 'masculino',
  masculinas: 'masculino',
  masculino: 'masculino',
  infantil: 'infantil',
  unissex: 'unissex',
};

const TERM_VARIANTS: Record<string, string[]> = {
  acessorio: ['acessorio'],
  bota: ['bota', 'botina', 'texana'],
  calca: ['calca'],
  camisa: ['camisa'],
  camiseta: ['camiseta'],
};

const DEPARTMENT_GROUPS: Record<string, string[]> = {
  acessorio: ['Bolsas', 'Bonés', 'Bijuterias', 'Carteiras', 'Chapéus', 'Cintos', 'Fivelas', 'Lenços'],
  bota: ['Botas', 'Botinas'],
  calca: ['Calças'],
  camisa: ['Camisas'],
  camiseta: ['Camisas'],
};

const PUBLIC_FILTERS: Record<string, 'Feminino' | 'Masculino' | 'Infantil' | 'Unissex'> = {
  feminino: 'Feminino',
  infantil: 'Infantil',
  masculino: 'Masculino',
  unissex: 'Unissex',
};

const DEPARTMENT_INDEX = buildDepartmentIndex();

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

function normalizeForSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeToken(token: string) {
  if (TERM_ALIASES[token]) {
    return TERM_ALIASES[token];
  }

  if (token.endsWith('s') && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function tokenizeNormalizedText(value: string) {
  if (!value) return [];

  return value
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => singularizeToken(token))
    .filter((token) => token && !STOP_WORDS.has(token));
}

function buildDepartmentIndex() {
  return departamentosProduto.reduce<Record<string, string[]>>((accumulator, department) => {
    const normalizedDepartment = normalizeForSearch(department);
    const singularDepartment = singularizeToken(normalizedDepartment);

    accumulator[normalizedDepartment] = [...(accumulator[normalizedDepartment] ?? []), department];
    accumulator[singularDepartment] = [...(accumulator[singularDepartment] ?? []), department];

    return accumulator;
  }, {});
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

type QueryAnalysis = {
  categoryTerms: string[];
  departmentCandidates: string[];
  filtersApplied: {
    department: boolean;
    publico: boolean;
  };
  normalizedQuery: string | null;
  publicFilter: 'Feminino' | 'Masculino' | 'Infantil' | 'Unissex' | null;
  textVariants: string[];
};

function analyzeSearchInput(query: string | null, category: string | null, department: string | null) {
  const normalizedQueryText = normalizeForSearch(query ?? '');
  const normalizedCategoryText = normalizeForSearch(category ?? '');
  const normalizedDepartmentText = normalizeForSearch(department ?? '');
  const tokens = uniqueStrings([
    ...tokenizeNormalizedText(normalizedQueryText),
    ...tokenizeNormalizedText(normalizedCategoryText),
    ...tokenizeNormalizedText(normalizedDepartmentText),
  ]);

  const publicToken = tokens.find((token) => token in PUBLIC_FILTERS) ?? null;
  const publicFilter = publicToken ? PUBLIC_FILTERS[publicToken] : null;
  const semanticTokens = tokens.filter((token) => !(token in PUBLIC_FILTERS));

  const departmentCandidates = uniqueStrings(
    semanticTokens.flatMap((token) => DEPARTMENT_GROUPS[token] ?? DEPARTMENT_INDEX[token] ?? []),
  );

  const textVariants = uniqueStrings(
    semanticTokens.flatMap((token) => TERM_VARIANTS[token] ?? [token]),
  );

  return {
    categoryTerms: uniqueStrings(semanticTokens),
    departmentCandidates,
    filtersApplied: {
      department: departmentCandidates.length > 0,
      publico: Boolean(publicFilter),
    },
    normalizedQuery: semanticTokens.join(' ') || null,
    publicFilter,
    textVariants,
  } satisfies QueryAnalysis;
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

function matchesAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function scoreProduct(product: CatalogProductSanitized, analysis: QueryAnalysis) {
  if (!analysis.normalizedQuery && analysis.textVariants.length === 0 && analysis.departmentCandidates.length === 0) return 0;

  const normalizedQuery = analysis.normalizedQuery;
  const queryTokens = normalizedQuery?.split(' ').filter(Boolean) ?? [];
  const name = normalizeForSearch(product.nome);
  const code = normalizeForSearch(product.codigo_produto);
  const description = normalizeForSearch(product.descricao_curta ?? '');
  const category = normalizeForSearch(product.categoria ?? '');
  const department = normalizeForSearch(product.departamento ?? '');

  let score = 0;

  if (normalizedQuery) {
    if (name.includes(normalizedQuery)) score += 30;
    if (code.includes(normalizedQuery)) score += 20;
    if (description.includes(normalizedQuery)) score += 10;
    if (category.includes(normalizedQuery)) score += 18;
    if (department.includes(normalizedQuery)) score += 24;
  }

  if (analysis.departmentCandidates.includes(product.departamento ?? '')) {
    score += 26;
  }

  if (matchesAnyTerm(name, analysis.textVariants)) score += 16;
  if (matchesAnyTerm(description, analysis.textVariants)) score += 8;
  if (matchesAnyTerm(category, analysis.textVariants)) score += 12;
  if (matchesAnyTerm(department, analysis.textVariants)) score += 18;

  for (const token of queryTokens) {
    if (name.includes(token)) score += 8;
    if (code.includes(token)) score += 5;
    if (description.includes(token)) score += 3;
    if (category.includes(token)) score += 4;
    if (department.includes(token)) score += 5;
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
  publico: string | null;
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
  const analysis = analyzeSearchInput(query, category, department);

  if (!query && !category && !department && !analysis.publicFilter) {
    return { products: [] };
  }

  const supabaseAdmin = getSupabaseAdmin();

  let productsQuery = supabaseAdmin
    .from('produtos')
    .select('id, codigo_produto, nome, descricao, preco, preco_promocional, em_promocao, imagem_principal, categoria, departamento, destaque, ativo, publico')
    .eq('ativo', true)
    .limit(FETCH_BATCH_SIZE)
    .order('destaque', { ascending: false })
    .order('id', { ascending: false });

  if (analysis.departmentCandidates.length > 0) {
    productsQuery = productsQuery.in('departamento', analysis.departmentCandidates);
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

  let removedByStock = 0;

  const filtered = productRows
    .map((product) => {
      const rawStock = stockMap.get(product.id) ?? [];
      const sizeFilteredStock = size ? rawStock.filter((item) => item.tamanho.toUpperCase() === size) : rawStock;
      const effectiveStock = inStockOnly ? sizeFilteredStock.filter((item) => item.quantidade > 0) : sizeFilteredStock;
      const mappedProduct = mapProduct(product, effectiveStock);
      const normalizedName = normalizeForSearch(product.nome);
      const normalizedDescription = normalizeForSearch(product.descricao ?? '');
      const normalizedCategory = normalizeForSearch(product.categoria ?? '');
      const normalizedDepartment = normalizeForSearch(product.departamento ?? '');
      const normalizedPublico = normalizeForSearch(product.publico ?? '');
      const matchesDepartment =
        analysis.departmentCandidates.length === 0 || analysis.departmentCandidates.includes(product.departamento ?? '');
      const matchesCategory =
        analysis.categoryTerms.length === 0 ||
        matchesAnyTerm(normalizedCategory, analysis.categoryTerms) ||
        matchesAnyTerm(normalizedDepartment, analysis.categoryTerms);
      const matchesText =
        analysis.textVariants.length === 0 ||
        matchesAnyTerm(normalizedName, analysis.textVariants) ||
        matchesAnyTerm(normalizedDescription, analysis.textVariants) ||
        matchesAnyTerm(normalizedCategory, analysis.textVariants) ||
        matchesAnyTerm(normalizedDepartment, analysis.textVariants);
      const matchesPublico = !analysis.publicFilter || normalizedPublico === normalizeForSearch(analysis.publicFilter);

      return {
        matchesCategory,
        matchesDepartment,
        matchesPublico,
        matchesText,
        product: mappedProduct,
        rawStock,
        relevance: scoreProduct(mappedProduct, analysis),
      };
    })
    .filter((entry) => {
      if (!entry.matchesPublico) return false;

      const hasSemanticMatch = entry.matchesDepartment || entry.matchesCategory || entry.matchesText;

      if (!hasSemanticMatch) return false;

      const availableInAnySize = entry.rawStock.some((item) => item.quantidade > 0);
      const availableInSelectedSize = size
        ? entry.product.estoque_por_tamanho.some((item) => item.quantidade > 0)
        : availableInAnySize;

      if (size && !availableInSelectedSize) {
        removedByStock += 1;
        return false;
      }

      if (inStockOnly && !availableInSelectedSize) {
        removedByStock += 1;
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return b.product.id - a.product.id;
    })
    .slice(0, limit)
    .map(({ product }) => product);

  if (process.env.NODE_ENV !== 'production') {
    console.info('[whatsapp-catalog] Busca executada', {
      available: filtered.length,
      departmentFilter: analysis.filtersApplied.department,
      found: productRows.length,
      normalizedQuery: analysis.normalizedQuery,
      publicFilter: analysis.publicFilter,
      removedByStock,
      sizeFilter: size,
    });
  }

  return { products: filtered };
}
