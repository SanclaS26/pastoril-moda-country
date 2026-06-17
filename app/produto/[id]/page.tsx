'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

type IconName = 'arrow' | 'cart' | 'minus' | 'plus' | 'whatsapp';

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

  return (
    <svg {...common}>
      <path d="M5 19.2 6 15a7 7 0 1 1 2.8 2.8L5 19.2Z" />
      <path d="M9.4 8.7c.2 2.7 3.2 5.2 5.8 5.9" />
      <path d="m9.7 8.5.8 1.5-1 .7M15.4 14.5l-1.5-.8-.7 1" />
    </svg>
  );
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartError, setCartError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + getProductPrice(item) * item.quantity, 0),
    [cartItems],
  );

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

  const whatsappMessage = encodeURIComponent(
    `Ola, gostaria de fazer um pedido na Pastoril Moda Country.${cartItems.length ? '\n' : ''}${cartItems
      .map((item) => {
        const tamanho = productUsesVisibleSize(item) ? ` tamanho ${item.tamanhoSelecionado}` : '';
        return `${item.quantity}x ${item.nome} (${item.codigo_produto})${tamanho} - ${formatCurrency(getProductPrice(item))}`;
      })
      .join('\n')}${cartItems.length ? `\nTotal: ${formatCurrency(totalPrice)}` : ''}`,
  );

  const updateCartQuantity = (productToUpdate: Product, size: string, delta: number) => {
    setCartItems((current) =>
      current
        .map((item) => {
          if (item.id !== productToUpdate.id || item.tamanhoSelecionado !== size) {
            return item;
          }

          const stockItem = productUsesVisibleSize(productToUpdate)
            ? productToUpdate.estoque.find((stock) => stock.tamanho === size)
            : getAvailableUniqueStock(productToUpdate);
          const limit = stockItem?.quantidade ?? item.quantity;

          return { ...item, quantity: Math.min(Math.max(item.quantity + delta, 0), limit) };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productIdToRemove: number, size: string) => {
    setCartItems((current) => current.filter((item) => item.id !== productIdToRemove || item.tamanhoSelecionado !== size));
  };

  const addToCart = () => {
    if (!product) return;

    const usesVisibleSize = productUsesVisibleSize(product);
    const size = usesVisibleSize ? selectedSize : TAMANHO_UNICO;
    const stockItem = usesVisibleSize
      ? product.estoque.find((item) => item.tamanho === size)
      : getAvailableUniqueStock(product);

    if (!stockItem || stockItem.quantidade <= 0) {
      setCartError(usesVisibleSize ? 'Selecione um tamanho disponivel antes de adicionar ao carrinho.' : 'Produto sem estoque disponivel.');
      setSuccessMessage('');
      return;
    }

    const safeQuantity = Math.min(quantity, stockItem.quantidade);

    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id && item.tamanhoSelecionado === size);

      if (existing) {
        if (existing.quantity >= stockItem.quantidade) {
          setCartError('Quantidade maxima disponivel para este tamanho atingida.');
          setSuccessMessage('');
          return current;
        }

        return current.map((item) =>
          item.id === product.id && item.tamanhoSelecionado === size
            ? { ...item, quantity: Math.min(item.quantity + safeQuantity, stockItem.quantidade) }
            : item,
        );
      }

      return [...current, { ...product, tamanhoSelecionado: size, quantity: safeQuantity }];
    });

    setCartError('');
    setSuccessMessage('Produto adicionado ao carrinho.');
    setIsCartOpen(true);
  };

  return (
    <div className="type-body min-h-screen bg-[var(--pastoril-bg)] pb-10 text-[var(--pastoril-text)]">
      <header className="bg-[rgba(249,246,241,0.96)]">
        <div className="mx-auto grid h-[78px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5 sm:h-[96px] sm:px-8">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--pastoril-brown)] transition hover:bg-[var(--pastoril-soft)]"
            aria-label="Voltar"
          >
            <Icon name="arrow" className="h-6 w-6" />
          </button>

          <Link href="/" className="relative block h-[70px] w-[100px] sm:h-[93px] sm:w-[135px]" aria-label="Pastoril Moda Country">
            <Image
              src="/brand/pastoril-logo-header.png"
              alt="Pastoril Moda Country"
              fill
              sizes="(min-width: 640px) 135px, 100px"
              priority
              className="object-contain"
            />
          </Link>

          <div className="flex justify-end">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--pastoril-brown)] transition hover:bg-[var(--pastoril-soft)]"
              aria-label="Abrir carrinho"
            >
              <Icon name="cart" className="h-6 w-6" />
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

      <aside
        className={`${isCartOpen ? 'fixed inset-0 z-50 bg-[rgba(249,246,241,0.86)]' : 'hidden'}`}
        onClick={() => setIsCartOpen(false)}
      >
        <div
          className="fixed bottom-0 left-0 right-0 max-h-[82vh] overflow-auto rounded-t-3xl border border-[var(--pastoril-border)] bg-white p-5 shadow-[0_-18px_40px_rgba(47,47,47,0.16)] sm:left-auto sm:right-6 sm:top-24 sm:h-auto sm:w-[380px] sm:rounded-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="type-subtitle">Seu pedido</h2>
              <p className="type-helper text-[var(--pastoril-muted)]">{totalItems} itens</p>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pastoril-soft)] text-xl leading-none text-[var(--pastoril-brown)]"
              aria-label="Fechar carrinho"
            >
              x
            </button>
          </div>

          <div className="mb-6 max-h-72 space-y-3 overflow-y-auto">
            {cartItems.length === 0 ? (
              <div className="type-body rounded-xl bg-[var(--pastoril-bg)] px-4 py-6 text-center text-[var(--pastoril-muted)]">
                Carrinho vazio
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={`${item.id}-${item.tamanhoSelecionado}`} className="rounded-xl border border-[var(--pastoril-border)] bg-[var(--pastoril-bg)] p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="type-product-name truncate text-[var(--pastoril-brown)]">{item.nome}</p>
                      <p className="type-helper text-[var(--pastoril-muted)]">
                        {item.codigo_produto}
                        {productUsesVisibleSize(item) ? ` - Tam. ${item.tamanhoSelecionado}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id, item.tamanhoSelecionado)}
                      className="type-helper shrink-0 font-semibold text-[var(--pastoril-promo)] hover:text-[var(--pastoril-brown)]"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center overflow-hidden rounded-full border border-[var(--pastoril-border)] bg-white">
                      <button onClick={() => updateCartQuantity(item, item.tamanhoSelecionado, -1)} className="type-button h-8 w-8 text-[var(--pastoril-brown)] hover:bg-[var(--pastoril-soft)]">-</button>
                      <span className="type-helper w-8 text-center font-bold text-[var(--pastoril-text)]">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item, item.tamanhoSelecionado, 1)} className="type-button h-8 w-8 text-[var(--pastoril-brown)] hover:bg-[var(--pastoril-soft)]">+</button>
                    </div>
                    <p className="type-price">
                      {formatCurrency(getProductPrice(item) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[var(--pastoril-border)] pt-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="type-button text-[var(--pastoril-brown)]">Total:</span>
              <span className="type-price">{formatCurrency(totalPrice)}</span>
            </div>
            <a
              href={`https://wa.me/5568999244811?text=${whatsappMessage}`}
              className="type-button flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--pastoril-caramel)] px-4 py-3 text-center text-white transition hover:bg-[var(--pastoril-brown)]"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="whatsapp" className="h-5 w-5" />
              Enviar pelo WhatsApp
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
