'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProtectedRoute, logout } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

interface Product {
  id: number;
  codigo_produto: string;
  nome: string;
  preco: number;
}

interface AdminUser {
  id: number;
  user_id?: string;
  nome: string;
  email: string;
  ativo: boolean;
}

type AdminSection = 'dashboard' | 'usuarios';
type MenuItem = { id: AdminSection; label: string } | { id: 'produtos' | 'banners'; label: string; href: string };

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-xl ${color} border border-opacity-20 p-6 shadow-sm`}>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessão administrativa inválida ou expirada. Faça login novamente.');
  }

  return data.session.access_token;
}

export default function AdminPage() {
  const router = useRouter();
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
          throw new Error(data?.error || 'Falha ao carregar usuários administrativos.');
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

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserConfirm) {
      setUserFormError('Preencha todos os campos.');
      return;
    }

    if (newUserPassword !== newUserConfirm) {
      setUserFormError('As senhas não coincidem.');
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
        setUserFormError(result?.error || 'Erro ao criar usuário.');
        return;
      }

      setUsers((current) => (result.user ? [result.user, ...current] : current));

      setShowUserForm(false);
      setUserSuccessMessage('Usuário criado com sucesso.');
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

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'produtos', label: 'Produtos', href: '/admin/produtos' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'banners', label: 'Banners', href: '/admin/banners' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="hidden md:flex md:w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-800">
              <span className="text-lg font-bold text-white">P</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Pastoril</h1>
              <p className="text-xs text-amber-700">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if ('href' in item) {
                  router.push(item.href);
                  return;
                }

                setActiveSection(item.id);
              }}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                activeSection === item.id
                  ? 'bg-amber-50 text-amber-900 border-l-4 border-amber-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-900">Pastoril Admin</h1>
            <button onClick={handleLogout} className="text-sm font-semibold text-slate-700 hover:text-amber-700 transition">
              Sair
            </button>
          </div>
        </div>

        <div className="md:hidden border-b border-slate-200 bg-white">
          <div className="flex overflow-x-auto gap-2 px-4 py-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if ('href' in item) {
                    router.push(item.href);
                    return;
                  }

                  setActiveSection(item.id);
                }}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeSection === item.id ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {activeSection === 'dashboard' && (
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
                  <p className="mt-1 text-sm text-slate-600">Resumo dos dados cadastrados.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StatCard
                    label="Produtos cadastrados"
                    value={loadingProducts ? '...' : products.length}
                    color="bg-blue-50"
                  />
                  <StatCard
                    label="Administradores ativos"
                    value={loadingUsers ? '...' : users.filter((user) => user.ativo).length}
                    color="bg-emerald-50"
                  />
                </div>

                {(productsError || usersError) && (
                  <div className="mt-6 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                    {productsError || usersError}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'usuarios' && (
              <div>
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">Usuários</h2>
                    <p className="mt-1 text-sm text-slate-600">Administradores cadastrados no banco.</p>
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
                    className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition shadow-sm"
                  >
                    Novo usuário
                  </button>
                </div>

                {userSuccessMessage && (
                  <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                    {userSuccessMessage}
                  </div>
                )}

                {usersError && (
                  <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                    {usersError}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">E-mail</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingUsers ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-600">
                              Carregando usuários...
                            </td>
                          </tr>
                        ) : users.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-600">
                              Nenhum usuário administrativo cadastrado.
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-6 py-4 text-sm font-semibold text-slate-900">{user.nome}</td>
                              <td className="px-6 py-4 text-sm text-slate-900">{user.email}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  user.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
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
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6">
                    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900">Novo usuário</h3>
                          <p className="text-sm text-slate-600">Dados do usuário administrativo.</p>
                        </div>
                        <button
                          onClick={() => setShowUserForm(false)}
                          className="text-2xl text-slate-400 hover:text-slate-700"
                        >
                          x
                        </button>
                      </div>

                      {userFormError && (
                        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
                          {userFormError}
                        </div>
                      )}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Nome</label>
                          <input
                            value={newUserName}
                            onChange={(event) => setNewUserName(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="Nome completo"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail</label>
                          <input
                            value={newUserEmail}
                            onChange={(event) => setNewUserEmail(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="usuario@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
                          <input
                            value={newUserPassword}
                            onChange={(event) => setNewUserPassword(event.target.value)}
                            type="password"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="Senha"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Confirmar senha</label>
                          <input
                            value={newUserConfirm}
                            onChange={(event) => setNewUserConfirm(event.target.value)}
                            type="password"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            placeholder="Repetir senha"
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          onClick={() => setShowUserForm(false)}
                          className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleCreateUser}
                          disabled={isSavingUser}
                          className="rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingUser ? 'Salvando...' : 'Salvar usuário'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
