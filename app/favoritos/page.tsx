'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicCart } from '@/app/components/PublicCart';
import { StoreHeader } from '@/app/components/StoreHeader';
import { WishlistButton } from '@/app/components/WishlistButton';
import { TAMANHO_UNICO } from '@/config/grades-tamanho';
import {
  type Product,
  formatCurrency,
  getAvailableUniqueStock,
  getProductPrice,
  productUsesVisibleSize,
} from '@/lib/catalog';
import { usePublicCart } from '@/lib/use-public-cart';
import { useWishlist } from '@/lib/use-wishlist';
import { clienteSupabase } from '@/lib/supabase-cliente';

export default function FavoritesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [cartError, setCartError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { error: wishlistError, favoriteIds, isLoading: wishlistLoading, toggleFavorite } = useWishlist();
  const publicCart = usePublicCart();
  const {
    addProductToCart,
    badgeAnimating,
    cartItems,
    checkoutObservations,
    clearCart,
    finalizeOnWhatsApp,
    isCartOpen,
    isSubmitting,
    openWhatsAppFallback,
    removeFromCart,
    setCheckoutObservations,
    setIsCartOpen,
    totalItems,
    totalPrice,
    updateCartQuantity,
    whatsappFallbackUrl,
  } = publicCart;

  useEffect(() => {
    const checkClienteAccess = async () => {
      const { data } = await clienteSupabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      const response = await fetch('/api/clientes/perfil', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) return;

      if (result?.cliente?.must_change_password) {
        router.push('/alterar-senha');
        return;
      }

      if (!result?.cliente?.email) {
        router.push('/minha-conta?email=obrigatorio');
      }
    };

    void checkClienteAccess();
  }, [router]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/produtos', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'Não foi possível carregar os produtos.');
        setProducts(Array.isArray(result.products) ? result.products : []);
      } catch (error) {
        setProductsError(error instanceof Error ? error.message : 'Não foi possível carregar os produtos.');
      } finally {
        setProductsLoading(false);
      }
    };

    void loadProducts();
  }, []);

  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.has(product.id)),
    [favoriteIds, products],
  );

  const addToCart = (product: Product) => {
    if (productUsesVisibleSize(product)) return;
    const stock = getAvailableUniqueStock(product);
    const result = addProductToCart(product, stock?.tamanho || TAMANHO_UNICO, 1);
    setCartError(result.error);
    setSuccessMessage(result.ok ? `${product.nome} foi adicionado ao carrinho.` : '');
  };

  const loading = productsLoading || wishlistLoading;
  const error = productsError || wishlistError;

  return (
    <div className="min-h-screen bg-[var(--pastoril-bg)] pb-24 text-[var(--pastoril-text)]">
      <StoreHeader onCartToggle={() => setIsCartOpen(!isCartOpen)} totalItems={totalItems} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="type-title-main">Meus favoritos</h1>
            <p className="mt-1 text-sm text-[var(--pastoril-muted)]">Seus produtos salvos em um só lugar.</p>
          </div>
          <Link href="/#produtos" className="text-sm font-semibold text-[var(--pastoril-caramel)]">Ver produtos</Link>
        </div>

        {(error || cartError) && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error || cartError}</p>}
        {successMessage && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p>}

        {loading ? (
          <p className="rounded-2xl border border-[var(--pastoril-border)] bg-white px-5 py-12 text-center text-[var(--pastoril-muted)]">Carregando favoritos...</p>
        ) : favoriteProducts.length === 0 ? (
          <section className="rounded-2xl border border-[var(--pastoril-border)] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-base font-semibold text-[var(--pastoril-brown)]">Sua lista de desejos está vazia.</p>
            <Link href="/#produtos" className="mt-5 inline-flex rounded-xl bg-[var(--pastoril-caramel)] px-5 py-3 text-sm font-bold text-white">Ver produtos</Link>
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteProducts.map((product) => {
              const available = product.estoque.some((stock) => stock.quantidade > 0);
              const hasPromotion = product.em_promocao && product.preco_promocional !== null;
              const chooseSize = productUsesVisibleSize(product);

              return (
                <article key={product.id} className="relative overflow-hidden rounded-2xl border border-[var(--pastoril-border)] bg-white shadow-sm">
                  <WishlistButton className="absolute right-3 top-3 z-20 h-9 w-9" isFavorite onToggle={() => toggleFavorite(product.id)} productName={product.nome} />
                  <Link href={`/produto/${product.id}`} className="block">
                    <div className="relative aspect-[4/3] bg-[var(--pastoril-soft)]">
                      {product.imagem_principal ? <Image src={product.imagem_principal} alt={product.nome} fill sizes="(min-width: 1024px) 30vw, 50vw" className="object-contain p-2" /> : <div className="flex h-full items-center justify-center text-sm text-[var(--pastoril-muted)]">Sem foto</div>}
                    </div>
                    <div className="p-4 pb-2">
                      <h2 className="line-clamp-2 font-semibold text-[var(--pastoril-brown)]">{product.nome}</h2>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-bold">{formatCurrency(getProductPrice(product))}</span>
                        {hasPromotion && <span className="text-xs text-[var(--pastoril-muted)] line-through">{formatCurrency(product.preco)}</span>}
                      </div>
                      <p className={`mt-2 text-xs font-semibold ${available ? 'text-emerald-700' : 'text-rose-700'}`}>{available ? 'Disponível' : 'Indisponível'}</p>
                    </div>
                  </Link>
                  <div className="grid grid-cols-2 gap-2 p-4 pt-2">
                    <button type="button" onClick={() => toggleFavorite(product.id)} className="rounded-xl border border-[var(--pastoril-border)] px-3 py-2 text-sm font-semibold text-[var(--pastoril-brown)]">Remover</button>
                    {chooseSize ? (
                      <Link href={`/produto/${product.id}`} className="rounded-xl bg-[var(--pastoril-caramel)] px-3 py-2 text-center text-sm font-semibold text-white">Escolher tamanho</Link>
                    ) : (
                      <button type="button" onClick={() => addToCart(product)} disabled={!available} className="rounded-xl bg-[var(--pastoril-caramel)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Adicionar ao carrinho</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <PublicCart
        badgeAnimating={badgeAnimating}
        cartError={cartError}
        cartItems={cartItems}
        checkoutObservations={checkoutObservations}
        clearCart={clearCart}
        finalizeOnWhatsApp={finalizeOnWhatsApp}
        isCartOpen={isCartOpen}
        isSubmitting={isSubmitting}
        openWhatsAppFallback={openWhatsAppFallback}
        removeFromCart={removeFromCart}
        setCheckoutObservations={setCheckoutObservations}
        setIsCartOpen={setIsCartOpen}
        totalItems={totalItems}
        totalPrice={totalPrice}
        updateCartQuantity={updateCartQuantity}
        whatsappFallbackUrl={whatsappFallbackUrl}
      />
    </div>
  );
}
