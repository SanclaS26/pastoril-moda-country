'use client';

import { useEffect, useState } from 'react';
import { useProtectedRoute } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';
import AdminShell, { type AdminNavKey } from './components/AdminShell';
import AdminDashboard from './components/AdminDashboard';

interface AdminUser {
  id: number;
  user_id?: string;
  nome: string;
  email: string;
  ativo: boolean;
}

type AdminSection = 'dashboard' | 'usuarios';
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
      subtitle={activeSection === 'usuarios' ? 'Administradores cadastrados no banco.' : 'Resumo executivo de pedidos, vendas e carrinhos.'}
      active={shellActive}
    >
      {activeSection === 'dashboard' && <AdminDashboard />}
      {activeSection === 'usuarios' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[color:var(--admin-text)]">Usuarios</h2>
              <p className="mt-1 text-sm text-[color:var(--admin-muted)]">Administradores cadastrados no banco.</p>
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
              className="admin-button admin-button-primary"
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

          <div className="admin-table-shell overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-[color:var(--admin-border)] bg-[color:var(--admin-surface-soft)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[color:var(--admin-muted)]">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[color:var(--admin-muted)]">E-mail</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase text-[color:var(--admin-muted)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={3} className="admin-empty-state px-6 py-8 text-center text-sm">
                        Carregando usuarios...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="admin-empty-state px-6 py-8 text-center text-sm">
                        Nenhum usuario administrativo cadastrado.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-[color:var(--admin-border)] last:border-0 hover:bg-[color:var(--admin-row-hover)]">
                        <td className="px-6 py-4 text-sm font-bold text-[color:var(--admin-text)]">{user.nome}</td>
                        <td className="px-6 py-4 text-sm text-[color:var(--admin-text)]">{user.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`admin-badge ${user.ativo ? 'admin-badge-success' : ''}`}>
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
              <div className="admin-modal-surface w-full max-w-2xl rounded-3xl p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-[color:var(--admin-border)] pb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-[color:var(--admin-text)]">Novo usuario</h3>
                    <p className="text-sm text-[color:var(--admin-muted)]">Dados do usuario administrativo.</p>
                  </div>
                  <button
                    onClick={() => setShowUserForm(false)}
                    className="text-2xl text-[color:var(--admin-muted)] hover:text-[color:var(--admin-text)]"
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
                    <span className="mb-2 block text-sm font-bold text-[color:var(--admin-text)]">Nome</span>
                    <input
                      value={newUserName}
                      onChange={(event) => setNewUserName(event.target.value)}
                      className="admin-input w-full rounded-xl px-4 py-3"
                      placeholder="Nome completo"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[color:var(--admin-text)]">E-mail</span>
                    <input
                      value={newUserEmail}
                      onChange={(event) => setNewUserEmail(event.target.value)}
                      className="admin-input w-full rounded-xl px-4 py-3"
                      placeholder="usuario@example.com"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[color:var(--admin-text)]">Senha</span>
                    <input
                      value={newUserPassword}
                      onChange={(event) => setNewUserPassword(event.target.value)}
                      type="password"
                      className="admin-input w-full rounded-xl px-4 py-3"
                      placeholder="Senha"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-[color:var(--admin-text)]">Confirmar senha</span>
                    <input
                      value={newUserConfirm}
                      onChange={(event) => setNewUserConfirm(event.target.value)}
                      type="password"
                      className="admin-input w-full rounded-xl px-4 py-3"
                      placeholder="Repetir senha"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setShowUserForm(false)}
                    className="admin-table-action-secondary rounded-lg px-6 py-3 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={isSavingUser}
                    className="rounded-lg bg-[color:var(--admin-accent)] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingUser ? (
                      <>
                        <LoadingSpinner className="text-white" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      'Salvar usuario'
                    )}
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
