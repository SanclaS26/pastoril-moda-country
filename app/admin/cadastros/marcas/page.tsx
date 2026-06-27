'use client';
import { useProtectedRoute } from '@/lib/useAuth';
import AdminShell from '../../components/AdminShell';
import CatalogManager from '../../components/CatalogManager';
export default function MarcasPage() {
  useProtectedRoute();
  return <AdminShell title="Marcas" subtitle="Cadastros do catálogo" active="marcas"><CatalogManager endpoint="marcas" itemLabel="Marca" /></AdminShell>;
}
