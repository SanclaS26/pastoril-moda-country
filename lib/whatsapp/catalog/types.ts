export interface CatalogStockItem {
  quantidade: number;
  tamanho: string;
}

export interface CatalogProductSanitized {
  categoria: string | null;
  codigo_produto: string;
  departamento: string | null;
  descricao_curta: string | null;
  em_promocao: boolean;
  estoque_por_tamanho: CatalogStockItem[];
  id: number;
  imagem_principal: string | null;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  tamanhos_disponiveis: string[];
}

export interface SearchProductsInput {
  category?: string;
  department?: string;
  inStockOnly?: boolean;
  limit?: number;
  query?: string;
  size?: string;
}

export interface SearchProductsResult {
  products: CatalogProductSanitized[];
}

export interface GetProductDetailsInput {
  inStockOnly?: boolean;
  productId: number;
  size?: string;
}

export interface GetProductDetailsResult {
  product: CatalogProductSanitized | null;
}

export class CatalogQueryError extends Error {
  code: 'catalog_query_failed';

  constructor(message: string) {
    super(message);
    this.name = 'CatalogQueryError';
    this.code = 'catalog_query_failed';
  }
}
