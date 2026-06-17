'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TAMANHO_UNICO } from '@/config/grades-tamanho';
import {
  type CartItem,
  type Product,
  formatCurrency,
  getAvailableUniqueStock,
  getProductPrice,
  productUsesVisibleSize,
  readStoredCartItems,
  writeStoredCartItems,
} from '@/lib/catalog';

type MainBanner = {
  id: number;
  titulo: string | null;
  imagem_url: string;
};

type IconName =
  | 'menu'
  | 'search'
  | 'cart'
  | 'bag'
  | 'home'
  | 'grid'
  | 'shirt'
  | 'hat'
  | 'boot'
  | 'belt'
  | 'spark'
  | 'chevron'
  | 'whatsapp'
  | 'clipboard'
  | 'user'
  | 'instagram';

type PngIconName =
  | 'chapeu'
  | 'bota'
  | 'camisa'
  | 'calca'
  | 'cinto'
  | 'promocao'
  | 'menu'
  | 'busca'
  | 'carrinho'
  | 'inicio';

const categories: { label: string; icon: PngIconName }[] = [
  { label: 'Chapéus', icon: 'chapeu' },
  { label: 'Botas', icon: 'bota' },
  { label: 'Camisas', icon: 'camisa' },
  { label: 'Calças', icon: 'calca' },
  { label: 'Cintos', icon: 'cinto' },
  { label: 'Promoções', icon: 'promocao' },
];

const pngIconSrc: Record<PngIconName, string> = {
  chapeu: '/brand/icons/chapeu.png',
  bota: '/brand/icons/bota.png',
  camisa: '/brand/icons/camisa.png',
  calca: '/brand/icons/calca.png',
  cinto: '/brand/icons/cinto.png',
  promocao: '/brand/icons/promocao.png',
  menu: '/brand/icons/menu.png',
  busca: '/brand/icons/busca.png',
  carrinho: '/brand/icons/carrinho.png',
  inicio: '/brand/icons/inicio.png',
};

function PngIcon({
  name,
  alt,
  className,
  sizes,
}: {
  name: PngIconName;
  alt: string;
  className: string;
  sizes: string;
}) {
  return (
    <span className={`relative block ${className}`}>
      <Image
        src={pngIconSrc[name]}
        alt={alt}
        fill
        sizes={sizes}
        className="object-contain"
      />
    </span>
  );
}

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.45,
    vectorEffect: 'non-scaling-stroke',
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  if (name === 'menu') {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg {...common}>
        <circle cx="10.8" cy="10.8" r="6.2" />
        <path d="m15.5 15.5 4.2 4.2" />
      </svg>
    );
  }

  if (name === 'cart') {
    return (
      <svg {...common}>
        <path d="M3.5 4.8h2.1l2 10.2h9.8l2.1-7.2H7.1" />
        <path d="M8 15h9.3" />
        <circle cx="9" cy="19.4" r="1.35" />
        <circle cx="17.2" cy="19.4" r="1.35" />
      </svg>
    );
  }

  if (name === 'bag') {
    return (
      <svg {...common}>
        <path d="M7.3 9.2h9.4l-.7 9.7H8L7.3 9.2Z" />
        <path d="M9.4 9.2V7.4a2.6 2.6 0 0 1 5.2 0v1.8" />
      </svg>
    );
  }

  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="m4.5 11.2 7.5-6.5 7.5 6.5" />
        <path d="M6.6 10.6v8.8h10.8v-8.8" />
        <path d="M10 19.4v-5h4v5" />
      </svg>
    );
  }

  if (name === 'grid') {
    return (
      <svg {...common}>
        <path d="M5.2 5.2h5.1v5.1H5.2zM13.7 5.2h5.1v5.1h-5.1zM5.2 13.7h5.1v5.1H5.2zM13.7 13.7h5.1v5.1h-5.1z" />
      </svg>
    );
  }

  if (name === 'shirt') {
    return (
      <svg {...common}>
        <path d="M8.8 4.6h6.4l1.8 2 3 1.8-1.7 3.5-2.3-1.1v8.6H8v-8.6l-2.3 1.1L4 8.4l3-1.8 1.8-2Z" />
        <path d="M9.2 4.7c.7 1.3 4.9 1.3 5.6 0" />
      </svg>
    );
  }

  if (name === 'hat') {
    return (
      <svg {...common}>
        <path d="M5.2 13.4c2-1.6 3.3-5 6.8-5s4.8 3.4 6.8 5" />
        <path d="M3.4 15.2c4.2 1.7 13 1.7 17.2 0" />
        <path d="M8 13.3c1.4.6 6.6.6 8 0" />
      </svg>
    );
  }

  if (name === 'boot') {
    return (
      <svg {...common}>
        <path d="M8.4 4.3h6.2v7.8l2.3 2.2 3.7 1v3H8.4v-14Z" />
        <path d="M8.4 14.2H4.2v4.1h4.2" />
        <path d="M10.5 7h3.9" />
      </svg>
    );
  }

  if (name === 'belt') {
    return (
      <svg {...common}>
        <path d="M4 9.1h16v5.8H4z" />
        <path d="M9.4 8.5v7M14.6 8.5v7" />
        <path d="M10.2 10.4h3.6v3.2h-3.6z" />
        <path d="M5.6 12h2M16.4 12h2" />
      </svg>
    );
  }

  if (name === 'chevron') {
    return (
      <svg {...common}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  }

  if (name === 'whatsapp') {
    return (
      <svg {...common}>
        <path d="M5 19.2 6 15a7 7 0 1 1 2.8 2.8L5 19.2Z" />
        <path d="M9.4 8.7c.2 2.7 3.2 5.2 5.8 5.9" />
        <path d="m9.7 8.5.8 1.5-1 .7M15.4 14.5l-1.5-.8-.7 1" />
      </svg>
    );
  }

  if (name === 'clipboard') {
    return (
      <svg {...common}>
        <path d="M8.8 4.4h6.4l.8 2h2.5v14.1h-13V6.4H8l.8-2Z" />
        <path d="M9 6.4h6M9 11.2h6M9 15.2h4.2" />
      </svg>
    );
  }

  if (name === 'user') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.2" r="3.5" />
        <path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0" />
      </svg>
    );
  }

  if (name === 'instagram') {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="4" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M16.2 7.8h.1" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      <path d="m6 6 3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
    </svg>
  );
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
    <label className="mt-2 block">
      <span className="mb-1 block text-[0.58rem] font-semibold uppercase text-[var(--pastoril-muted)]">
        Tamanho
      </span>
      <select
        value={selectedSize}
        onChange={(event) => onSelect(event.target.value)}
        className="h-8 w-full rounded-lg border border-[var(--pastoril-border)] bg-white px-2 text-xs text-[var(--pastoril-text)] outline-none transition focus:border-[var(--pastoril-caramel)] focus:ring-2 focus:ring-[rgba(184,121,63,0.18)] sm:h-9 sm:text-sm"
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

function ProductCard({
  product,
  selectedSize,
  onSelectSize,
  onAddToCart,
  priority = false,
}: {
  product: Product;
  selectedSize: string;
  onSelectSize: (value: string) => void;
  onAddToCart: (product: Product) => void;
  priority?: boolean;
}) {
  const currentPrice = getProductPrice(product);
  const hasPromotion = product.em_promocao && product.preco_promocional !== null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--pastoril-border)] bg-[var(--pastoril-card)] shadow-[0_8px_18px_rgba(74,52,40,0.07)] sm:rounded-2xl">
      <div className="relative aspect-[1.2/1] overflow-hidden bg-[var(--pastoril-soft)]">
        {hasPromotion && (
          <span className="absolute left-2 top-2 z-10 rounded-lg bg-[var(--pastoril-promo)] px-2 py-1 text-[0.58rem] font-bold uppercase text-white shadow-sm sm:left-3 sm:top-3">
            Promo
          </span>
        )}
        <Link href={`/produto/${product.id}`} aria-label={`Ver detalhes de ${product.nome}`} className="absolute inset-0">
          {product.imagem_principal ? (
            <Image
              src={product.imagem_principal}
              alt={product.nome}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-sm text-[var(--pastoril-muted)]">
              Sem foto
            </div>
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <Link href={`/produto/${product.id}`} className="min-h-[2.25rem] text-sm font-semibold leading-snug text-[var(--pastoril-text)] transition hover:text-[var(--pastoril-caramel)] sm:min-h-[2.5rem] sm:text-base">
          {product.nome}
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-base font-black text-[var(--pastoril-brown)] sm:text-xl">
            {formatCurrency(currentPrice)}
          </p>
          {hasPromotion && (
            <p className="text-xs text-[var(--pastoril-muted)] line-through">
              {formatCurrency(product.preco)}
            </p>
          )}
        </div>

        <p className="mt-0.5 text-[0.65rem] font-medium text-[var(--pastoril-muted)] sm:text-xs">
          Cód. {product.codigo_produto}
        </p>

        <div className="mt-auto flex items-end gap-2 pt-2">
          <div className="min-w-0 flex-1">
            <ProductSizeSelector product={product} selectedSize={selectedSize} onSelect={onSelectSize} />
          </div>
          <button
            onClick={() => onAddToCart(product)}
            disabled={!product.estoque.length}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--pastoril-caramel)] text-white shadow-[0_8px_18px_rgba(184,121,63,0.24)] transition hover:bg-[var(--pastoril-brown)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={product.estoque.length ? `Adicionar ${product.nome} ao carrinho` : `${product.nome} sem estoque`}
            title={product.estoque.length ? 'Adicionar ao carrinho' : 'Sem estoque'}
          >
            <PngIcon name="carrinho" alt="" className="h-5 w-5" sizes="20px" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [mainBanner, setMainBanner] = useState<MainBanner | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});
  const [cartError, setCartError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCartItems(readStoredCartItems());
      setCartHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cartHydrated) {
      writeStoredCartItems(cartItems);
    }
  }, [cartHydrated, cartItems]);

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
        return `${item.quantity}x ${item.nome} (${item.codigo_produto})${tamanho} - ${formatCurrency(getProductPrice(item))}`;
      })
      .join('\n')}${cartItems.length ? `\nTotal: ${formatCurrency(totalPrice)}` : ''}`,
  );

  return (
    <div className="min-h-screen bg-[var(--pastoril-bg)] pb-[calc(96px+env(safe-area-inset-bottom))] text-[var(--pastoril-text)] lg:pb-0">
      <header className="bg-[rgba(249,246,241,0.96)] backdrop-blur">
        <div className="mx-auto grid h-[78px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5 sm:h-[96px] sm:px-8 lg:px-8">
          <div className="flex items-center justify-start">
            <a
              href="#categorias"
              className="flex h-9 w-9 items-center justify-center text-[var(--pastoril-brown)] transition hover:text-[var(--pastoril-caramel)] sm:h-10 sm:w-10"
              aria-label="Abrir categorias"
            >
              <PngIcon name="menu" alt="" className="h-7 w-7 sm:h-8 sm:w-8" sizes="(min-width: 640px) 32px, 28px" />
            </a>
          </div>

          <a href="#" className="relative block h-[70px] w-[100px] sm:h-[93px] sm:w-[135px]" aria-label="Pastoril Moda Country">
            <Image
              src="/brand/pastoril-logo-header.png"
              alt="Pastoril Moda Country"
              fill
              sizes="(min-width: 640px) 135px, 100px"
              priority
              className="object-contain"
            />
          </a>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <a
              href="#produtos"
              className="flex h-9 w-9 items-center justify-center text-[var(--pastoril-brown)] transition hover:text-[var(--pastoril-caramel)] sm:h-10 sm:w-10"
              aria-label="Buscar produtos"
            >
              <PngIcon name="busca" alt="" className="h-7 w-7 sm:h-8 sm:w-8" sizes="(min-width: 640px) 32px, 28px" />
            </a>
            <button
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="relative flex h-9 w-9 items-center justify-center text-[var(--pastoril-brown)] transition hover:text-[var(--pastoril-caramel)] sm:h-10 sm:w-10"
              aria-label="Abrir carrinho"
            >
              <PngIcon name="carrinho" alt="" className="h-7 w-7 sm:h-8 sm:w-8" sizes="(min-width: 640px) 32px, 28px" />
              {totalItems > 0 && (
                <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--pastoril-caramel)] px-1 text-[0.65rem] font-bold text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="px-5 pt-1 sm:px-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="relative aspect-[2.18/1] overflow-hidden rounded-[18px] bg-[var(--pastoril-soft)] shadow-[0_10px_22px_rgba(74,45,26,0.07)] sm:aspect-[2.55/1] sm:rounded-[24px] lg:aspect-[3.15/1]">
              {mainBanner ? (
                <Image
                  src={mainBanner.imagem_url}
                  alt={mainBanner.titulo || 'Banner Pastoril Moda Country'}
                  fill
                  priority
                  sizes="(min-width: 1280px) 1216px, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(135deg,#EFE6DB,#FFFFFF)]" aria-label="Banner Pastoril Moda Country" />
              )}
            </div>
          </div>
        </section>

        <section id="categorias" className="py-4 sm:py-6">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-8">
            <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:justify-center sm:gap-7 sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-9">
              {categories.map((category) => (
                <a key={category.label} href="#produtos" className="min-w-[72px] text-center sm:min-w-[76px]">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pastoril-soft)] text-[var(--pastoril-brown)] shadow-[inset_0_0_0_1px_rgba(74,45,26,0.04)]">
                    <PngIcon name={category.icon} alt="" className="h-9 w-9" sizes="36px" />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--pastoril-text)] sm:text-[0.94rem]">{category.label}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl gap-8 border-t border-[var(--pastoril-border)] px-5 py-5 sm:px-8 sm:py-8 lg:grid lg:grid-cols-[1fr_360px] lg:px-8">
          <section id="produtos">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-3xl font-bold leading-none text-[var(--pastoril-brown)] sm:text-4xl">Destaques</h2>
              <a href="#produtos" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--pastoril-caramel)] sm:text-base">
                Ver todos
                <Icon name="chevron" className="h-4 w-4" />
              </a>
            </div>

            {loadingProducts ? (
              <div className="rounded-2xl border border-[var(--pastoril-border)] bg-white px-6 py-12 text-center text-[var(--pastoril-muted)]">
                Carregando produtos...
              </div>
            ) : productsError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-700">
                {productsError}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-[var(--pastoril-border)] bg-white px-6 py-12 text-center text-[var(--pastoril-muted)]">
                Nenhum produto disponível no momento.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selectedSize={selectedSizes[product.id] ?? ''}
                    onSelectSize={(value) => {
                      setSelectedSizes((current) => ({ ...current, [product.id]: value }));
                      setCartError('');
                    }}
                    onAddToCart={addToCart}
                    priority={index < 4}
                  />
                ))}
              </div>
            )}
          </section>

          <aside
            className={`${isCartOpen ? 'fixed inset-0 z-50 bg-[rgba(249,246,241,0.86)] lg:static lg:bg-transparent' : 'hidden lg:block'}`}
            onClick={() => isCartOpen && setIsCartOpen(false)}
          >
            <div
              className="fixed bottom-0 left-0 right-0 max-h-[82vh] overflow-auto rounded-t-3xl border border-[var(--pastoril-border)] bg-white p-5 shadow-[0_-18px_40px_rgba(47,47,47,0.16)] lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:rounded-2xl lg:p-6 lg:shadow-[0_12px_28px_rgba(74,52,40,0.08)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--pastoril-brown)]">Seu pedido</h2>
                  <p className="text-sm text-[var(--pastoril-muted)]">{totalItems} itens</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pastoril-soft)] text-xl leading-none text-[var(--pastoril-brown)] lg:hidden"
                  aria-label="Fechar carrinho"
                >
                  x
                </button>
              </div>

              {cartError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {cartError}
                </div>
              )}

              <div className="mb-6 max-h-72 space-y-3 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="rounded-xl bg-[var(--pastoril-bg)] px-4 py-6 text-center text-[var(--pastoril-muted)]">
                    Carrinho vazio
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={`${item.id}-${item.tamanhoSelecionado}`} className="rounded-xl border border-[var(--pastoril-border)] bg-[var(--pastoril-bg)] p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--pastoril-brown)]">{item.nome}</p>
                          <p className="text-xs text-[var(--pastoril-muted)]">
                            {item.codigo_produto}
                            {productUsesVisibleSize(item) ? ` · Tam. ${item.tamanhoSelecionado}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id, item.tamanhoSelecionado)}
                          className="shrink-0 text-xs font-semibold text-[var(--pastoril-promo)] hover:text-[var(--pastoril-brown)]"
                        >
                          Remover
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center overflow-hidden rounded-full border border-[var(--pastoril-border)] bg-white">
                          <button onClick={() => updateQuantity(item.id, item.tamanhoSelecionado, -1)} className="h-8 w-8 text-sm text-[var(--pastoril-brown)] hover:bg-[var(--pastoril-soft)]">-</button>
                          <span className="w-8 text-center text-xs font-bold text-[var(--pastoril-text)]">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.tamanhoSelecionado, 1)} className="h-8 w-8 text-sm text-[var(--pastoril-brown)] hover:bg-[var(--pastoril-soft)]">+</button>
                        </div>
                        <p className="text-sm font-bold text-[var(--pastoril-brown)]">
                          {formatCurrency(getProductPrice(item) * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-[var(--pastoril-border)] pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-[var(--pastoril-brown)]">Total:</span>
                  <span className="text-2xl font-bold text-[var(--pastoril-brown)]">{formatCurrency(totalPrice)}</span>
                </div>
                <a
                  href={`https://wa.me/5568999244811?text=${whatsappMessage}`}
                  className="block w-full rounded-lg bg-[var(--pastoril-caramel)] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--pastoril-brown)]"
                  target="_blank"
                  rel="noreferrer"
                >
                  Enviar pelo WhatsApp
                </a>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[var(--pastoril-border)] bg-white py-8 text-center text-sm text-[var(--pastoril-muted)]">
        <p>&copy; 2026 Pastoril Moda Country. Todos os direitos reservados.</p>
      </footer>

      <nav
        data-bottom-mobile-nav
        className="fixed bottom-0 left-0 right-0 z-[9999] h-[calc(72px+env(safe-area-inset-bottom))] border-t border-[#E7E0D8] bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_20px_rgba(74,45,26,0.06)] md:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid h-full max-w-[430px] grid-cols-5 items-start">
          <a href="#" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium leading-none text-[#C8722C]">
            <PngIcon name="inicio" alt="" className="h-[24px] w-[24px]" sizes="24px" />
            <span>Início</span>
          </a>
          <a href="#categorias" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium leading-none text-[#4A2D1A]">
            <Icon name="grid" className="h-[24px] w-[24px]" />
            <span>Categorias</span>
          </a>
          <a href="#produtos" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium leading-none text-[#4A2D1A]">
            <Icon name="search" className="h-[24px] w-[24px]" />
            <span>Buscar</span>
          </a>
          <a
            href="https://wa.me/5568999244811"
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium leading-none text-[#4A2D1A]"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="whatsapp" className="h-[24px] w-[24px]" />
            <span>WhatsApp</span>
          </a>
          <a
            href="https://www.instagram.com/pastorilcountry/"
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium leading-none text-[#4A2D1A]"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="instagram" className="h-[24px] w-[24px]" />
            <span>Instagram</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
