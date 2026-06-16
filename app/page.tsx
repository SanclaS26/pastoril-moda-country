'use client';

import { useEffect, useMemo, useState } from 'react';
import { TAMANHO_UNICO, getTipoGradeTamanho, isGradeSemSeletor } from '@/config/grades-tamanho';

type Product = {
  id: number;
  codigo_produto: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  em_promocao: boolean;
  imagem_principal: string | null;
  departamento: string;
  publico: string | null;
  estoque: StockItem[];
};

type StockItem = {
  id: number;
  tamanho: string;
  quantidade: number;
};

type CartItem = Product & {
  tamanhoSelecionado: string;
  quantity: number;
};

type MainBanner = {
  id: number;
  titulo: string | null;
  imagem_url: string;
};

const categories = ['Feminino', 'Masculino', 'Infantil', 'Calçados', 'Acessórios'];

function getProductPrice(product: Product) {
  return product.em_promocao && product.preco_promocional !== null ? product.preco_promocional : product.preco;
}

function productUsesVisibleSize(product: Product) {
  return !isGradeSemSeletor(getTipoGradeTamanho(product.departamento, product.publico));
}

function getAvailableUniqueStock(product: Product) {
  return product.estoque.find((item) => item.tamanho === TAMANHO_UNICO) ?? product.estoque[0];
}

function ProductSizeSelector({
  product,
  selectedSize,
  onSelect,
}: {
  product: Product;
  selectedSize: string;
  onSelect: (value: string) => void;
}) {
  if (!productUsesVisibleSize(product)) {
    return null;
  }

  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-600">Tamanho</span>
      <select
        value={selectedSize}
        onChange={(event) => onSelect(event.target.value)}
        className="w-full rounded-full border border-amber-900/10 bg-white px-4 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
      >
        <option value="">Selecione</option>
        {product.estoque.map((stock) => (
          <option key={stock.id} value={stock.tamanho}>
            {stock.tamanho} ({stock.quantidade} disp.)
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [mainBanner, setMainBanner] = useState<MainBanner | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [cartError, setCartError] = useState('');
  const promotionalProducts = useMemo(
    () => products.filter((product) => product.em_promocao),
    [products],
  );

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const response = await fetch('/api/produtos');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Erro ao carregar produtos.');
        }

        setProducts(Array.isArray(data.products) ? data.products : []);
        setProductsError('');
      } catch (error) {
        setProducts([]);
        setProductsError(error instanceof Error ? error.message : 'Erro ao carregar produtos.');
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchMainBanner = async () => {
      try {
        const response = await fetch('/api/banners/principal', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          return;
        }

        setMainBanner(data.banner ?? null);
      } catch {
        setMainBanner(null);
      }
    };

    fetchMainBanner();
  }, []);

  const addToCart = (product: Product) => {
    const usesVisibleSize = productUsesVisibleSize(product);
    const selectedSize = usesVisibleSize ? selectedSizes[product.id] : TAMANHO_UNICO;
    const stockItem = usesVisibleSize
      ? product.estoque.find((item) => item.tamanho === selectedSize)
      : getAvailableUniqueStock(product);

    if (!stockItem) {
      setCartError(usesVisibleSize ? 'Selecione um tamanho disponível antes de adicionar ao carrinho.' : 'Produto sem estoque disponível.');
      return;
    }

    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id && item.tamanhoSelecionado === selectedSize);
      if (existing) {
        if (existing.quantity >= stockItem.quantidade) {
          setCartError('Quantidade máxima disponível para este tamanho atingida.');
          return current;
        }

        return current.map((item) =>
          item.id === product.id && item.tamanhoSelecionado === selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { ...product, tamanhoSelecionado: selectedSize, quantity: 1 }];
    });
    setCartError('');
  };

  const updateQuantity = (productId: number, selectedSize: string, delta: number) => {
    setCartItems((current) =>
      current
        .map((item) => {
          if (item.id !== productId || item.tamanhoSelecionado !== selectedSize) {
            return item;
          }

          const stockItem = productUsesVisibleSize(item)
            ? item.estoque.find((stock) => stock.tamanho === selectedSize)
            : getAvailableUniqueStock(item);
          const maxQuantity = stockItem?.quantidade ?? item.quantity;
          return { ...item, quantity: Math.min(Math.max(item.quantity + delta, 0), maxQuantity) };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId: number, selectedSize: string) => {
    setCartItems((current) => current.filter((item) => item.id !== productId || item.tamanhoSelecionado !== selectedSize));
  };

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + getProductPrice(item) * item.quantity, 0),
    [cartItems],
  );

  const whatsappMessage = encodeURIComponent(
    `Olá, gostaria de fazer um pedido na Pastoril Moda Country.${cartItems.length ? '\n' : ''}${cartItems
      .map((item) => {
        const tamanho = productUsesVisibleSize(item) ? ` tamanho ${item.tamanhoSelecionado}` : '';
        return `${item.quantity}x ${item.nome} (${item.codigo_produto})${tamanho} - R$ ${getProductPrice(item).toFixed(2)}`;
      })
      .join('\n')}${cartItems.length ? `\nTotal: R$ ${totalPrice.toFixed(2)}` : ''}`,
  );

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-amber-900/10 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-800">
                <span className="text-lg font-bold text-white">P</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-slate-900">Pastoril</div>
                <div className="text-xs text-amber-700">Moda Country</div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#" className="text-sm font-medium text-slate-700 hover:text-amber-700">Início</a>
              <a href="#produtos" className="text-sm font-medium text-slate-700 hover:text-amber-700">Produtos</a>
              <a href="#categorias" className="text-sm font-medium text-slate-700 hover:text-amber-700">Categorias</a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-4">
              <a
                href="https://wa.me/5568999244811"
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700 transition"
              >
                WhatsApp
              </a>
              <button
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="relative rounded-full bg-amber-100 px-3 py-2 sm:px-4 sm:py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200 transition"
              >
                Carrinho
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-amber-900/30 to-slate-900 py-16 sm:py-24 lg:py-32"
        style={mainBanner ? { backgroundImage: `url(${mainBanner.imagem_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {mainBanner && <div className="absolute inset-0 bg-slate-950/55" />}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm uppercase tracking-widest text-amber-400 mb-4">Pastoril Moda Country</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Moda country com estilo e tradição
          </h1>
          <p className="text-lg sm:text-xl text-stone-200 mb-8 max-w-2xl mx-auto">
            Confira as peças disponíveis e envie seu pedido pelo WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#produtos" className="inline-flex items-center justify-center rounded-full bg-amber-600 px-8 py-3 text-base font-semibold text-white hover:bg-amber-700 transition shadow-lg">
              Ver produtos
            </a>
            <a href="https://wa.me/5568999244811" className="inline-flex items-center justify-center rounded-full border-2 border-amber-400 px-8 py-3 text-base font-semibold text-amber-400 hover:bg-amber-400/10 transition">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section id="categorias" className="py-12 sm:py-16 border-b border-amber-900/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((category) => (
              <div key={category} className="rounded-2xl bg-white border border-amber-900/10 p-4 text-center shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{category}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {promotionalProducts.length > 0 && (
        <section id="promocoes" className="border-b border-amber-900/10 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <p className="text-sm uppercase tracking-widest text-amber-700 font-semibold">Promoções</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">Peças em promoção</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {promotionalProducts.map((product) => (
                <div key={`promo-${product.id}`} className="group">
                  <div className="relative overflow-hidden rounded-2xl bg-stone-200 aspect-square mb-4">
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                      Promoção
                    </span>
                    {product.imagem_principal ? (
                      <img
                        src={product.imagem_principal}
                        alt={product.nome}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem foto</div>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">{product.codigo_produto}</p>
                  <h3 className="text-lg font-bold text-slate-900 mt-2 group-hover:text-amber-700 transition">{product.nome}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-sm text-slate-500 line-through">R$ {product.preco.toFixed(2)}</p>
                    <p className="text-2xl font-bold text-amber-800">R$ {getProductPrice(product).toFixed(2)}</p>
                  </div>
                  <ProductSizeSelector
                    product={product}
                    selectedSize={selectedSizes[product.id] ?? ''}
                    onSelect={(value) => {
                      setSelectedSizes((current) => ({ ...current, [product.id]: value }));
                      setCartError('');
                    }}
                  />
                  <button
                    onClick={() => addToCart(product)}
                    disabled={!product.estoque.length}
                    className="w-full mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {product.estoque.length ? 'Adicionar' : 'Sem estoque'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 grid gap-8 lg:grid-cols-[1fr_350px]">
        <section id="produtos">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-widest text-amber-700 font-semibold">Produtos cadastrados</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">Vitrine</h2>
          </div>

          {loadingProducts ? (
            <div className="rounded-2xl bg-white border border-amber-900/10 px-6 py-12 text-center text-slate-600">
              Carregando produtos...
            </div>
          ) : productsError ? (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-6 py-4 text-rose-700">
              {productsError}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl bg-white border border-amber-900/10 px-6 py-12 text-center text-slate-600">
              Nenhum produto disponível no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="group">
                  <div className="relative overflow-hidden rounded-2xl bg-stone-200 aspect-square mb-4">
                    {product.imagem_principal ? (
                      <img
                        src={product.imagem_principal}
                        alt={product.nome}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem foto</div>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">{product.codigo_produto}</p>
                  <h3 className="text-lg font-bold text-slate-900 mt-2 group-hover:text-amber-700 transition">{product.nome}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-amber-800">R$ {getProductPrice(product).toFixed(2)}</p>
                    {product.em_promocao && product.preco_promocional !== null && (
                      <p className="text-sm text-slate-500 line-through">R$ {product.preco.toFixed(2)}</p>
                    )}
                  </div>
                  {product.em_promocao && (
                    <span className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Promoção
                    </span>
                  )}
                  <ProductSizeSelector
                    product={product}
                    selectedSize={selectedSizes[product.id] ?? ''}
                    onSelect={(value) => {
                      setSelectedSizes((current) => ({ ...current, [product.id]: value }));
                      setCartError('');
                    }}
                  />
                  <button
                    onClick={() => addToCart(product)}
                    disabled={!product.estoque.length}
                    className="w-full mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {product.estoque.length ? 'Adicionar' : 'Sem estoque'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className={`${isCartOpen ? 'fixed inset-0 z-30 bg-black/50 lg:static lg:bg-transparent' : 'hidden lg:block'}`} onClick={() => isCartOpen && setIsCartOpen(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 lg:static rounded-t-3xl lg:rounded-2xl bg-white border border-amber-900/10 p-6 max-h-[80vh] overflow-auto lg:overflow-visible"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 lg:hidden">
              <h2 className="text-xl font-bold">Seu carrinho</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-2xl">x</button>
            </div>

            <div className="hidden lg:block mb-6">
              <h2 className="text-xl font-bold text-slate-900">Seu pedido</h2>
              <p className="text-sm text-slate-600">{totalItems} itens</p>
            </div>

            {cartError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {cartError}
              </div>
            )}

            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="rounded-xl bg-stone-50 px-4 py-6 text-center text-slate-600">Carrinho vazio</div>
              ) : (
                cartItems.map((item) => (
                  <div key={`${item.id}-${item.tamanhoSelecionado}`} className="rounded-xl bg-stone-50 p-3 border border-amber-900/5">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.nome}</p>
                        <p className="text-xs text-slate-600">
                          {item.codigo_produto}
                          {productUsesVisibleSize(item) ? ` · Tam. ${item.tamanhoSelecionado}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id, item.tamanhoSelecionado)}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-white rounded-full border border-amber-900/10">
                        <button onClick={() => updateQuantity(item.id, item.tamanhoSelecionado, -1)} className="h-6 w-6 hover:bg-stone-100 text-sm">-</button>
                        <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.tamanhoSelecionado, 1)} className="h-6 w-6 hover:bg-stone-100 text-sm">+</button>
                      </div>
                      <p className="text-sm font-bold text-amber-800">
                        R$ {(getProductPrice(item) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-amber-900/10 pt-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-slate-900">Total:</span>
                <span className="text-2xl font-bold text-amber-800">R$ {totalPrice.toFixed(2)}</span>
              </div>
              <a
                href={`https://wa.me/5568999244811?text=${whatsappMessage}`}
                className="block w-full rounded-full bg-green-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-green-700 transition"
                target="_blank"
                rel="noreferrer"
              >
                Enviar pelo WhatsApp
              </a>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="lg:hidden w-full rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-300 transition"
            >
              Fechar
            </button>
          </div>
        </aside>
      </div>

      <footer className="border-t border-amber-900/10 bg-slate-900 text-stone-200 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-stone-400">
          <p>&copy; 2026 Pastoril Moda Country. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
