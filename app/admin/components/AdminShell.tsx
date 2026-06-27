'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export type AdminNavKey = 'dashboard' | 'produtos' | 'categorias' | 'marcas' | 'usuarios' | 'clientes' | 'vendas' | 'carrinhos' | 'wishlists' | 'erp' | 'banners';

type AdminShellProps = {
  title: string;
  subtitle?: string;
  active: AdminNavKey;
  children: ReactNode;
};

type IconName = 'menu' | 'home' | 'box' | 'users' | 'image' | 'logout' | 'bell' | 'chevron' | 'heart' | 'plug' | 'sun' | 'moon';
type AdminTheme = 'light' | 'dark';
const ADMIN_THEME_STORAGE_KEY = 'pastoril-admin-theme';

const navItems: { key: AdminNavKey; label: string; href: string; icon: IconName; subItem?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'home' },
  { key: 'produtos', label: 'Produtos', href: '/admin/produtos', icon: 'box' },
  { key: 'categorias', label: 'Categorias', href: '/admin/cadastros/categorias', icon: 'box', subItem: true },
  { key: 'marcas', label: 'Marcas', href: '/admin/cadastros/marcas', icon: 'box', subItem: true },
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

  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    );
  }

  if (name === 'moon') {
    return (
      <svg {...common}>
        <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4 8.2 8.2 0 1 0 20 15.2Z" />
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
  const [theme, setTheme] = useState<AdminTheme>('light');

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const initialTheme = document.getElementById('admin-theme-root')?.classList.contains('admin-theme-dark') ? 'dark' : 'light';
        setTheme(initialTheme);
      } catch {
        // O painel continua em modo claro quando o armazenamento estiver indisponível.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const changeTheme = (nextTheme: AdminTheme) => {
    setTheme(nextTheme);
    const root = document.getElementById('admin-theme-root');
    root?.classList.remove('admin-theme-light', 'admin-theme-dark');
    root?.classList.add(`admin-theme-${nextTheme}`);
    try {
      window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // A alternância ainda funciona durante a sessão.
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  const renderNavigation = () => (
    <nav className="space-y-1.5 px-4 pb-8 pt-5">
      <p className="px-4 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#8B7768]">Menu</p>
      {navItems.map((item, index) => {
        const isActive = active === item.key;

        return (
          <div key={item.key}>
          {index === 2 && <p className="px-4 pb-1 pt-4 text-[10px] font-black uppercase tracking-[0.22em] text-[#8B7768]">Cadastros</p>}
          <Link
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`admin-sidebar-link flex items-center gap-3 rounded-lg px-4 py-3 text-[13px] font-medium transition-colors duration-200 ${item.subItem ? 'ml-5 py-2.5 text-[12px]' : ''} ${
              isActive
                ? 'admin-sidebar-link-selected bg-[#C8722C] text-white shadow-[0_8px_18px_rgba(200,114,44,0.18)]'
                : 'admin-sidebar-link-idle text-[color:var(--admin-text)] hover:bg-[color:var(--admin-surface-soft)]'
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="admin-theme-shell min-h-screen bg-[color:var(--admin-bg)] text-[color:var(--admin-text)]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[color:var(--admin-overlay)] lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[260px] flex-col overflow-hidden border-r border-[color:var(--admin-border)] bg-[color:var(--admin-bg)] shadow-[14px_0_35px_rgba(74,45,26,0.08)] transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative z-10 flex h-[104px] shrink-0 items-center justify-center border-b border-[color:var(--admin-border)]/80 px-6">
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

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {renderNavigation()}
        </div>

        <div className="admin-sidebar-footer relative z-10 shrink-0 overflow-hidden border-t px-4 py-3">
          <div
            className="admin-sidebar-art pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{ backgroundImage: "url('/brand/admin/sidebar-bg.png')" }}
            aria-hidden="true"
          />
          <div className="admin-sidebar-footer-overlay absolute inset-0" aria-hidden="true" />
          <div className="relative z-10">
            <button
              onClick={handleLogout}
              className="admin-sidebar-logout flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-medium transition"
            >
              <Icon name="logout" className="h-5 w-5" />
              Sair
            </button>
            <p className="admin-sidebar-copyright mt-3 px-2 text-[11px] leading-5">Pastoril Moda Country © 2026</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-[color:var(--admin-border)] bg-[color:var(--admin-bg)]/95 backdrop-blur">
          <div className="flex min-h-[78px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--admin-text)] transition hover:bg-[color:var(--admin-surface-soft)] lg:hidden"
                aria-label="Abrir menu"
              >
                <Icon name="menu" className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-[1.45rem] font-bold leading-tight text-[color:var(--admin-text)] sm:text-[1.6rem]">{title}</h1>
                {subtitle && <p className="mt-0.5 hidden text-[0.8rem] text-[color:var(--admin-muted)] sm:block">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="admin-theme-switch flex items-center rounded-full border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-1" role="group" aria-label="Tema do painel">
                <button
                  type="button"
                  onClick={() => changeTheme('light')}
                  aria-pressed={theme === 'light'}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition ${
                    theme === 'light' ? 'bg-[color:var(--admin-surface-soft)] text-[color:var(--admin-text)]' : 'text-[color:var(--admin-muted)] hover:text-[color:var(--admin-text)]'
                  }`}
                >
                  <Icon name="sun" className="h-4 w-4" />
                  <span className="hidden md:inline">Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition ${
                    theme === 'dark' ? 'bg-[color:var(--admin-text)] text-white' : 'text-[color:var(--admin-muted)] hover:text-[color:var(--admin-text)]'
                  }`}
                >
                  <Icon name="moon" className="h-4 w-4" />
                  <span className="hidden md:inline">Escuro</span>
                </button>
              </div>
              <button className="hidden h-10 w-10 items-center justify-center rounded-full border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] text-[color:var(--admin-text)] sm:flex" aria-label="Notificacoes">
                <Icon name="bell" className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 rounded-full border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-2 py-2 pl-2 shadow-[0_6px_16px_rgba(74,45,26,0.04)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--admin-surface-soft)] text-[13px] font-black text-[color:var(--admin-accent)]">
                  A
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="text-[13px] font-bold leading-tight text-[color:var(--admin-text)]">Administrador</p>
                  <p className="max-w-[170px] truncate text-[11px] text-[color:var(--admin-muted)]">{adminEmail}</p>
                </div>
                <Icon name="chevron" className="hidden h-4 w-4 text-[color:var(--admin-muted)] sm:block" />
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
