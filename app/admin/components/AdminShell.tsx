'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export type AdminNavKey = 'dashboard' | 'produtos' | 'usuarios' | 'clientes' | 'vendas' | 'carrinhos' | 'wishlists' | 'erp' | 'banners';

type AdminShellProps = {
  title: string;
  subtitle?: string;
  active: AdminNavKey;
  children: ReactNode;
};

type IconName = 'menu' | 'home' | 'box' | 'users' | 'image' | 'logout' | 'bell' | 'chevron' | 'heart' | 'plug';

const navItems: { key: AdminNavKey; label: string; href: string; icon: IconName; subItem?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'home' },
  { key: 'produtos', label: 'Produtos', href: '/admin/produtos', icon: 'box' },
  { key: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: 'users' },
  { key: 'clientes', label: 'Clientes', href: '/admin/clientes', icon: 'users' },
  { key: 'vendas', label: 'Vendas', href: '/admin/vendas', icon: 'box' },
  { key: 'carrinhos', label: 'Carrinhos abertos', href: '/admin/vendas/carrinhos-abertos', icon: 'box' },
  { key: 'wishlists', label: 'Listas de desejos', href: '/admin/listas-de-desejos', icon: 'heart' },
  { key: 'erp', label: 'Integrações ERP', href: '/admin/integracoes/erp', icon: 'plug' },
  { key: 'banners', label: 'Banners', href: '/admin/banners', icon: 'image' },
];

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.55,
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

  if (name === 'box') {
    return (
      <svg {...common}>
        <path d="m4.8 8.4 7.2-4 7.2 4-7.2 4-7.2-4Z" />
        <path d="M4.8 8.4v7.8l7.2 4 7.2-4V8.4" />
        <path d="M12 12.4v7.8" />
      </svg>
    );
  }

  if (name === 'users') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" />
        <path d="M16 10.2a2.5 2.5 0 1 0-1.2-4.7" />
        <path d="M16.4 14.4A4.3 4.3 0 0 1 20.2 19" />
      </svg>
    );
  }

  if (name === 'image') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="14" rx="2.5" />
        <path d="m7.5 15 3-3 2.2 2.2 2.2-2.9 3.6 4.7" />
        <circle cx="8.8" cy="9.2" r="1.2" />
      </svg>
    );
  }

  if (name === 'heart') {
    return (
      <svg {...common}>
        <path d="M20.4 8.7c0 4.8-8.4 10-8.4 10s-8.4-5.2-8.4-10A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8.4 1.4Z" />
      </svg>
    );
  }

  if (name === 'plug') {
    return (
      <svg {...common}>
        <path d="M8.5 7.5 6 5" />
        <path d="M15.5 7.5 18 5" />
        <path d="M7.5 8.5h9v4.2a4.5 4.5 0 0 1-9 0V8.5Z" />
        <path d="M12 17.2V21" />
      </svg>
    );
  }

  if (name === 'logout') {
    return (
      <svg {...common}>
        <path d="M9.5 5H6.8A2.8 2.8 0 0 0 4 7.8v8.4A2.8 2.8 0 0 0 6.8 19h2.7" />
        <path d="M14 8.5 17.5 12 14 15.5" />
        <path d="M9.5 12h8" />
      </svg>
    );
  }

  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M6.8 10.8a5.2 5.2 0 0 1 10.4 0c0 4.2 1.8 5.3 1.8 5.3H5s1.8-1.1 1.8-5.3Z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function AdminShell({ title, subtitle, active, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@pastoril.com');

  useEffect(() => {
    let activeRequest = true;

    const loadAdmin = async () => {
      const { data } = await supabase.auth.getSession();
      if (activeRequest && data.session?.user.email) {
        setAdminEmail(data.session.user.email);
      }
    };

    void loadAdmin();

    return () => {
      activeRequest = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  const renderNavigation = () => (
    <nav className="flex-1 space-y-1.5 px-4 py-5">
      {navItems.map((item) => {
        const isActive = active === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${item.subItem ? 'ml-5 py-2.5 text-xs' : ''} ${
              isActive
                ? 'bg-[#C8722C] text-white shadow-[0_8px_18px_rgba(200,114,44,0.18)]'
                : 'text-[#4A2D1A] hover:bg-[#F7F0E7]'
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F9F6F1] text-[#241C17]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#241C17]/35 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-hidden border-r border-[#E7E0D8] shadow-[14px_0_35px_rgba(74,45,26,0.08)] transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundImage: "url('/brand/admin/sidebar-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-[#F9F6F1]/58" aria-hidden="true" />

        <div className="relative z-10 flex h-[104px] items-center justify-center border-b border-[#E7E0D8]/80 px-6">
          <Link href="/admin" className="relative h-[76px] w-[116px]" aria-label="Pastoril Admin">
            <Image
              src="/brand/pastoril-logo-header.png"
              alt="Pastoril Moda Country"
              fill
              sizes="116px"
              priority={pathname === '/admin'}
              className="object-contain"
            />
          </Link>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {renderNavigation()}
        </div>

        <div className="relative z-10 mt-auto border-t border-[#E7E0D8]/80 bg-[#F9F6F1]/25 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-[#4A2D1A] transition hover:bg-white/65"
          >
            <Icon name="logout" className="h-5 w-5" />
            Sair
          </button>
          <p className="mt-5 px-2 text-xs text-[#6E625A]">Pastoril Moda Country © 2026</p>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-[#E7E0D8] bg-[#F9F6F1]/95 backdrop-blur">
          <div className="flex min-h-[78px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4A2D1A] transition hover:bg-[#F7F0E7] lg:hidden"
                aria-label="Abrir menu"
              >
                <Icon name="menu" className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-[#241C17]">{title}</h1>
                {subtitle && <p className="mt-0.5 hidden text-sm text-[#6E625A] sm:block">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#E7E0D8] bg-white text-[#4A2D1A] sm:flex" aria-label="Notificacoes">
                <Icon name="bell" className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 rounded-full border border-[#E7E0D8] bg-white px-2 py-2 pl-2 shadow-[0_6px_16px_rgba(74,45,26,0.04)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F0E7] text-sm font-black text-[#C8722C]">
                  A
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="text-sm font-bold leading-tight text-[#241C17]">Administrador</p>
                  <p className="max-w-[170px] truncate text-xs text-[#6E625A]">{adminEmail}</p>
                </div>
                <Icon name="chevron" className="hidden h-4 w-4 text-[#6E625A] sm:block" />
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 sm:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
