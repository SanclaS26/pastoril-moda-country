'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClienteAuthButton } from '@/app/components/ClienteAuthButton';
import { useClienteAuth } from '@/app/components/ClienteAuthProvider';
import { PublicCart } from '@/app/components/PublicCart';
import { StoreHeader } from '@/app/components/StoreHeader';
import { StoreMenu, type StoreMenuCategory } from '@/app/components/StoreMenu';
import { usePublicCart } from '@/lib/use-public-cart';

const whatsappUrl = 'https://wa.me/5568999244811';

const menuCategories: StoreMenuCategory[] = [
  { id: 'masculino', label: 'Masculino', subcategories: [] },
  { id: 'feminino', label: 'Feminino', subcategories: [] },
  { id: 'infantil', label: 'Infantil', subcategories: [] },
  { id: 'todos', label: 'Todos', subcategories: [] },
];

const mainRules = [
  'Trocamos compras em até 7 dias, com etiquetas e sem marcas de uso.',
  'Não aceitamos trocas nem devoluções de peças na promoção.',
  'Parcelamento no link em até 3x sem juros.',
  'Pagando na loja, parcelamento em até 6x sem juros.',
  'A troca também pode ser feita comparecendo à loja física.',
];

const policySections = [
  {
    title: 'Condições para troca',
    text: 'A peça deve estar sem uso, com etiqueta e comprovante de compra.',
  },
  {
    title: 'Prazo para solicitar',
    text: 'Até 7 dias corridos após o recebimento ou retirada da compra.',
  },
  {
    title: 'Como solicitar',
    text: 'O cliente pode entrar em contato pelo WhatsApp ou comparecer à loja física, informando nome, número do pedido e motivo da troca.',
  },
  {
    title: 'Análise da peça',
    text: 'A troca fica sujeita à verificação das condições do produto.',
  },
  {
    title: 'Peças com defeito',
    text: 'Serão avaliadas conforme o Código de Defesa do Consumidor.',
  },
  {
    title: 'Estorno ou crédito',
    text: 'Quando aplicável, o cliente poderá optar por estorno ou por crédito para utilizar em outra compra na loja, conforme análise do caso.',
  },
];

type PolicyIconName = 'menu' | 'home' | 'whatsapp' | 'instagram' | 'arrow' | 'phone' | 'at';

function PolicyIcon({ name, className = 'h-5 w-5' }: { name: PolicyIconName; className?: string }) {
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

  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="m4.5 11.2 7.5-6.5 7.5 6.5" />
        <path d="M6.6 10.6v8.8h10.8v-8.8" />
        <path d="M10 19.4v-5h4v5" />
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

  if (name === 'instagram') {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="4" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M16.2 7.8h.1" />
      </svg>
    );
  }

  if (name === 'arrow') {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }

  if (name === 'phone') {
    return (
      <svg {...common}>
        <path d="M7.4 4.7 9.2 4l2.2 4.8-1.5 1.1a10.2 10.2 0 0 0 4.2 4.2l1.1-1.5 4.8 2.2-.7 1.8a2.4 2.4 0 0 1-2.6 1.5A14.2 14.2 0 0 1 5.9 7.3a2.4 2.4 0 0 1 1.5-2.6Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 19a7 7 0 1 0-6.7-5" />
      <path d="M13.5 8.5h-2.2a3.2 3.2 0 0 0 0 6.4h2.2" />
      <path d="M14.8 8.5v6.4" />
    </svg>
  );
}

export default function PoliticasETrocasPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const {
    clientePerfil,
    isClienteLoggedIn,
    loadClienteProfile,
    logoutCliente,
    openClienteAuth,
  } = useClienteAuth();
  const publicCart = usePublicCart();
  const {
    badgeAnimating,
    cartItems,
    checkoutObservations,
    clearCart,
    isCartOpen,
    isSubmitting,
    openWhatsAppFallback,
    removeFromCart,
    setIsCartOpen,
    setCheckoutObservations,
    totalItems,
    totalPrice,
    updateCartQuantity,
    whatsappFallbackUrl,
    finalizeOnWhatsApp,
  } = publicCart;

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const openCart = () => setIsCartOpen(true);

    window.addEventListener('pastoril:open-cart', openCart);

    return () => window.removeEventListener('pastoril:open-cart', openCart);
  }, [setIsCartOpen]);

  const openStoreMenu = () => {
    setIsMenuOpen(true);
    if (isClienteLoggedIn) {
      void loadClienteProfile();
    }
  };

  const navigateHome = (target = '/') => {
    setIsMenuOpen(false);
    router.push(target);
  };

  const navigateCategory = (category: StoreMenuCategory['id']) => {
    const hash = category === 'todos' ? '#produtos' : '#categorias';
    navigateHome(`/${hash}`);
  };

  return (
    <div className="type-body min-h-screen bg-[var(--pastoril-bg)] pb-[calc(96px+env(safe-area-inset-bottom))] text-[var(--pastoril-text)]">
      <StoreHeader
        onCartToggle={() => setIsCartOpen(!isCartOpen)}
        onMenuOpen={openStoreMenu}
        totalItems={totalItems}
      />

      {isMenuOpen && (
        <StoreMenu
          categories={menuCategories}
          customerLabel={isClienteLoggedIn ? `Bem-vindo${clientePerfil?.nome ? `, ${clientePerfil.nome}` : ''}` : 'Entrar ou cadastrar'}
          customerDetail={isClienteLoggedIn ? 'Acesse seus pedidos e dados' : 'Acesse seus pedidos e favoritos'}
          isCategoriesOpen={isCategoriesOpen}
          isLoggedIn={isClienteLoggedIn}
          onCategoriesToggle={() => setIsCategoriesOpen((open) => !open)}
          onCategory={navigateCategory}
          onClose={() => setIsMenuOpen(false)}
          onCustomer={() => { setIsMenuOpen(false); openClienteAuth(); }}
          onHome={() => navigateHome('/')}
          onLogout={() => { setIsMenuOpen(false); void logoutCliente(); }}
          onNew={() => navigateHome('/#produtos')}
          onProducts={() => navigateHome('/#produtos')}
          onPromotion={() => navigateHome('/#produtos')}
        />
      )}

      <main className="relative overflow-hidden">
        <section className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
          <div className="mb-10 text-center sm:mb-12">
            <div className="mx-auto mb-6 flex max-w-[220px] items-center justify-center gap-3 text-[var(--pastoril-caramel)]" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--pastoril-border)]" />
              <span className="h-2 w-2 rotate-45 bg-current" />
              <span className="h-px flex-1 bg-[var(--pastoril-border)]" />
            </div>
            <h1 className="font-display text-[2rem] font-medium leading-tight text-[var(--pastoril-brown)] sm:text-[2.6rem]">
              Trocas e Devoluções
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--pastoril-text)] sm:text-lg">
              Prezamos pela sua satisfação. Confira abaixo nossas políticas de trocas e devoluções.
            </p>
          </div>

          <section aria-labelledby="regras-principais" className="rounded-2xl border border-[var(--pastoril-border)] bg-[var(--pastoril-card)]/45 px-5 py-2 sm:px-7 sm:py-4">
            <h2 id="regras-principais" className="sr-only">Regras principais</h2>
            <ol className="divide-y divide-[var(--pastoril-border)]">
              {mainRules.map((rule, index) => (
                <li key={rule} className="grid grid-cols-[56px_1fr] gap-4 py-5 sm:grid-cols-[72px_1fr] sm:gap-5 sm:py-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--pastoril-caramel)] font-display text-2xl text-[var(--pastoril-caramel)] sm:h-14 sm:w-14 sm:text-3xl" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p className="self-center text-base leading-7 text-[var(--pastoril-text)] sm:text-lg">
                    {rule}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="condicoes" className="mt-10 sm:mt-12">
            <h2 id="condicoes" className="sr-only">Condições e solicitações</h2>
            <div className="relative border-l border-[var(--pastoril-caramel)]/55 pl-7 sm:pl-9">
              {policySections.map((section) => (
                <article key={section.title} className="relative border-b border-[var(--pastoril-border)] py-4 first:pt-0 last:border-b-0">
                  <span className="absolute -left-[2.1rem] top-5 h-2.5 w-2.5 rotate-45 bg-[var(--pastoril-caramel)] sm:-left-[2.55rem]" aria-hidden="true" />
                  <h3 className="text-sm font-semibold uppercase leading-5 tracking-[0.18em] text-[var(--pastoril-caramel)] sm:text-base">
                    {section.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-[0.95rem] leading-7 text-[var(--pastoril-text)] sm:text-base">
                    {section.text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="contato" className="mt-9 sm:mt-12">
            <h2 id="contato" className="sr-only">Contato</h2>
            <div className="grid overflow-hidden rounded-2xl border border-[var(--pastoril-border)] bg-[var(--pastoril-card)]/40 sm:grid-cols-2">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 px-5 py-4 text-[var(--pastoril-text)] transition hover:bg-[var(--pastoril-soft)]/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pastoril-caramel)] sm:px-7">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--pastoril-caramel)] text-[var(--pastoril-caramel)]">
                  <PolicyIcon name="phone" className="h-6 w-6" />
                </span>
                <span>
                  <strong className="block font-medium">WhatsApp</strong>
                  <span className="block text-[var(--pastoril-text)]">+55 68 99924-4811</span>
                </span>
              </a>
              <a href="https://www.instagram.com/pastorilcountry/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 border-t border-[var(--pastoril-border)] px-5 py-4 text-[var(--pastoril-text)] transition hover:bg-[var(--pastoril-soft)]/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pastoril-caramel)] sm:border-l sm:border-t-0 sm:px-7">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--pastoril-caramel)] text-[var(--pastoril-caramel)]">
                  <PolicyIcon name="at" className="h-6 w-6" />
                </span>
                <span>
                  <strong className="block font-medium">Instagram</strong>
                  <span className="block text-[var(--pastoril-text)]">@pastorilcountry</span>
                </span>
              </a>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="type-button mx-auto mt-5 flex min-h-12 w-full max-w-xl items-center justify-center gap-4 rounded-xl border border-[var(--pastoril-caramel)] bg-transparent px-5 py-3 text-center uppercase tracking-[0.08em] text-[var(--pastoril-caramel)] transition hover:bg-[var(--pastoril-caramel)] hover:text-[var(--pastoril-on-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pastoril-caramel)]"
            >
              Falar no WhatsApp
              <PolicyIcon name="arrow" className="h-5 w-5" />
            </a>
          </section>
        </section>

        <PublicCart
          badgeAnimating={badgeAnimating}
          cartItems={cartItems}
          checkoutObservations={checkoutObservations}
          clearCart={clearCart}
          isCartOpen={isCartOpen}
          isSubmitting={isSubmitting}
          openWhatsAppFallback={openWhatsAppFallback}
          removeFromCart={removeFromCart}
          setIsCartOpen={setIsCartOpen}
          setCheckoutObservations={setCheckoutObservations}
          totalItems={totalItems}
          totalPrice={totalPrice}
          updateCartQuantity={updateCartQuantity}
          whatsappFallbackUrl={whatsappFallbackUrl}
          finalizeOnWhatsApp={finalizeOnWhatsApp}
        />
      </main>

      <footer className="border-t border-[var(--pastoril-border)] bg-[var(--pastoril-card)] px-4 py-2 text-center text-[11px] font-normal leading-tight text-[var(--pastoril-muted)]">
        <p>&copy; 2026 Pastoril Moda Country. Todos os direitos reservados.</p>
      </footer>

      <nav
        data-bottom-mobile-nav
        className={`fixed bottom-0 left-0 right-0 z-40 h-[calc(72px+env(safe-area-inset-bottom))] border-t border-[var(--pastoril-border)] bg-[var(--pastoril-card)]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_14px_var(--pastoril-shadow)] backdrop-blur ${isMenuOpen ? 'pointer-events-none invisible' : ''}`}
        aria-label="Navegação principal"
        aria-hidden={isMenuOpen}
      >
        <div className="mx-auto grid h-full max-w-[430px] grid-cols-5 items-start md:max-w-2xl md:items-center md:gap-5 md:px-4">
          <button
            type="button"
            onClick={openStoreMenu}
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[var(--pastoril-brown)]"
            aria-label="Abrir menu"
          >
            <PolicyIcon name="menu" className="h-[24px] w-[24px]" />
            <span>Menu</span>
          </button>
          <Link href="/" className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[var(--pastoril-brown)]">
            <PolicyIcon name="home" className="h-[24px] w-[24px]" />
            <span>Início</span>
          </Link>
          <ClienteAuthButton
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[var(--pastoril-brown)]"
            iconClassName="h-[24px] w-[24px]"
            labelClassName="block"
            showLabel
          />
          <a
            href={whatsappUrl}
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[var(--pastoril-caramel)]"
            target="_blank"
            rel="noreferrer"
          >
            <PolicyIcon name="whatsapp" className="h-[24px] w-[24px]" />
            <span>WhatsApp</span>
          </a>
          <a
            href="https://www.instagram.com/pastorilcountry/"
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[var(--pastoril-brown)]"
            target="_blank"
            rel="noreferrer"
          >
            <PolicyIcon name="instagram" className="h-[24px] w-[24px]" />
            <span>Instagram</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
