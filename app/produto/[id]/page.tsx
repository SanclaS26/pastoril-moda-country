'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PublicCart } from '@/app/components/PublicCart';
import { StoreHeader } from '@/app/components/StoreHeader';
import { TAMANHO_UNICO } from '@/config/grades-tamanho';
import { usePublicCart } from '@/lib/use-public-cart';
import {
  type Product,
  formatCurrency,
  getAvailableUniqueStock,
  getProductPrice,
  productUsesVisibleSize,
} from '@/lib/catalog';

type IconName = 'arrow' | 'cart' | 'minus' | 'plus';

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.5,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  if (name === 'arrow') {
    return (
      <svg {...common}>
        <path d="m15 18-6-6 6-6" />
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

  if (name === 'minus') {
    return (
      <svg {...common}>
        <path d="M6 12h12" />
      </svg>
    );
  }

  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M12 6v12M6 12h12" />
      </svg>
    );
  }
  return null;
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <div className="aspect-square animate-pulse rounded-3xl bg-[var(--pastoril-soft)]" />
        <div className="rounded-3xl border border-[var(--pastoril-border)] bg-white p-6">
          <div className="mb-4 h-7 w-3/4 animate-pulse rounded bg-[var(--pastoril-soft)]" />
          <div className="mb-8 h-10 w-1/2 animate-pulse rounded bg-[var(--pastoril-soft)]" />
          <div className="h-36 animate-pulse rounded-2xl bg-[var(--pastoril-soft)]" />
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const {
    addProductToCart,
    badgeAnimating,
    cartItems,
    clearCart,
    isCartOpen,
    removeFromCart,
    setIsCartOpen,
    totalItems,
    totalPrice,
    updateCartQuantity,
    finalizeOnWhatsApp,
  } = usePublicCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/produtos/${productId}`, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Produto nao encontrado.');
        }

        const loadedProduct = data.product as Product;
        setProduct(loadedProduct);
        setSelectedImage(loadedProduct.imagem_principal ?? '');
        setSelectedSize(productUsesVisibleSize(loadedProduct) ? '' : TAMANHO_UNICO);
        setError('');
      } catch (fetchError) {
        setProduct(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar produto.');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  useEffect(() => {
    const openCart = () => setIsCartOpen(true);

    window.addEventListener('pastoril:open-cart', openCart);

    return () => window.removeEventListener('pastoril:open-cart', openCart);
  }, [setIsCartOpen]);

  const selectedStock = useMemo(() => {
    if (!product) return null;
    return productUsesVisibleSize(product)
      ? product.estoque.find((item) => item.tamanho === selectedSize) ?? null
      : getAvailableUniqueStock(product) ?? null;
  }, [product, selectedSize]);

  const maxQuantity = selectedStock?.quantidade ?? 0;
  const hasStock = product ? product.estoque.some((item) => item.quantidade > 0) : false;
  const currentPrice = product ? getProductPrice(product) : 0;
  const hasPromotion = Boolean(product?.em_promocao && product.preco_promocional !== null);
  const productImages = product?.imagem_principal ? [product.imagem_principal] : [];

  const addToCart = () => {
    if (!product) return;

    const usesVisibleSize = productUsesVisibleSize(product);
    const size = usesVisibleSize ? selectedSize : TAMANHO_UNICO;
    const result = addProductToCart(product, size, quantity);

    setCartError(result.error);
    setSuccessMessage(result.ok ? 'Produto adicionado ao carrinho.' : '');
  };

  return (
    <div className="type-body min-h-screen bg-[var(--pastoril-bg)] pb-10 text-[var(--pastoril-text)]">
      <StoreHeader onCartToggle={() => setIsCartOpen(!isCartOpen)} totalItems={totalItems} />

      <div className="mx-auto flex max-w-7xl px-5 pt-4 sm:px-8">
        <button
          onClick={() => router.back()}
          className="type-button inline-flex items-center gap-2 rounded-lg text-[var(--pastoril-brown)] transition hover:text-[var(--pastoril-caramel)]"
          aria-label="Voltar"
        >
          <Icon name="arrow" className="h-5 w-5" />
          Voltar
        </button>
      </div>
      <main>
        {loading ? (
          <DetailSkeleton />
        ) : error || !product ? (
          <section className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
            <div className="rounded-3xl border border-[var(--pastoril-border)] bg-white p-8 shadow-[0_12px_28px_rgba(74,52,40,0.08)]">
              <h1 className="type-title-main">Produto indisponivel</h1>
              <p className="type-helper mt-3 text-[var(--pastoril-muted)]">{error || 'Nao encontramos este produto.'}</p>
              <Link
                href="/"
                className="type-button mt-6 inline-flex rounded-lg bg-[var(--pastoril-caramel)] px-5 py-3 text-white transition hover:bg-[var(--pastoril-brown)]"
              >
                Voltar para a loja
              </Link>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-7xl px-5 py-5 sm:px-8 sm:py-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)] lg:items-start">
              <div>
                <div className="relative aspect-square overflow-hidden rounded-3xl border border-[var(--pastoril-border)] bg-[var(--pastoril-soft)] shadow-[0_14px_30px_rgba(74,52,40,0.08)]">
                  {selectedImage ? (
                    <Image
                      src={selectedImage}
                      alt={product.nome}
                      fill
                      priority
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="type-helper flex h-full items-center justify-center px-6 text-center text-[var(--pastoril-muted)]">
                      Produto sem imagem cadastrada
                    </div>
                  )}
                </div>

                {productImages.length > 1 && (
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                    {productImages.map((image) => (
                      <button
                        key={image}
                        onClick={() => setSelectedImage(image)}
                        className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-white ${selectedImage === image ? 'border-[var(--pastoril-caramel)]' : 'border-[var(--pastoril-border)]'}`}
                        aria-label="Trocar imagem principal"
                      >
                        <Image src={image} alt="" fill sizes="80px" className="object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--pastoril-border)] bg-white p-5 shadow-[0_12px_28px_rgba(74,52,40,0.08)] sm:p-7">
                {hasPromotion && (
                  <span className="type-helper mb-4 inline-flex rounded-lg bg-[var(--pastoril-promo)] px-3 py-1 font-bold uppercase text-white">
                    Promocao
                  </span>
                )}

                <p className="type-helper font-semibold uppercase text-[var(--pastoril-muted)]">
                  {product.categoria || product.departamento}
                </p>
                <h1 className="type-title-main mt-2">
                  {product.nome}
                </h1>
                <p className="type-helper mt-2 text-[var(--pastoril-muted)]">Cod. {product.codigo_produto}</p>

                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <p className="type-price">{formatCurrency(currentPrice)}</p>
                  {hasPromotion && (
                    <p className="type-helper pb-1 text-[var(--pastoril-muted)] line-through">{formatCurrency(product.preco)}</p>
                  )}
                </div>

                {product.descricao && (
                  <p className="type-body mt-5 whitespace-pre-line text-[var(--pastoril-muted)]">
                    {product.descricao}
                  </p>
                )}

                <div className="mt-6 border-t border-[var(--pastoril-border)] pt-6">
                  {productUsesVisibleSize(product) ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="type-button uppercase text-[var(--pastoril-brown)]">Tamanhos disponiveis</h2>
                        {selectedStock && (
                          <span className="type-helper font-semibold text-[var(--pastoril-muted)]">
                            {selectedStock.quantidade} em estoque
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {product.estoque.map((stock) => (
                          <button
                            key={stock.id}
                            onClick={() => {
                              setSelectedSize(stock.tamanho);
                              setQuantity(1);
                              setCartError('');
                            }}
                            disabled={stock.quantidade <= 0}
                            className={`type-button min-w-12 rounded-xl border px-4 py-3 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              selectedSize === stock.tamanho
                                ? 'border-[var(--pastoril-caramel)] bg-[var(--pastoril-caramel)] text-white'
                                : 'border-[var(--pastoril-border)] bg-[var(--pastoril-bg)] text-[var(--pastoril-brown)] hover:border-[var(--pastoril-caramel)]'
                            }`}
                          >
                            {stock.tamanho}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="type-body rounded-2xl bg-[var(--pastoril-bg)] p-4 text-[var(--pastoril-muted)]">
                      {hasStock ? `${maxQuantity} unidade(s) em estoque` : 'Produto sem estoque no momento'}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-[var(--pastoril-bg)] p-3">
                    <span className="type-button text-[var(--pastoril-brown)]">Quantidade</span>
                    <div className="flex items-center overflow-hidden rounded-full border border-[var(--pastoril-border)] bg-white">
                      <button
                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                        disabled={quantity <= 1}
                        className="flex h-10 w-10 items-center justify-center text-[var(--pastoril-brown)] transition hover:bg-[var(--pastoril-soft)] disabled:opacity-35"
                        aria-label="Diminuir quantidade"
                      >
                        <Icon name="minus" className="h-4 w-4" />
                      </button>
                      <span className="type-button w-10 text-center text-[var(--pastoril-text)]">{quantity}</span>
                      <button
                        onClick={() => setQuantity((current) => Math.min(maxQuantity || 1, current + 1))}
                        disabled={!maxQuantity || quantity >= maxQuantity}
                        className="flex h-10 w-10 items-center justify-center text-[var(--pastoril-brown)] transition hover:bg-[var(--pastoril-soft)] disabled:opacity-35"
                        aria-label="Aumentar quantidade"
                      >
                        <Icon name="plus" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {cartError && (
                    <div className="type-body mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                      {cartError}
                    </div>
                  )}
                  {successMessage && (
                    <div className="type-button mt-4 rounded-xl border border-[#E7E0D8] bg-[var(--pastoril-soft)] px-4 py-3 text-[var(--pastoril-brown)]">
                      {successMessage}
                    </div>
                  )}

                  <button
                    onClick={addToCart}
                    disabled={!hasStock || !maxQuantity}
                    className="type-button mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--pastoril-caramel)] px-5 py-4 uppercase text-white shadow-[0_12px_24px_rgba(200,114,44,0.22)] transition hover:bg-[var(--pastoril-brown)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name="cart" className="h-5 w-5" />
                    Adicionar ao carrinho
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <PublicCart
        badgeAnimating={badgeAnimating}
        cartError={cartError}
        cartItems={cartItems}
        clearCart={() => {
          const cleared = clearCart();
          if (cleared) {
            setCartError('');
            setSuccessMessage('');
          }
          return cleared;
        }}
        isCartOpen={isCartOpen}
        removeFromCart={removeFromCart}
        setIsCartOpen={setIsCartOpen}
        totalItems={totalItems}
        totalPrice={totalPrice}
        updateCartQuantity={updateCartQuantity}
        finalizeOnWhatsApp={finalizeOnWhatsApp}
      />
    </div>
  );
}


