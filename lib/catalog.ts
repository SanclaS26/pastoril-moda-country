import { TAMANHO_UNICO, getTipoGradeTamanho, isGradeSemSeletor } from '@/config/grades-tamanho';

export const CART_STORAGE_KEY = 'pastoril-cart-items';

export type StockItem = {
  id: number;
  produto_id?: number;
  tamanho: string;
  quantidade: number;
};

export type Product = {
  id: number;
  codigo_produto: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  em_promocao: boolean;
  imagem_principal: string | null;
  categoria?: string | null;
  departamento: string;
  publico: string | null;
  descricao?: string | null;
  ativo?: boolean;
  destaque?: boolean;
  estoque: StockItem[];
  tipo_grade?: 'roupas' | 'calcados' | 'chapeus_bones' | 'cintos' | 'unico';
  imagens?: { id: number; url: string; ordem: number; principal: boolean; tipo_midia: 'imagem' | 'video' }[];
};

export type CartItem = Product & {
  tamanhoSelecionado: string;
  quantity: number;
};

export function getProductPrice(product: Product) {
  return product.em_promocao && product.preco_promocional !== null ? product.preco_promocional : product.preco;
}

export function productUsesVisibleSize(product: Product) {
  if (product.tipo_grade) return product.tipo_grade !== 'unico';
  return !isGradeSemSeletor(getTipoGradeTamanho(product.departamento, product.publico));
}

export function getAvailableUniqueStock(product: Product) {
  return product.estoque.find((item) => item.tamanho === TAMANHO_UNICO) ?? product.estoque[0];
}

export function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

export function readStoredCartItems() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredCartItems(items: CartItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}
