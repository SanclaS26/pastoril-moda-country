import type { Metadata } from 'next';
import AdminThemeHydrator from './components/AdminThemeHydrator';
import '../globals.css';

const adminThemeScript = `
  (function () {
    var storageKey = 'pastoril-admin-theme';
    var theme = 'light';
    try {
      theme = window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
    } catch (_) {}

    var root = document.getElementById('admin-theme-root');
    if (!root) return;
    root.classList.remove('admin-theme-light', 'admin-theme-dark');
    root.classList.add('admin-theme-' + theme);
  })();
`;

export const metadata: Metadata = {
  title: 'Pastoril Moda Country - Admin',
  description: 'Área administrativa da Pastoril Moda Country',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="admin-theme-root"
      suppressHydrationWarning
      className="admin-theme-light min-h-screen bg-[#F9F6F1]"
    >
      <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
      <AdminThemeHydrator />
      {children}
    </div>
  );
}
