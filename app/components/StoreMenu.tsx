'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type StoreMenuCategory = {
  id: 'masculino' | 'feminino' | 'infantil' | 'todos';
  label: string;
  subcategories: string[];
};

type MenuIconName =
  | 'account'
  | 'bag'
  | 'categories'
  | 'chevron'
  | 'help'
  | 'home'
  | 'instagram'
  | 'logout'
  | 'policy'
  | 'spark'
  | 'tag'
  | 'users'
  | 'whatsapp';

function MenuIcon({ name, className = 'h-6 w-6' }: { name: MenuIconName; className?: string }) {
  const paths: Record<MenuIconName, ReactNode> = {
    account: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    bag: <><path d="M6.5 8.5h11l-.7 11H7.2l-.7-11Z" /><path d="M9.5 8.5V6.8a2.5 2.5 0 0 1 5 0v1.7" /></>,
    categories: <path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 1 1 3.4 2.4c-.8.4-1.1.9-1.1 1.7M12 17h.01" /></>,
    home: <><path d="m3.8 11.2 8.2-7 8.2 7" /><path d="M6 10.5v9h12v-9M10 19.5v-5h4v5" /></>,
    instagram: <><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" /><circle cx="12" cy="12" r="3.5" /><path d="M16.8 7.2h.01" /></>,
    logout: <><path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" /><path d="m15 8 4 4-4 4M9 12h10" /></>,
    policy: <><path d="M12 3.5 19 6v5.3c0 4.4-2.7 7.4-7 9.2-4.3-1.8-7-4.8-7-9.2V6l7-2.5Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <><path d="m12 3 2 5.2L19.5 10 15 13.4l.2 5.6-3.2-2.2L8.8 19 9 13.4 4.5 10 10 8.2 12 3Z" /><path d="m10.3 11.4 1.1 1.1 2.4-2.5" /></>,
    tag: <><path d="m3.8 12 8.2-8h7v7l-8.2 8L3.8 12Z" /><circle cx="15.5" cy="7.5" r="1" /></>,
    users: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 10.5a2.5 2.5 0 1 0-1-4.7M16 14a4.5 4.5 0 0 1 4.5 4.5" /></>,
    whatsapp: <><path d="M4.5 20 5.8 15.5a8 8 0 1 1 3 3L4.5 20Z" /><path d="M9 8.5c.4 3.2 3.2 5.9 6.4 6.5" /></>,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

type StoreMenuProps = {
  categories: StoreMenuCategory[];
  customerDetail: string;
  customerLabel: string;
  isCategoriesOpen: boolean;
  isLoggedIn: boolean;
  onCategoriesToggle: () => void;
  onCategory: (id: StoreMenuCategory['id']) => void;
  onClose: () => void;
  onCustomer: () => void;
  onHome: () => void;
  onLogout: () => void;
  onNew: () => void;
  onProducts: () => void;
  onPromotion: () => void;
};

export function StoreMenu(props: StoreMenuProps) {
  const itemClass = 'store-drawer-item';

  return (
    <>
      <button type="button" aria-label="Fechar menu" onClick={props.onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px]" />

      <aside className="store-drawer fixed inset-y-0 left-0 z-[70] flex w-[calc(100%-20px)] max-w-[430px] animate-[slideInMenu_220ms_ease-out] flex-col overflow-hidden shadow-[12px_0_32px_rgba(36,16,6,0.16)]" aria-label="Menu principal">
        <div className="store-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <button type="button" onClick={props.onClose} className="store-drawer-close" aria-label="Fechar menu">Fechar</button>

          <div className="store-drawer-content">
            <button type="button" onClick={props.onCustomer} className="store-drawer-account">
              <span className="store-drawer-account-icon">
                <MenuIcon name="account" className="h-8 w-8" />
                {props.isLoggedIn && <span className="store-drawer-online-dot" aria-label="Conectado" />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <strong className="block truncate text-[1rem] font-bold leading-tight text-[var(--pastoril-text)]" title={props.customerLabel}>{props.customerLabel}</strong>
                <span className="mt-1 block text-[0.9rem] leading-snug text-[var(--pastoril-text)]">{props.customerDetail}</span>
              </span>
              <MenuIcon name="chevron" className="h-5 w-5 shrink-0" />
            </button>

            <nav aria-label="Links do menu">
              <section className="store-drawer-section">
                <h2 className="store-drawer-heading">Navegação</h2>
                <button type="button" onClick={props.onHome} className={itemClass}><MenuIcon name="home" /> <span>Início</span></button>
                <button type="button" onClick={props.onCategoriesToggle} className={itemClass}><MenuIcon name="categories" /><span className="flex-1">Categorias</span>{props.categories.length > 0 && <MenuIcon name="chevron" className={`h-4 w-4 transition-transform ${props.isCategoriesOpen ? 'rotate-90' : ''}`} />}</button>
                {props.categories.length > 0 && (
                  <div className={`store-drawer-submenu${props.isCategoriesOpen ? ' store-drawer-submenu-open' : ''}`} aria-hidden={!props.isCategoriesOpen}>
                    <div className="store-drawer-submenu-inner">
                      {props.categories.map((category) => (
                        <button key={category.id} type="button" onClick={() => props.onCategory(category.id)} className="store-drawer-submenu-item">{category.label}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" onClick={props.onNew} className={itemClass}><MenuIcon name="spark" /> <span>Novidades</span></button>
                <button type="button" onClick={props.onPromotion} className={itemClass}><MenuIcon name="tag" /> <span>Promoções</span></button>
                <button type="button" onClick={props.onProducts} className={itemClass}><MenuIcon name="bag" /> <span>Todos os produtos</span></button>
              </section>

              <section className="store-drawer-section">
                <h2 className="store-drawer-heading">Atendimento</h2>
                <a href="https://wa.me/5568999244811" target="_blank" rel="noreferrer" className={itemClass} onClick={props.onClose}><MenuIcon name="whatsapp" /> <span>Fale no WhatsApp</span></a>
                <Link href="/quem-somos" onClick={props.onClose} className={itemClass}><MenuIcon name="users" /> <span>Quem somos</span></Link>
                <Link href="/politicas-e-trocas" onClick={props.onClose} className={itemClass}><MenuIcon name="policy" /> <span>Políticas e trocas</span></Link>
                <Link href="/perguntas-frequentes" onClick={props.onClose} className={itemClass}><MenuIcon name="help" /> <span>Perguntas frequentes</span></Link>
              </section>

              {props.isLoggedIn && (
                <section className="store-drawer-section store-drawer-logout-section">
                  <button type="button" className={itemClass} onClick={props.onLogout}><MenuIcon name="logout" /> <span>Sair</span></button>
                </section>
              )}
            </nav>

            <footer className="store-drawer-footer">
              <div className="flex items-center justify-center gap-5">
                <a href="https://www.instagram.com/pastorilcountry/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="store-drawer-social"><MenuIcon name="instagram" className="h-6 w-6" /></a>
                <a href="https://wa.me/5568999244811" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="store-drawer-social"><MenuIcon name="whatsapp" className="h-6 w-6" /></a>
              </div>
              <p className="mt-4 text-sm font-semibold">&copy; Pastoril Moda Country</p>
              <p className="mt-1 text-xs">Todos os direitos reservados.</p>
            </footer>
          </div>
        </div>
      </aside>
    </>
  );
}
