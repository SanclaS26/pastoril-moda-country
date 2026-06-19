'use client';

import {
  type CartItem,
  formatCurrency,
  getProductPrice,
  productUsesVisibleSize,
} from '@/lib/catalog';

type PublicCartIconName = 'cart';

export function PublicCartIcon({ name, className = 'h-5 w-5' }: { name: PublicCartIconName; className?: string }) {
  if (name !== 'cart') return null;

  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.45}
      vectorEffect="non-scaling-stroke"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3.5 4.8h2.1l2 10.2h9.8l2.1-7.2H7.1" />
      <path d="M8 15h9.3" />
      <circle cx="9" cy="19.4" r="1.35" />
      <circle cx="17.2" cy="19.4" r="1.35" />
    </svg>
  );
}

type PublicCartProps = {
  badgeAnimating: boolean;
  cartError?: string;
  cartItems: CartItem[];
  clearCart: () => boolean;
  finalizeOnWhatsApp: () => Promise<void>;
  isCartOpen: boolean;
  removeFromCart: (productId: number, selectedSize: string) => void;
  setIsCartOpen: (isOpen: boolean) => void;
  totalItems: number;
  totalPrice: number;
  updateCartQuantity: (productId: number, selectedSize: string, delta: number) => void;
};

export function PublicCart({
  badgeAnimating,
  cartError = '',
  cartItems,
  clearCart,
  finalizeOnWhatsApp,
  isCartOpen,
  removeFromCart,
  setIsCartOpen,
  totalItems,
  totalPrice,
  updateCartQuantity,
}: PublicCartProps) {
  const asideClassName = isCartOpen
    ? 'fixed inset-0 z-50 bg-[rgba(249,246,241,0.86)]'
    : 'hidden';

  const panelClassName =
    'fixed bottom-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom))] left-0 right-0 flex max-h-[calc(100dvh-var(--mobile-bottom-nav-height)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-t-3xl border border-[var(--pastoril-border)] bg-white p-5 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[0_-18px_40px_rgba(47,47,47,0.16)] lg:bottom-auto lg:left-auto lg:right-6 lg:top-24 lg:w-[380px] lg:max-h-[calc(100vh-7rem)] lg:rounded-2xl lg:p-6 lg:shadow-[0_18px_42px_rgba(74,52,40,0.18)]';

  return (
    <>
      <aside
        className={asideClassName}
        onClick={() => isCartOpen && setIsCartOpen(false)}
      >
        <div
          className={panelClassName}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="type-subtitle">Seu pedido</h2>
              <p className="type-helper text-[var(--pastoril-muted)]">{totalItems} itens</p>
            </div>
            <div className="flex items-center gap-2">
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="min-h-10 px-1 text-xs font-medium text-[#A65A4A] underline-offset-4 hover:underline"
                >
                  Esvaziar carrinho
                </button>
              )}
              <button
                onClick={() => setIsCartOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pastoril-soft)] text-xl leading-none text-[var(--pastoril-brown)]"
                aria-label="Fechar carrinho"
              >
                x
              </button>
            </div>
          </div>

          {cartError && (
            <div className="type-body mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              {cartError}
            </div>
          )}

          <div className="mb-6 min-h-0 flex-1 space-y-3 overflow-y-auto pb-6 lg:max-h-72 lg:flex-none lg:pb-0">
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
                        {productUsesVisibleSize(item) ? ` · Tam. ${item.tamanhoSelecionado}` : ''}
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
                      <button onClick={() => updateCartQuantity(item.id, item.tamanhoSelecionado, -1)} className="type-button h-8 w-8 text-[var(--pastoril-brown)] hover:bg-[var(--pastoril-soft)]">-</button>
                      <span className="type-helper w-8 text-center font-bold text-[var(--pastoril-text)]">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.id, item.tamanhoSelecionado, 1)} className="type-button h-8 w-8 text-[var(--pastoril-brown)] hover:bg-[var(--pastoril-soft)]">+</button>
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
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              className="type-button mb-3 block w-full rounded-lg border border-[var(--pastoril-caramel)] bg-transparent px-4 py-3 text-center text-[var(--pastoril-brown)] transition hover:bg-[var(--pastoril-soft)]"
            >
              Continuar comprando
            </button>
            <button
              type="button"
              onClick={finalizeOnWhatsApp}
              className="type-button block w-full rounded-lg bg-[var(--pastoril-caramel)] px-4 py-3 text-center text-white transition hover:bg-[var(--pastoril-brown)]"
            >
              Enviar pedido pelo WhatsApp
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-[calc(var(--mobile-bottom-nav-height)+16px+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pastoril-caramel)] text-white shadow-[0_8px_18px_rgba(74,45,26,0.18)] transition hover:bg-[var(--pastoril-brown)] md:right-6 md:h-[52px] md:w-[52px]"
        aria-label="Abrir carrinho"
      >
        <PublicCartIcon name="cart" className="h-6 w-6" />
        {totalItems > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4A2D1A] px-1 text-[11px] font-bold leading-none text-white ${
              badgeAnimating ? 'cart-badge-pulse' : ''
            }`}
          >
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        )}
      </button>
    </>
  );
}
