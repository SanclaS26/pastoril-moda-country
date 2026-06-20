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

interface VisitDailyPoint {
  date: string;
  visits: number;
}

interface VisitStats {
  metrics: {
    visitsToday: number;
    visitsLast7Days: number;
    visitsLast30Days: number;
  };
  cities: Array<{ city: string; region: string | null; visits: number }>;
}

type AdminSection = 'dashboard' | 'usuarios';

function StatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-[0_8px_18px_rgba(74,45,26,0.04)]">
      <p className="text-sm font-bold text-[#4A2D1A]">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-[#241C17]">{value}</p>
      <p className="mt-2 text-xs font-medium leading-relaxed text-[#6E625A]">{helper}</p>
    </div>
  );
}

export function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function VisitsChart({ data, error, loading }: { data: VisitDailyPoint[]; error: string; loading: boolean }) {
  const maxVisits = Math.max(...data.map((item) => item.visits), 1);
  const hasVisits = data.some((item) => item.visits > 0);
  const chartWidth = 720;
  const chartHeight = 260;
  const padding = { bottom: 36, left: 42, right: 16, top: 18 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  if (loading) {
    return <div className="py-12 text-center text-sm text-[#6E625A]">Carregando visitas...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!data.length || !hasVisits) {
    return (
      <div className="rounded-2xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-8 text-center text-sm text-[#6E625A]">
        Ainda nao ha visitas registradas para exibir no grafico.
      </div>
    );
  }

  const points = data.map((item, index) => {
    const x = padding.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
    const y = padding.top + innerHeight - (item.visits / maxVisits) * innerHeight;

    return { ...item, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${
    padding.top + innerHeight
  } Z`;
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round((maxVisits / 4) * (4 - index));
    const y = padding.top + (innerHeight / 4) * index;

    return { value, y };
  });

  return (
    <div className="overflow-x-auto pb-1">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-auto w-full min-w-[620px] rounded-2xl border border-[#E7E0D8] bg-[#F9F6F1]"
        role="img"
        aria-label="Grafico de visitas dos ultimos 30 dias"
      >
        {gridLines.map((line) => (
          <g key={`${line.y}-${line.value}`}>
            <line
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={line.y}
              y2={line.y}
              stroke="#E7E0D8"
              strokeDasharray="5 5"
            />
            <text x={14} y={line.y + 4} fill="#6E625A" fontSize="11" fontWeight="600">
              {line.value}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="#C8722C" opacity="0.12" />
        <path d={linePath} fill="none" stroke="#9A6A43" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        {points.map((point, index) => {
          const showLabel = index === 0 || index === points.length - 1 || index % 5 === 0;

          return (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} r="3.5" fill="#F9F6F1" stroke="#9A6A43" strokeWidth="2" />
              {showLabel && (
                <text x={point.x} y={chartHeight - 12} fill="#4A2D1A" fontSize="11" fontWeight="600" textAnchor="middle">
                  {formatDateLabel(point.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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
  const [visitStats, setVisitStats] = useState<VisitStats | null>(null);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [visitsError, setVisitsError] = useState('');
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

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        setLoadingVisits(true);
        const token = await getSessionToken();
        const response = await fetch('/api/admin/visits', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Falha ao carregar estatisticas de visitas.');
        }

        setVisitStats(data as VisitStats);
        setVisitsError('');
      } catch (error) {
        setVisitStats(null);
        setVisitsError(error instanceof Error ? error.message : 'Erro desconhecido.');
      } finally {
        setLoadingVisits(false);
      }
    };

    fetchVisits();
  }, []);

  const activeProducts = useMemo(
    () => products.filter((product) => product.ativo !== false).length,
    [products],
  );

  const promotionalProducts = useMemo(
    () => products.filter((product) => product.em_promocao).length,
    [products],
  );

  const visitMetricCards = useMemo(
    () => [
      {
        helper: 'Pageviews registrados desde 00h',
        label: 'Visitas hoje',
        value: visitStats?.metrics.visitsToday ?? 0,
      },
      {
        helper: 'Soma dos ultimos 7 dias',
        label: 'Visitas nos últimos 7 dias',
        value: visitStats?.metrics.visitsLast7Days ?? 0,
      },
      {
        helper: 'Soma dos ultimos 30 dias',
        label: 'Visitas nos últimos 30 dias',
        value: visitStats?.metrics.visitsLast30Days ?? 0,
      },
    ],
    [visitStats],
  );

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
        <div className="space-y-7">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-[#241C17]">Resumo geral da loja</h2>
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
          </section>

          {(productsError || usersError) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {productsError || usersError}
            </div>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#241C17]">Visitas</h2>
              <p className="mt-1 text-sm text-[#6E625A]">Acessos anonimos registrados na vitrine publica.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {visitMetricCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={loadingVisits ? '...' : card.value}
                  helper={card.helper}
                />
              ))}
            </div>

            <section className="overflow-hidden rounded-2xl border border-[#E7E0D8] bg-white shadow-[0_8px_18px_rgba(74,45,26,0.04)]">
              <div className="border-b border-[#E7E0D8] px-5 py-4">
                <h3 className="text-base font-bold text-[#241C17]">Visitas por cidade — últimos 7 dias</h3>
                <p className="mt-1 text-xs font-medium text-[#6E625A]">Ordenadas da maior quantidade para a menor.</p>
                <p className="mt-1 text-xs text-[#6E625A]">Em localhost, a localização pode não estar disponível. Para validar dados reais, acesse a publicação na Vercel.</p>
              </div>
              {loadingVisits ? (
                <p className="px-5 py-8 text-center text-sm text-[#6E625A]">Carregando visitas...</p>
              ) : visitsError ? (
                <p className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{visitsError}</p>
              ) : visitStats?.cities.length ? (
                <ul className="divide-y divide-[#E7E0D8]">
                  {[...visitStats.cities].sort((left, right) => right.visits - left.visits).map((item) => (
                    <li key={`${item.city}-${item.region ?? ''}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                      <span className="font-semibold text-[#4A2D1A]">
                        {item.city}
                        {item.region && <span className="ml-1 font-normal text-[#6E625A]">— {item.region}</span>}
                      </span>
                      <span className="font-bold tabular-nums text-[#241C17]">{item.visits}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-[#4A2D1A]">Nenhuma visita registrada nos últimos 7 dias.</p>
                </div>
              )}
            </section>
          </section>
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
