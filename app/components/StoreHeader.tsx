'use client';

import Image from 'next/image';
import Link from 'next/link';

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
  totalItems: number;
};

export function StoreHeader({ onCartToggle, totalItems }: StoreHeaderProps) {
  return (
    <header className="relative isolate overflow-hidden border-b border-[#9C5C29] bg-[#C8722C] bg-[url('/brand/header/header-bg-mobile.png')] bg-cover bg-[position:center_42%] bg-no-repeat before:absolute before:inset-0 before:z-0 before:bg-[rgba(74,45,26,0.12)] md:bg-[url('/brand/header/header-bg-desktop.png')] md:bg-center">
      <div className="relative z-10 mx-auto grid h-[55px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-[68px] sm:px-6 lg:px-8">
        <div className="flex items-center justify-start">
          <Link
            href="/#categorias"
            className="flex h-8 w-8 items-center justify-center bg-transparent text-[#FFF8F0] transition hover:text-white sm:h-9 sm:w-9"
            aria-label="Abrir categorias"
          >
            <StoreHeaderIcon name="menu" className="h-6 w-6 sm:h-7 sm:w-7" />
          </Link>
        </div>

        <Link href="/" className="relative z-20 flex h-[49px] items-center justify-center sm:h-[65px]" aria-label="Pastoril Moda Country">
          <Image
            src="/brand/pastoril-logo-header.png"
            alt="Pastoril Moda Country"
            width={120}
            height={80}
            sizes="(min-width: 640px) 95px, 70px"
            priority
            unoptimized
            className="h-[49px] w-auto object-contain sm:h-[65px]"
          />
        </Link>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/#produtos"
            className="flex h-8 w-8 items-center justify-center bg-transparent text-[#FFF8F0] transition hover:text-white sm:h-9 sm:w-9"
            aria-label="Buscar produtos"
          >
            <StoreHeaderIcon name="search" className="h-6 w-6 sm:h-7 sm:w-7" />
          </Link>
          <button
            onClick={onCartToggle}
            className="relative flex h-8 w-8 items-center justify-center bg-transparent text-[#FFF8F0] transition hover:text-white sm:h-9 sm:w-9"
            aria-label="Abrir carrinho"
          >
            <StoreHeaderIcon name="cart" className="h-6 w-6 sm:h-7 sm:w-7" />
            {totalItems > 0 && (
              <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4A2D1A] px-1 text-[0.65rem] font-bold text-[#FFF8F0]">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
