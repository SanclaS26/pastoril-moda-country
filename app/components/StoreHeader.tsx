'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ClienteAuthButton } from '@/app/components/ClienteAuthButton';

type StoreHeaderIconName = 'menu' | 'search' | 'cart';

function StoreHeaderIcon({ name, className = 'h-5 w-5' }: { name: StoreHeaderIconName; className?: string }) {
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

  return (
    <svg {...common}>
      <path d="M3.5 4.8h2.1l2 10.2h9.8l2.1-7.2H7.1" />
      <path d="M8 15h9.3" />
      <circle cx="9" cy="19.4" r="1.35" />
      <circle cx="17.2" cy="19.4" r="1.35" />
    </svg>
  );
}

type StoreHeaderProps = {
  onCartToggle: () => void;
  onMenuOpen?: () => void;
  totalItems: number;
};

export function StoreHeader({ onCartToggle, onMenuOpen, totalItems }: StoreHeaderProps) {
  return (
    <header className="relative bg-[var(--pastoril-header)] shadow-[0_5px_18px_var(--pastoril-shadow)]">
      <div className="relative z-30 mx-auto grid h-[72px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-[82px] sm:px-6 lg:px-8">
        <div className="flex items-center justify-start">
          {onMenuOpen ? (
            <button
              type="button"
              onClick={onMenuOpen}
              className="store-header-action flex h-8 w-8 items-center justify-center bg-transparent transition sm:h-9 sm:w-9"
              aria-label="Abrir menu"
            >
              <StoreHeaderIcon name="menu" className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>
          ) : (
            <Link
              href="/#categorias"
              className="store-header-action flex h-8 w-8 items-center justify-center bg-transparent transition sm:h-9 sm:w-9"
              aria-label="Abrir categorias"
            >
              <StoreHeaderIcon name="menu" className="h-6 w-6 sm:h-7 sm:w-7" />
            </Link>
          )}
        </div>

        <Link href="/" className="relative z-20 flex h-[68px] items-center justify-center sm:h-[78px]" aria-label="Pastoril Moda Country">
          <Image
            src="/brand/pastoril-logo-header.png"
            alt="Pastoril Moda Country"
            width={120}
            height={80}
            sizes="(min-width: 640px) 95px, 70px"
            priority
            unoptimized
            className="h-[64px] w-auto object-contain sm:h-[74px]"
          />
        </Link>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/#produtos"
            className="store-header-action flex h-8 w-8 items-center justify-center bg-transparent transition sm:h-9 sm:w-9"
            aria-label="Buscar produtos"
          >
            <StoreHeaderIcon name="search" className="h-6 w-6 sm:h-7 sm:w-7" />
          </Link>
          <ClienteAuthButton
            className="store-header-action flex h-8 w-8 items-center justify-center bg-transparent transition sm:h-9 sm:w-9"
            iconClassName="h-6 w-6 sm:h-7 sm:w-7"
          />
          <button
            onClick={onCartToggle}
            className="store-header-action relative flex h-8 w-8 items-center justify-center bg-transparent transition sm:h-9 sm:w-9"
            aria-label="Abrir carrinho"
          >
            <StoreHeaderIcon name="cart" className="h-6 w-6 sm:h-7 sm:w-7" />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--pastoril-caramel)] px-1 text-[0.65rem] font-bold text-[var(--pastoril-on-dark)]">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

    </header>
  );
}
