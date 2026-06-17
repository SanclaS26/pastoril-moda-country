'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProtectedRoute } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import AdminShell, { type AdminNavKey } from './components/AdminShell';

interface Product {
  id: number;
  codigo_produto: string;
  nome: string;
  preco: number;
  preco_promocional?: number | null;
  em_promocao?: boolean;
  ativo?: boolean;
}

interface AdminUser {
  id: number;
  user_id?: string;
  nome: string;
  email: string;
  ativo: boolean;
}

type AdminSection = 'dashboard' | 'usuarios';

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-2xl border border-[#E7E0D8] bg-white p-5 shadow-[0_10px_24px_rgba(74,45,26,0.045)]">
      <p className="text-sm font-bold text-[#4A2D1A]">{label}</p>
      <p className="mt-5 text-3xl font-black tracking-tight text-[#241C17]">{value}</p>
      <p className="mt-4 text-xs font-medium text-[#6E625A]">{helper}</p>
    </div>
  );
}

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessao administrativa invalida ou expirada. Faca login novamente.');
  }

  return data.session.access_token;
}

export default function AdminPage() {
  useProtectedRoute();

  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirm, setNewUserConfirm] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [userSuccessMessage, setUserSuccessMessage] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  useEffect(() => {
    const syncSection = () => {
      setActiveSection(window.location.hash === '#usuarios' ? 'usuarios' : 'dashboard');
    };

    const timer = window.setTimeout(syncSection, 0);
    window.addEventListener('hashchange', syncSection);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', syncSection);
    };
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const token = await getSessionToken();
        const response = await fetch('/api/admin/produtos', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Falha ao carregar produtos.');
        }

        setProducts(Array.isArray(data.products) ? data.products : []);
        setProductsError('');
      } catch (error) {
        setProductsError(error instanceof Error ? error.message : 'Erro desconhecido.');
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const token = await getSessionToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Falha ao carregar usuarios administrativos.');
        }

        setUsers(Array.isArray(data.users) ? data.users : []);
        setUsersError('');
      } catch (error) {
        setUsersError(error instanceof Error ? error.message : 'Erro desconhecido.');
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const activeProducts = useMemo(
    () => products.filter((product) => product.ativo !== false).length,
    [products],
  );

  const promotionalProducts = useMemo(
    () => products.filter((product) => product.em_promocao).length,
    [products],
  );

  const recentProducts = useMemo(() => products.slice(0, 6), [products]);

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserConfirm) {
      setUserFormError('Preencha todos os campos.');
      return;
    }

    if (newUserPassword !== newUserConfirm) {
      setUserFormError('As senhas nao coincidem.');
      return;
    }

    setUserFormError('');
    setUserSuccessMessage('');
    setIsSavingUser(true);

    try {
      const token = await getSessionToken();
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome: newUserName, email: newUserEmail, senha: newUserPassword }),
      });
      const result = await response.json();

      if (!response.ok) {
        setUserFormError(result?.error || 'Erro ao criar usuario.');
        return;
      }

      setUsers((current) => (result.user ? [result.user, ...current] : current));

      setShowUserForm(false);
      setUserSuccessMessage('Usuario criado com sucesso.');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserConfirm('');
    } catch (error) {
      setUserFormError(error instanceof Error ? error.message : 'Erro de rede.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const shellActive: AdminNavKey = activeSection === 'usuarios' ? 'usuarios' : 'dashboard';

  return (
    <AdminShell
      title={activeSection === 'usuarios' ? 'Usuarios' : 'Dashboard'}
      subtitle={activeSection === 'usuarios' ? 'Administradores cadastrados no banco.' : 'Resumo dos dados reais cadastrados.'}
      active={shellActive}
    >
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Produtos cadastrados"
              value={loadingProducts ? '...' : products.length}
              helper="Total retornado pela consulta de produtos"
            />
            <StatCard
              label="Produtos ativos"
              value={loadingProducts ? '...' : activeProducts}
              helper="Itens disponiveis para operacao"
            />
            <StatCard
              label="Promocoes"
              value={loadingProducts ? '...' : promotionalProducts}
              helper="Produtos marcados em promocao"
            />
            <StatCard
              label="Administradores ativos"
              value={loadingUsers ? '...' : users.filter((user) => user.ativo).length}
              helper="Usuarios com acesso liberado"
            />
          </div>

          {(productsError || usersError) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {productsError || usersError}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <section className="rounded-2xl border border-[#E7E0D8] bg-white p-5 shadow-[0_10px_24px_rgba(74,45,26,0.045)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-[#241C17]">Resumo de produtos</h2>
                <a href="/admin/produtos" className="text-sm font-bold text-[#C8722C]">Ver todos</a>
              </div>

              {loadingProducts ? (
                <div className="py-12 text-center text-sm text-[#6E625A]">Carregando produtos...</div>
              ) : recentProducts.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#6E625A]">Nenhum produto cadastrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead>
                      <tr className="border-b border-[#E7E0D8] text-left text-xs font-bold uppercase text-[#6E625A]">
                        <th className="py-3 pr-4">Codigo</th>
                        <th className="py-3 pr-4">Produto</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 text-right">Preco</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProducts.map((product) => (
                        <tr key={product.id} className="border-b border-[#F1EAE2] last:border-0">
                          <td className="py-4 pr-4 text-sm font-bold text-[#4A2D1A]">{product.codigo_produto}</td>
                          <td className="py-4 pr-4 text-sm font-semibold text-[#241C17]">{product.nome}</td>
                          <td className="py-4 pr-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              product.ativo === false ? 'bg-[#F7F0E7] text-[#6E625A]' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {product.ativo === false ? 'Inativo' : 'Ativo'}
                            </span>
                          </td>
                          <td className="py-4 text-right text-sm font-bold text-[#241C17]">
                            {formatCurrency(product.em_promocao ? product.preco_promocional : product.preco)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#E7E0D8] bg-white p-5 shadow-[0_10px_24px_rgba(74,45,26,0.045)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-[#241C17]">Administradores</h2>
                <a href="/admin#usuarios" className="text-sm font-bold text-[#C8722C]">Gerenciar</a>
              </div>

              {loadingUsers ? (
                <div className="py-12 text-center text-sm text-[#6E625A]">Carregando usuarios...</div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#6E625A]">Nenhum administrador cadastrado.</div>
              ) : (
                <div className="space-y-3">
                  {users.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#241C17]">{user.nome}</p>
                        <p className="truncate text-xs text-[#6E625A]">{user.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        user.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F7F0E7] text-[#6E625A]'
                      }`}>
                        {user.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {activeSection === 'usuarios' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#241C17]">Usuarios</h2>
              <p className="mt-1 text-sm text-[#6E625A]">Administradores cadastrados no banco.</p>
            </div>
            <button
              onClick={() => {
                setShowUserForm(true);
                setUserFormError('');
                setNewUserName('');
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserConfirm('');
              }}
              className="rounded-lg bg-[#C8722C] px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A]"
            >
              Novo usuario
            </button>
          </div>

          {userSuccessMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {userSuccessMessage}
            </div>
          )}

          {usersError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {usersError}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-[0_10px_24px_rgba(74,45,26,0.045)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-[#E7E0D8] bg-[#F7F0E7]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">E-mail</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[#6E625A]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-[#6E625A]">
                        Carregando usuarios...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-[#6E625A]">
                        Nenhum usuario administrativo cadastrado.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-[#F1EAE2] last:border-0 hover:bg-[#F9F6F1]">
                        <td className="px-6 py-4 text-sm font-bold text-[#241C17]">{user.nome}</td>
                        <td className="px-6 py-4 text-sm text-[#241C17]">{user.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                            user.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F7F0E7] text-[#6E625A]'
                          }`}>
                            {user.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showUserForm && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
              <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#E7E0D8] pb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-[#241C17]">Novo usuario</h3>
                    <p className="text-sm text-[#6E625A]">Dados do usuario administrativo.</p>
                  </div>
                  <button
                    onClick={() => setShowUserForm(false)}
                    className="text-2xl text-[#6E625A] hover:text-[#4A2D1A]"
                    aria-label="Fechar"
                  >
                    x
                  </button>
                </div>

                {userFormError && (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {userFormError}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">Nome</span>
                    <input
                      value={newUserName}
                      onChange={(event) => setNewUserName(event.target.value)}
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] focus:border-[#C8722C] focus:outline-none focus:ring-2 focus:ring-[#C8722C]/20"
                      placeholder="Nome completo"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">E-mail</span>
                    <input
                      value={newUserEmail}
                      onChange={(event) => setNewUserEmail(event.target.value)}
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] focus:border-[#C8722C] focus:outline-none focus:ring-2 focus:ring-[#C8722C]/20"
                      placeholder="usuario@example.com"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">Senha</span>
                    <input
                      value={newUserPassword}
                      onChange={(event) => setNewUserPassword(event.target.value)}
                      type="password"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] focus:border-[#C8722C] focus:outline-none focus:ring-2 focus:ring-[#C8722C]/20"
                      placeholder="Senha"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">Confirmar senha</span>
                    <input
                      value={newUserConfirm}
                      onChange={(event) => setNewUserConfirm(event.target.value)}
                      type="password"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] focus:border-[#C8722C] focus:outline-none focus:ring-2 focus:ring-[#C8722C]/20"
                      placeholder="Repetir senha"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setShowUserForm(false)}
                    className="rounded-lg border border-[#E7E0D8] px-6 py-3 text-sm font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={isSavingUser}
                    className="rounded-lg bg-[#C8722C] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingUser ? 'Salvando...' : 'Salvar usuario'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
