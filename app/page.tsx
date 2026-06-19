'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ClienteAuthButton } from '@/app/components/ClienteAuthButton';
import { useClienteAuth } from '@/app/components/ClienteAuthProvider';
import { PublicCart } from '@/app/components/PublicCart';
import { StoreHeader } from '@/app/components/StoreHeader';
import { homeBannerFrameClass } from '@/lib/banner-layout';
import { usePublicCart } from '@/lib/use-public-cart';
import {
  type Product,
  formatCurrency,
  getProductPrice,
} from '@/lib/catalog';

type MainBanner = {
  id: string;
  titulo: string | null;
  imagem_url: string | null;
  url?: string | null;
  imagem_desktop_url: string | null;
  imagem_mobile_url: string | null;
  principal: boolean;
  created_at?: string;
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
  | 'instagram'
  | 'male'
  | 'female'
  | 'child'
  | 'people'
  | 'pants'
  | 'accessory';

type MainCategoryId = 'masculino' | 'feminino' | 'infantil' | 'todos';
const PRODUCTS_PER_PAGE = 20;

const mainCategories: { id: MainCategoryId; label: string; icon: string; activeIcon: string }[] = [
  {
    id: 'masculino',
    label: 'Masculino',
    icon: '/brand/icons/categories/masculino.png',
    activeIcon: '/brand/icons/categories/masculino-active.png',
  },
  {
    id: 'feminino',
    label: 'Feminino',
    icon: '/brand/icons/categories/feminino.png',
    activeIcon: '/brand/icons/categories/feminino-active.png',
  },
  {
    id: 'infantil',
    label: 'Infantil',
    icon: '/brand/icons/categories/infantil.png',
    activeIcon: '/brand/icons/categories/infantil-active.png',
  },
  {
    id: 'todos',
    label: 'Todos',
    icon: '/brand/icons/categories/todos.png',
    activeIcon: '/brand/icons/categories/todos-active.png',
  },
];

const subcategories: { slug: string; label: string; groups: MainCategoryId[] }[] = [
  { slug: 'chapeus', label: 'Chapéus', groups: ['masculino', 'feminino', 'infantil'] },
  { slug: 'botas', label: 'Botas', groups: ['masculino', 'feminino', 'infantil'] },
  { slug: 'camisas', label: 'Camisas', groups: ['masculino', 'feminino', 'infantil'] },
  { slug: 'calcas', label: 'Calças', groups: ['masculino', 'feminino', 'infantil'] },
  { slug: 'cintos', label: 'Cintos', groups: ['masculino'] },
  { slug: 'acessorios', label: 'Acessórios', groups: ['feminino'] },
  { slug: 'promocoes', label: 'Promoções', groups: ['masculino', 'feminino', 'infantil'] },
];

const subcategoryAliases: Record<string, string[]> = {
  chapeus: ['chapeu', 'chapeus'],
  botas: ['bota', 'botas'],
  camisas: ['camisa', 'camisas'],
  calcas: ['calca', 'calcas'],
  cintos: ['cinto', 'cintos'],
  acessorios: ['acessorio', 'acessorios'],
};

const productCategoryHeaderClass = 'mb-3 flex items-center justify-between gap-3';
const productCategoryTitleClass = 'type-subtitle text-[var(--pastoril-brown)]';

function normalizeFilterValue(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function productMatchesMainCategory(product: Product, activeCategory: MainCategoryId) {
  if (activeCategory === 'todos') return true;

  const publicValue = normalizeFilterValue(product.publico);
  return publicValue === activeCategory;
}

function productMatchesSubcategory(product: Product, activeSubcategory: string) {
  if (!activeSubcategory || activeSubcategory === 'todos') return true;
  if (activeSubcategory === 'promocoes') return product.em_promocao;

  const aliases = subcategoryAliases[activeSubcategory] ?? [activeSubcategory];
  const categoryValue = normalizeFilterValue(product.categoria);
  const departmentValue = normalizeFilterValue(product.departamento);

  return aliases.some((alias) => categoryValue === alias || departmentValue === alias);
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

  if (name === 'pants') {
    return (
      <svg {...common}>
        <path d="M8.2 4.6h7.6l1.1 15h-4.1L12 9.7l-.8 9.9H7.1l1.1-15Z" />
        <path d="M8.5 7.6h7M12 4.8v4.9" />
      </svg>
    );
  }

  if (name === 'accessory') {
    return (
      <svg {...common}>
        <path d="M5.1 12.3c1.9-1.5 3.8-1.5 5.7 0 1.9 1.5 3.8 1.5 5.7 0" />
        <path d="M5.1 15.2c1.9-1.5 3.8-1.5 5.7 0 1.9 1.5 3.8 1.5 5.7 0" />
        <circle cx="18" cy="10.2" r="2" />
        <path d="M6.2 9.3h4.7" />
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

  if (name === 'male') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.2" />
        <path d="M7.2 9.6c1.7-1.1 1.9-3.2 4.8-3.2s3.1 2.1 4.8 3.2" />
        <path d="M5.8 10.8c3 1 9.4 1 12.4 0" />
        <path d="M8.8 10.7c1.1.5 5.3.5 6.4 0" />
        <path d="M9.5 12.2c.3 2 1.2 3.1 2.5 3.1s2.2-1.1 2.5-3.1" />
        <path d="M10.5 13.2h.1M13.4 13.2h.1" />
        <path d="M9 19.2v-1.4c.8-1 1.8-1.5 3-1.5s2.2.5 3 1.5v1.4" />
        <path d="M10.2 17.1 12 18.5l1.8-1.4" />
      </svg>
    );
  }

  if (name === 'female') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.2" />
        <path d="M7.2 9.7c1.5-1.2 2.2-3.3 4.9-3.3 2.4 0 3 1.8 4.6 3" />
        <path d="M6.2 10.8c2.7 1 8.1 1 11.6 0" />
        <path d="M10.2 11.2c-.5.8-.7 1.6-.5 2.5.3 1.2 1.2 2 2.3 2s2-.8 2.3-2" />
        <path d="M14.5 10.8c1.2.8 1.7 2.1 1.4 3.8" />
        <path d="M8.8 10.9c-.8 1.2-.8 2.8.1 4.5" />
        <path d="M9.2 16.3c.7-.6 1.6-.9 2.8-.9s2.1.3 2.8.9" />
        <path d="M10 18.9c.4-1.2 1-1.8 2-1.8s1.6.6 2 1.8" />
        <path d="M8.4 13.7c-.9.4-1.5 1.2-1.8 2.4M16 13.8c.7.4 1.2 1 1.4 1.9" />
      </svg>
    );
  }

  if (name === 'child') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.2" />
        <path d="M7.8 9.4c1.3-1 1.8-2.7 4.2-2.7s2.9 1.7 4.2 2.7" />
        <path d="M6.4 10.5c2.7.9 8.5.9 11.2 0" />
        <path d="M8.9 10.5c1 .4 5.2.4 6.2 0" />
        <path d="M9.7 12.1c.2 1.8 1.1 2.9 2.3 2.9s2.1-1.1 2.3-2.9" />
        <path d="M10.6 13h.1M13.3 13h.1" />
        <path d="M10.3 16.1c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6" />
        <path d="M8.5 19.1v-1.3c.9-.9 2-1.4 3.5-1.4s2.6.5 3.5 1.4v1.3" />
      </svg>
    );
  }

  if (name === 'people') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.2" />
        <path d="M4.8 8.7c1-.8 1.3-2.1 3-2.1s2 1.3 3 2.1" />
        <path d="M4.1 9.7c1.7.6 5.7.6 7.4 0" />
        <path d="M6.5 10.8c.1 1.2.6 1.9 1.3 1.9s1.2-.7 1.3-1.9" />
        <path d="M13.2 8.7c1-.8 1.3-2.1 3-2.1s2 1.3 3 2.1" />
        <path d="M12.5 9.7c1.7.6 5.7.6 7.4 0" />
        <path d="M14.9 10.8c.1 1.2.6 1.9 1.3 1.9s1.2-.7 1.3-1.9" />
        <path d="M8.9 13.2c.8-.6 1.1-1.6 3.1-1.6s2.3 1 3.1 1.6" />
        <path d="M7.9 14.1c1.9.6 6.3.6 8.2 0" />
        <path d="M10.5 15c.1 1.2.7 1.9 1.5 1.9s1.4-.7 1.5-1.9" />
        <path d="M5.4 19.2v-2.4c.5-.8 1.3-1.2 2.4-1.2.9 0 1.6.3 2 .8" />
        <path d="M18.6 19.2v-2.4c-.5-.8-1.3-1.2-2.4-1.2-.9 0-1.6.3-2 .8" />
        <path d="M9 19.2v-1.1c.7-.8 1.7-1.2 3-1.2s2.3.4 3 1.2v1.1" />
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

function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const currentPrice = getProductPrice(product);
  const hasPromotion = product.em_promocao && product.preco_promocional !== null;

  return (
    <Link
      href={`/produto/${product.id}`}
      aria-label={`Ver detalhes de ${product.nome}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--pastoril-border)] bg-[var(--pastoril-card)] shadow-[0_8px_18px_rgba(74,52,40,0.07)] transition md:hover:-translate-y-0.5 md:hover:shadow-[0_12px_24px_rgba(74,52,40,0.11)] sm:rounded-2xl"
    >
      <div className="relative aspect-[1.2/1] overflow-hidden bg-[var(--pastoril-soft)]">
        {hasPromotion && (
          <span className="type-helper absolute left-2 top-2 z-10 rounded-lg bg-[var(--pastoril-promo)] px-2 py-1 font-bold uppercase text-white shadow-sm sm:left-3 sm:top-3">
            Promo
          </span>
        )}
        {product.imagem_principal ? (
          <Image
            src={product.imagem_principal}
            alt={product.nome}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition duration-500 md:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="type-helper flex h-full items-center justify-center px-3 text-center text-[var(--pastoril-muted)]">
            Sem foto
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="type-product-name min-h-[2.25rem] transition md:group-hover:text-[var(--pastoril-caramel)] sm:min-h-[2.5rem]">
          {product.nome}
        </h3>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="type-price">
            {formatCurrency(currentPrice)}
          </p>
          {hasPromotion && (
            <p className="type-helper text-[var(--pastoril-muted)] line-through">
              {formatCurrency(product.preco)}
            </p>
          )}
        </div>

        <p className="type-helper mt-0.5 font-medium text-[var(--pastoril-muted)]">
          C&oacute;d. {product.codigo_produto}
        </p>

        <span className="type-button mt-auto flex min-h-12 items-end pt-2 text-[var(--pastoril-caramel)]">
          Ver detalhes
        </span>
      </div>
    </Link>
  );
}

function getBannerDesktopUrl(banner: MainBanner) {
  return banner.imagem_desktop_url || banner.imagem_mobile_url || banner.imagem_url || banner.url || '';
}

function getBannerMobileUrl(banner: MainBanner) {
  return banner.imagem_mobile_url || banner.imagem_desktop_url || banner.imagem_url || banner.url || '';
}

function BannerCarousel({ banners, loading }: { banners: MainBanner[]; loading: boolean }) {
  const validBanners = useMemo(
    () => banners.filter((banner) => getBannerDesktopUrl(banner) || getBannerMobileUrl(banner)),
    [banners],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [previousImageUrl, setPreviousImageUrl] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const lastImageUrlRef = useRef<string | null>(null);
  const hasMultipleBanners = validBanners.length > 1;
  const activeBanner = validBanners[currentIndex] ?? validBanners[0];
  const desktopUrl =
    activeBanner?.imagem_desktop_url?.trim() ||
    activeBanner?.imagem_mobile_url?.trim() ||
    activeBanner?.imagem_url?.trim() ||
    activeBanner?.url?.trim() ||
    '';
  const mobileUrl =
    activeBanner?.imagem_mobile_url?.trim() ||
    desktopUrl;
  const activeImageUrl = isMobile ? mobileUrl : desktopUrl;

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[home-banners-carousel]', {
        received: banners.length,
        renderedSlides: validBanners.length,
        currentIndex,
      });
    }
  }, [banners.length, currentIndex, validBanners.length]);

  useEffect(() => {
    if (validBanners.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((index) => (index >= validBanners.length ? 0 : index));
  }, [validBanners.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateIsMobile = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);

    return () => {
      mediaQuery.removeEventListener('change', updateIsMobile);
    };
  }, []);

  useEffect(() => {
    if (!activeImageUrl) return;

    const lastImageUrl = lastImageUrlRef.current;

    if (!lastImageUrl) {
      lastImageUrlRef.current = activeImageUrl;
      setPreviousImageUrl(activeImageUrl);
      setIsTransitioning(false);
      return;
    }

    if (lastImageUrl === activeImageUrl) {
      return;
    }

    setPreviousImageUrl(lastImageUrl);
    setIsTransitioning(true);

    const timeout = window.setTimeout(() => {
      lastImageUrlRef.current = activeImageUrl;
      setPreviousImageUrl(activeImageUrl);
      setIsTransitioning(false);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [activeImageUrl]);

  useEffect(() => {
    if (!hasMultipleBanners) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % validBanners.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [hasMultipleBanners, validBanners.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToRelativeSlide = (direction: 1 | -1) => {
    setCurrentIndex((index) => (index + direction + validBanners.length) % validBanners.length);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!hasMultipleBanners) return;
    dragStartX.current = event.clientX;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!hasMultipleBanners || dragStartX.current === null) return;

    const distance = event.clientX - dragStartX.current;
    dragStartX.current = null;

    if (Math.abs(distance) < 42) return;

    goToRelativeSlide(distance < 0 ? 1 : -1);
  };

  if (loading) {
    return (
      <div
        className="h-full min-h-[inherit] w-full rounded-[inherit] bg-[linear-gradient(135deg,#EFE6DB,#FFFFFF)] md:aspect-[2.55/1] md:min-h-0 lg:aspect-auto"
        aria-label="Carregando banners"
      />
    );
  }

  if (validBanners.length === 0) {
    return <div className="h-full min-h-[inherit] w-full rounded-[inherit] bg-[linear-gradient(135deg,#EFE6DB,#FFFFFF)] md:aspect-[2.55/1] md:min-h-0 lg:aspect-auto" aria-label="Banner Pastoril Moda Country" />;
  }

  return (
    <div
      data-banner-carousel
      className="relative h-full min-h-[inherit] w-full overflow-hidden rounded-[inherit]"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartX.current = null;
      }}
    >
      {activeBanner && activeImageUrl && (
        <div
          key={`banner-container-${activeBanner.id}-${currentIndex}`}
          className="relative h-full min-h-[inherit] w-full overflow-hidden rounded-[inherit] bg-[#F9F6F1] md:aspect-[2.55/1] md:min-h-0 lg:aspect-auto"
        >
          {previousImageUrl && previousImageUrl !== activeImageUrl && (
            <img
              src={previousImageUrl}
              alt=""
              aria-hidden="true"
              className="banner-image-exit absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
            />
          )}

          <img
            key={`${activeBanner.id}-${currentIndex}-${activeImageUrl}`}
            src={activeImageUrl}
            alt={activeBanner.titulo || 'Banner Pastoril Moda Country'}
            className={`absolute inset-0 h-full w-full object-cover object-center ${
              isTransitioning ? 'banner-image-enter' : ''
            }`}
            draggable={false}
          />
        </div>
      )}

      {hasMultipleBanners && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {validBanners.map((banner, index) => (
            <button
              key={banner.id}
              data-banner-indicator
              type="button"
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                currentIndex === index ? 'w-6 bg-[var(--pastoril-caramel)]' : 'w-2 bg-white/75 shadow-[0_0_0_1px_rgba(74,45,26,0.12)]'
              }`}
              aria-label={`Ir para banner ${index + 1}`}
              aria-current={currentIndex === index ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [banners, setBanners] = useState<MainBanner[]>([]);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MainCategoryId>('todos');
  const [activeSubcategory, setActiveSubcategory] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const productsSectionRef = useRef<HTMLElement | null>(null);
  const productCarouselRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { openClienteAuth } = useClienteAuth();
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
    const fetchBanners = async () => {
      try {
        setLoadingBanners(true);
        const response = await fetch('/api/banners/principal', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          return;
        }

        const loadedBanners = Array.isArray(data.banners) ? data.banners : [];

        if (process.env.NODE_ENV !== 'production') {
          console.info('[home-banners-fetch]', { count: loadedBanners.length });
        }

        setBanners(loadedBanners);
      } catch {
        setBanners([]);
      } finally {
        setLoadingBanners(false);
      }
    };

    fetchBanners();
  }, []);

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

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          productMatchesMainCategory(product, activeCategory) &&
          productMatchesSubcategory(product, activeSubcategory),
      ),
    [activeCategory, activeSubcategory, products],
  );
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const visibleCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const startIndex = (visibleCurrentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [visibleCurrentPage, filteredProducts]);
  const productCarouselGroups = useMemo(
    () =>
      subcategories
        .map((subcategory) => ({
          ...subcategory,
          products: products.filter(
            (product) =>
              productMatchesMainCategory(product, activeCategory) &&
              productMatchesSubcategory(product, subcategory.slug),
          ),
        }))
        .filter((group) => group.products.length > 0),
    [activeCategory, products],
  );
  const selectedSubcategoryLabel =
    subcategories.find((subcategory) => subcategory.slug === activeSubcategory)?.label ?? 'Destaques';
  const productsTitle = activeSubcategory === 'todos' ? 'Destaques' : selectedSubcategoryLabel;
  const hasVisibleProducts =
    activeSubcategory === 'todos' ? productCarouselGroups.length > 0 : filteredProducts.length > 0;

  const goToProductsPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    window.requestAnimationFrame(() => {
      productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollProductCarousel = (slug: string, direction: -1 | 1) => {
    productCarouselRefs.current[slug]?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  const scrollToProducts = () => {
    window.requestAnimationFrame(() => {
      productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const selectMainCategoryFromMenu = (category: MainCategoryId) => {
    setActiveCategory(category);
    setActiveSubcategory('todos');
    setCurrentPage(1);
    setIsMenuOpen(false);
    scrollToProducts();
  };

  const goHomeFromMenu = () => {
    setActiveCategory('todos');
    setActiveSubcategory('todos');
    setCurrentPage(1);
    setIsMenuOpen(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div className="type-body min-h-screen bg-[var(--pastoril-bg)] pb-[calc(96px+env(safe-area-inset-bottom))] text-[var(--pastoril-text)]">
      <StoreHeader
        onCartToggle={() => setIsCartOpen(!isCartOpen)}
        onMenuOpen={() => setIsMenuOpen(true)}
        totalItems={totalItems}
      />

      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-50 bg-black/30"
          />

          <aside
            className="fixed inset-y-0 left-0 z-[60] w-[82%] max-w-[340px] animate-[slideInMenu_220ms_ease-out] overflow-hidden border-r border-[#D9B88F]/25 bg-[#F9F6F1] shadow-xl md:max-w-[360px]"
            aria-label="Menu principal"
          >
            <div
              className="absolute inset-0 bg-cover bg-[position:center_bottom] bg-no-repeat opacity-70"
              style={{ backgroundImage: "url('/brand/menu/sidebar-menu-bg.png')" }}
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-full flex-col">
              <div className="relative flex items-center justify-center border-b border-[#F3E4D4]/18 px-14 pb-5 pt-6">
                <Image
                  src="/brand/pastoril-logo-header.png"
                  alt="Pastoril Moda Country"
                  width={140}
                  height={80}
                  priority
                  unoptimized
                  className="h-auto w-[120px] object-contain md:w-[140px]"
                />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-xl leading-none text-[#4A2D1A] transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]"
                  aria-label="Fechar menu"
                >
                  x
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-3" aria-label="Links do menu">
                <button
                  type="button"
                  onClick={goHomeFromMenu}
                  className="type-button flex min-h-12 w-full items-center border-b border-[#F3E4D4]/16 bg-transparent px-2 py-3 text-left text-[#4A2D1A] transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]"
                >
                  Início
                </button>

                {mainCategories
                  .filter((category) => category.id !== 'todos')
                  .map((category) => {
                    const isActive = activeCategory === category.id;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => selectMainCategoryFromMenu(category.id)}
                        className={`type-button flex min-h-12 w-full items-center border-b border-[#F3E4D4]/16 bg-transparent px-2 py-3 text-left transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C] ${
                          isActive ? 'text-[#C8722C]' : 'text-[#4A2D1A]'
                        }`}
                      >
                        {category.label}
                      </button>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory('todos');
                    setActiveSubcategory('promocoes');
                    setCurrentPage(1);
                    setIsMenuOpen(false);
                    scrollToProducts();
                  }}
                  className={`type-button flex min-h-12 w-full items-center border-b border-[#F3E4D4]/16 bg-transparent px-2 py-3 text-left transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C] ${
                    activeSubcategory === 'promocoes' ? 'text-[#C8722C]' : 'text-[#4A2D1A]'
                  }`}
                >
                  Promoções
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    scrollToProducts();
                  }}
                  className="type-button flex min-h-12 w-full items-center border-b border-[#F3E4D4]/16 bg-transparent px-2 py-3 text-left text-[#4A2D1A] transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]"
                >
                  Buscar produtos
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCartOpen(true);
                  }}
                  className="type-button flex min-h-12 w-full items-center border-b border-[#F3E4D4]/16 bg-transparent px-2 py-3 text-left text-[#4A2D1A] transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]"
                >
                  Carrinho
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    openClienteAuth();
                  }}
                  className="type-button flex min-h-12 w-full items-center border-b border-[#F3E4D4]/16 px-2 py-3 text-left text-[#4A2D1A] transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]"
                >
                  Minha conta
                </button>

                <Link
                  href="/quem-somos"
                  onClick={() => setIsMenuOpen(false)}
                  className="type-button flex min-h-12 w-full items-center px-2 py-3 text-left text-[#4A2D1A] transition hover:text-[#C8722C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]"
                >
                  Quem somos
                </Link>
              </nav>
            </div>
          </aside>
        </>
      )}

      <main>
        <section className="px-1 pt-0 sm:px-2 md:px-8 md:pt-1 lg:px-0">
          <div className="w-full">
            <div className={homeBannerFrameClass}>
              <BannerCarousel banners={banners} loading={loadingBanners} />
            </div>
          </div>
        </section>

        <section id="categorias" className="py-3 sm:py-4">
          <div className="mx-auto max-w-7xl px-3 sm:px-8 lg:px-8">
            <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
              <div className="mx-auto flex min-w-max justify-center gap-5 border-b border-[#D8C7B8] pb-2 sm:min-w-0 sm:gap-9 lg:gap-12">
                {mainCategories.map((category) => {
                  const isActive = activeCategory === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(category.id);
                        setActiveSubcategory('todos');
                        setCurrentPage(1);
                      }}
                      className={`group relative flex min-w-[64px] flex-col items-center gap-0 bg-transparent pb-1 text-center transition md:hover:text-[#C8722C] ${
                        isActive ? 'text-[#C8722C]' : 'text-[#6E625A]'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="relative flex h-[72px] w-[72px] items-center justify-center md:h-[84px] md:w-[84px]">
                        <Image
                          src={isActive ? category.activeIcon : category.icon}
                          alt={category.label}
                          fill
                          sizes="64px"
                          className="object-contain p-1"
                        />
                      </span>
                      <span className={`type-button -mt-2.5 text-[11px] sm:text-xs ${isActive ? 'text-[#4A2D1A]' : 'text-[#6E625A]'}`}>
                        {category.label}
                      </span>
                      <span
                        className={`absolute bottom-[-9px] left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#C8722C] transition ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="-mx-3 mt-2 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
              <div className="mx-auto flex min-w-max justify-center gap-5 sm:min-w-0 sm:flex-wrap sm:gap-x-8 sm:gap-y-2 lg:gap-x-10">
                {[{ slug: 'todos', label: 'Todos' }, ...subcategories].map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => {
                      setActiveSubcategory(category.slug);
                      setCurrentPage(1);
                    }}
                    className={`type-button relative min-h-8 whitespace-nowrap bg-transparent px-2 py-2 text-[11px] transition-colors sm:text-xs ${
                      activeSubcategory === category.slug
                        ? 'font-semibold text-[#4A2D1A]'
                        : 'text-[#6E625A] md:hover:text-[#4A2D1A]'
                    }`}
                    aria-pressed={activeSubcategory === category.slug}
                  >
                    {category.label}
                    {activeSubcategory === category.slug && (
                      <span className="absolute bottom-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-[#C8722C] transition-all duration-200" />
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        <div className="mx-auto max-w-7xl border-t border-[var(--pastoril-border)] px-5 py-5 sm:px-8 sm:py-8 lg:px-8">
          <section id="produtos" ref={productsSectionRef}>
            {activeSubcategory !== 'todos' && (
              <div className={productCategoryHeaderClass}>
                <h2 className={productCategoryTitleClass}>{productsTitle}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubcategory('todos');
                    setCurrentPage(1);
                  }}
                  className="type-button inline-flex items-center gap-1 text-[var(--pastoril-caramel)]"
                >
                  Ver todos
                  <Icon name="chevron" className="h-4 w-4" />
                </button>
              </div>
            )}

            {loadingProducts ? (
              <div className="type-body rounded-2xl border border-[var(--pastoril-border)] bg-white px-6 py-12 text-center text-[var(--pastoril-muted)]">
                Carregando produtos...
              </div>
            ) : productsError ? (
              <div className="type-body rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-700">
                {productsError}
              </div>
            ) : !hasVisibleProducts ? (
              <div className="type-body rounded-2xl border border-[var(--pastoril-border)] bg-white px-6 py-12 text-center text-[var(--pastoril-muted)]">
                Nenhum produto disponível no momento.
              </div>
            ) : activeSubcategory === 'todos' ? (
              <div className="space-y-7">
                {productCarouselGroups.map((group, groupIndex) => (
                  <section key={group.slug} aria-label={group.label}>
                    <div className={productCategoryHeaderClass}>
                      <h3 className={productCategoryTitleClass}>{group.label}</h3>
                      <div className="hidden gap-2 md:flex">
                        <button
                          type="button"
                          onClick={() => scrollProductCarousel(group.slug, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E2D2C1] bg-transparent text-[#6E625A] transition hover:border-[#C8722C] hover:text-[#4A2D1A]"
                          aria-label={`Ver produtos anteriores de ${group.label}`}
                        >
                          <Icon name="chevron" className="h-4 w-4 rotate-180" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollProductCarousel(group.slug, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E2D2C1] bg-transparent text-[#6E625A] transition hover:border-[#C8722C] hover:text-[#4A2D1A]"
                          aria-label={`Ver próximos produtos de ${group.label}`}
                        >
                          <Icon name="chevron" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={(node) => {
                        productCarouselRefs.current[group.slug] = node;
                      }}
                      className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-3 scroll-smooth sm:-mx-8 sm:gap-5 sm:px-8 lg:mx-0 lg:px-0"
                    >
                      {group.products.map((product, index) => (
                        <div
                          key={product.id}
                          className="w-[calc((100vw-52px)/2)] shrink-0 snap-start sm:w-[calc((100vw-104px)/3)] xl:w-[calc((100vw-12rem)/4)] 2xl:w-[305px]"
                        >
                          <ProductCard
                            product={product}
                            priority={groupIndex === 0 && index < 4}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
                  {paginatedProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      priority={visibleCurrentPage === 1 && index < 4}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => goToProductsPage(visibleCurrentPage - 1)}
                      disabled={visibleCurrentPage === 1}
                      className="type-button rounded-full border border-[#E2D2C1] bg-transparent px-4 py-2 text-[#6E625A] transition disabled:cursor-not-allowed disabled:opacity-45 md:hover:border-[#C8722C] md:hover:text-[#4A2D1A]"
                    >
                      Anterior
                    </button>
                    <span className="type-helper text-[#6E625A]">
                      {visibleCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToProductsPage(visibleCurrentPage + 1)}
                      disabled={visibleCurrentPage === totalPages}
                      className="type-button rounded-full border border-[#E2D2C1] bg-transparent px-4 py-2 text-[#6E625A] transition disabled:cursor-not-allowed disabled:opacity-45 md:hover:border-[#C8722C] md:hover:text-[#4A2D1A]"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}
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
        </div>
      </main>

      <footer className="border-t border-[#E7E0D8] bg-[#F9F6F1] px-4 py-2 text-center text-[11px] font-normal leading-tight text-[#8A7A6E]">
        <p>&copy; 2026 Pastoril Moda Country. Todos os direitos reservados.</p>
      </footer>

      <nav
        data-bottom-mobile-nav
        className="fixed bottom-0 left-0 right-0 z-40 h-[calc(72px+env(safe-area-inset-bottom))] border-t border-[#E7E0D8] bg-[#F9F6F1]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_14px_rgba(74,45,26,0.08)] backdrop-blur"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid h-full max-w-[430px] grid-cols-6 items-start md:max-w-2xl md:items-center md:gap-5 md:px-4">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[#4A2D1A]"
            aria-label="Abrir menu"
          >
            <Icon name="menu" className="h-[24px] w-[24px]" />
            <span>Menu</span>
          </button>
          <a href="#" className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[#C8722C]">
            <Icon name="home" className="h-[24px] w-[24px]" />
            <span>Início</span>
          </a>
          <a href="#categorias" className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[#4A2D1A]">
            <Icon name="grid" className="h-[24px] w-[24px]" />
            <span>Categorias</span>
          </a>
          <ClienteAuthButton
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[#4A2D1A]"
            iconClassName="h-[24px] w-[24px]"
            labelClassName="block"
            showLabel
          />
          <a
            href="https://wa.me/5568999244811"
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[#4A2D1A]"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="whatsapp" className="h-[24px] w-[24px]" />
            <span>WhatsApp</span>
          </a>
          <a
            href="https://www.instagram.com/pastorilcountry/"
            className="type-bottom-menu flex min-h-[56px] flex-col items-center justify-center gap-1 text-[#4A2D1A]"
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
