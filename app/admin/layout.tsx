import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Pastoril Moda Country - Admin',
  description: 'Área administrativa da Pastoril Moda Country',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}