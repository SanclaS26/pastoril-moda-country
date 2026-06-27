'use client';
import { useProtectedRoute } from '@/lib/useAuth';
import AdminShell from '../../components/AdminShell';
import CatalogManager from '../../components/CatalogManager';
export default function CategoriasPage() {
  useProtectedRoute();
  return <AdminShell title="Categorias" subtitle="Cadastros do catálogo" active="categorias"><CatalogManager endpoint="categorias" itemLabel="Categoria" /></AdminShell>;
}
