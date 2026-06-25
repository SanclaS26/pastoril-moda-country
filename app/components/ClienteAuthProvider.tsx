'use client';

import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { signInClienteWithPhone } from '@/lib/cliente-login';
import { formatCpf, formatPhone, normalizeClientePhone, normalizeCpf } from '@/lib/cliente-utils';
import { clienteSupabase } from '@/lib/supabase-cliente';

type ClienteAuthContextValue = {
  clientePerfil: ClientePerfil | null;
  isClienteLoggedIn: boolean;
  loadClienteProfile: () => Promise<void>;
  logoutCliente: () => Promise<void>;
  openClienteAuth: () => void;
  openClienteData: () => void;
  openClienteOrders: () => Promise<void>;
  openClienteWishlist: () => void;
  requireClienteForCheckout: () => Promise<Session | null>;
};

type ClientePerfil = {
  id: number | string;
  auth_user_id: string;
  nome: string;
  cpf: string;
  celular: string;
  email: string | null;
  endereco_completo: string | null;
  must_change_password: boolean;
};

type ClienteCompra = {
  id: string;
  codigo: string;
  status: string;
  total_original: number;
  total_final: number | null;
  created_at: string;
  itens: Array<{
    id: string;
    nome: string;
    tamanho: string;
    quantidade_final: number;
    quantidade_original: number;
  }>;
};

const ClienteAuthContext = createContext<ClienteAuthContextValue | null>(null);

export function useClienteAuth() {
  const context = useContext(ClienteAuthContext);

  if (!context) {
    throw new Error('useClienteAuth deve ser usado dentro de ClienteAuthProvider.');
  }

  return context;
}

export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [clienteSession, setClienteSession] = useState<Session | null>(null);
  const [modalMode, setModalMode] = useState<'checkoutPrompt' | 'login' | 'cadastro' | 'account' | 'edit' | 'purchases' | 'wishlist' | null>(null);
  const [celular, setCelular] = useState('');
  const [senha, setSenha] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [clientePerfil, setClientePerfil] = useState<ClientePerfil | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNome, setProfileNome] = useState('');
  const [profileCpf, setProfileCpf] = useState('');
  const [profileCelular, setProfileCelular] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileEndereco, setProfileEndereco] = useState('');
  const [compras, setCompras] = useState<ClienteCompra[]>([]);
  const [comprasLoading, setComprasLoading] = useState(false);
  const [comprasError, setComprasError] = useState('');
  const [cadastroNome, setCadastroNome] = useState('');
  const [cadastroCpf, setCadastroCpf] = useState('');
  const [cadastroCelular, setCadastroCelular] = useState('');
  const [cadastroEmail, setCadastroEmail] = useState('');
  const [cadastroEndereco, setCadastroEndereco] = useState('');
  const [cadastroSenha, setCadastroSenha] = useState('');
  const [cadastroConfirmarSenha, setCadastroConfirmarSenha] = useState('');
  const [cadastroError, setCadastroError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const checkoutResolveRef = useRef<((session: Session | null) => void) | null>(null);

  const resolveCheckout = useCallback((session: Session | null) => {
    if (!checkoutResolveRef.current) return;

    checkoutResolveRef.current(session);
    checkoutResolveRef.current = null;
  }, []);

  const closeClienteModal = useCallback(() => {
    resolveCheckout(null);
    setModalMode(null);
  }, [resolveCheckout]);

  useEffect(() => {
    let activeRequest = true;

    const loadSession = async () => {
      const { data } = await clienteSupabase.auth.getSession();

      if (activeRequest) {
        setClienteSession(data.session);
      }
    };

    void loadSession();

    const { data: listener } = clienteSupabase.auth.onAuthStateChange((_event, session) => {
      setClienteSession(session);
      if (!session) {
        setClientePerfil(null);
      }
    });

    return () => {
      activeRequest = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const fillProfileForm = useCallback((cliente: ClientePerfil) => {
    setProfileNome(cliente.nome ?? '');
    setProfileCpf(formatCpf(cliente.cpf ?? ''));
    setProfileCelular(formatPhone(cliente.celular ?? ''));
    setProfileEmail(cliente.email ?? '');
    setProfileEndereco(cliente.endereco_completo ?? '');
  }, []);

  const loadClientePerfil = useCallback(async () => {
    const { data } = await clienteSupabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setClientePerfil(null);
      return;
    }

    setProfileLoading(true);
    setProfileError('');

    try {
      const response = await fetch('/api/clientes/perfil', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Nao foi possivel carregar os dados da conta.');
      }

      const cliente = result.cliente as ClientePerfil;
      setClientePerfil(cliente);
      fillProfileForm(cliente);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Erro ao carregar os dados da conta.');
    } finally {
      setProfileLoading(false);
    }
  }, [fillProfileForm]);

  useEffect(() => {
    if (!modalMode) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeClienteModal();
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeClienteModal, modalMode]);

  useEffect(() => {
    if (!globalSuccess) return;

    const timeout = window.setTimeout(() => {
      setGlobalSuccess('');
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [globalSuccess]);

  const openClienteAuth = useCallback(() => {
    setLoginError('');
    setLoginSuccess('');
    setProfileError('');
    setProfileSuccess('');
    setGlobalSuccess('');
    if (clienteSession) {
      void loadClientePerfil();
    }
    setModalMode(clienteSession ? 'account' : 'login');
  }, [clienteSession, loadClientePerfil]);

  const requireClienteForCheckout = useCallback(async () => {
    if (clienteSession) return clienteSession;

    const { data } = await clienteSupabase.auth.getSession();
    if (data.session) {
      setClienteSession(data.session);
      return data.session;
    }

    setLoginError('');
    setLoginSuccess('');
    setCadastroError('');
    setProfileError('');
    setProfileSuccess('');
    setGlobalSuccess('');
    setModalMode('checkoutPrompt');

    return new Promise<Session | null>((resolve) => {
      checkoutResolveRef.current = resolve;
    });
  }, [clienteSession]);

  const openCadastro = () => {
    setLoginError('');
    setLoginSuccess('');
    setCadastroError('');
    setModalMode('cadastro');
  };

  const openLogin = () => {
    setCadastroError('');
    setModalMode('login');
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setProfileError('');
    setProfileSuccess('');

    if (!normalizeClientePhone(celular)) {
      setLoginError('Informe um celular valido com DDD.');
      return;
    }

    setIsLoggingIn(true);

    try {
      const result = await signInClienteWithPhone(celular, senha);
      if (result.must_change_password) {
        setModalMode(null);
        router.push('/alterar-senha');
        resolveCheckout(null);
        return;
      }
      if (!result.email) {
        setModalMode(null);
        router.push('/minha-conta?email=obrigatorio');
        resolveCheckout(null);
        return;
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Nao foi possivel autenticar o cliente.');
      setIsLoggingIn(false);
      return;
    }

    setIsLoggingIn(false);

    const { data } = await clienteSupabase.auth.getSession();
    setClienteSession(data.session);
    setCelular('');
    setSenha('');
    setGlobalSuccess('Login realizado com sucesso.');
    setModalMode(null);
    resolveCheckout(data.session);
  };

  const handleLogout = async () => {
    await clienteSupabase.auth.signOut();
    setClientePerfil(null);
    setModalMode(null);
    router.refresh();
  };

  const handleCadastroSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCadastroError('');
    setLoginSuccess('');
    setGlobalSuccess('');
    setIsRegistering(true);

    try {
      const response = await fetch('/api/clientes/cadastro', {
        body: JSON.stringify({
          celular: cadastroCelular,
          confirmarSenha: cadastroConfirmarSenha,
          cpf: cadastroCpf,
          email: cadastroEmail,
          enderecoCompleto: cadastroEndereco,
          nome: cadastroNome,
          senha: cadastroSenha,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Nao foi possivel concluir o cadastro.');
      }

      const normalizedPhone = normalizeClientePhone(cadastroCelular);

      if (normalizedPhone) {
        try {
          const result = await signInClienteWithPhone(cadastroCelular, cadastroSenha);
          if (result.must_change_password) {
            setModalMode(null);
            router.push('/alterar-senha');
            resolveCheckout(null);
            return;
          }
          setCadastroNome('');
          setCadastroCpf('');
          setCadastroCelular('');
          setCadastroEmail('');
          setCadastroEndereco('');
          setCadastroSenha('');
          setCadastroConfirmarSenha('');
          const { data: sessionData } = await clienteSupabase.auth.getSession();
          setClienteSession(sessionData.session);
          setGlobalSuccess('Cadastro realizado com sucesso.');
          setModalMode(null);
          resolveCheckout(sessionData.session);
          return;
        } catch {
          // Mantem o fluxo de cadastro concluido e pede login manual com mensagem abaixo.
        }
      }

      setCelular(cadastroCelular);
      setSenha('');
      setCadastroNome('');
      setCadastroCpf('');
      setCadastroCelular('');
      setCadastroEmail('');
      setCadastroEndereco('');
      setCadastroSenha('');
      setCadastroConfirmarSenha('');
      setLoginSuccess('Cadastro criado com sucesso. Entre com seu celular e senha.');
      setModalMode('login');
    } catch (error) {
      setCadastroError(error instanceof Error ? error.message : 'Erro inesperado no cadastro.');
    } finally {
      setIsRegistering(false);
    }
  };

  const openProfileEdit = () => {
    if (clientePerfil) {
      fillProfileForm(clientePerfil);
    }

    setProfileError('');
    setProfileSuccess('');
    setModalMode('edit');
  };

  const openCartFromAccount = () => {
    window.dispatchEvent(new CustomEvent('pastoril:open-cart'));
    closeClienteModal();
  };

  const openPurchases = async () => {
    setComprasError('');
    setComprasLoading(true);
    setModalMode('purchases');

    const { data } = await clienteSupabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setComprasLoading(false);
      setModalMode('login');
      return;
    }

    try {
      const response = await fetch('/api/clientes/compras', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Nao foi possivel carregar suas compras.');
      }

      setCompras(Array.isArray(result.compras) ? result.compras : []);
    } catch (error) {
      setCompras([]);
      setComprasError(error instanceof Error ? error.message : 'Erro ao carregar suas compras.');
    } finally {
      setComprasLoading(false);
    }
  };

  const openWishlist = () => {
    setModalMode(null);
    router.push('/favoritos');
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);

    const { data } = await clienteSupabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setProfileSaving(false);
      setModalMode('login');
      return;
    }

    try {
      const profilePayload: {
        celular?: string;
        cpf?: string;
        email?: string;
        enderecoCompleto?: string;
        nome?: string;
      } = {
        email: profileEmail,
        enderecoCompleto: profileEndereco,
        nome: profileNome,
      };

      if (clientePerfil && normalizeCpf(profileCpf) !== normalizeCpf(clientePerfil.cpf)) {
        profilePayload.cpf = profileCpf;
      }

      if (clientePerfil && normalizeClientePhone(profileCelular)?.dbPhone !== clientePerfil.celular) {
        profilePayload.celular = profileCelular;
      }

      const response = await fetch('/api/clientes/perfil', {
        body: JSON.stringify(profilePayload),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Nao foi possivel atualizar seus dados.');
      }

      const cliente = result.cliente as ClientePerfil;
      setClientePerfil(cliente);
      fillProfileForm(cliente);
      setProfileSuccess(result?.message || 'Dados atualizados com sucesso.');
      setModalMode('account');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Erro ao atualizar seus dados.');
    } finally {
      setProfileSaving(false);
    }
  };

  const value = {
    clientePerfil,
    isClienteLoggedIn: Boolean(clienteSession),
    loadClienteProfile: loadClientePerfil,
    logoutCliente: handleLogout,
    openClienteAuth,
    openClienteData: openProfileEdit,
    openClienteOrders: openPurchases,
    openClienteWishlist: openWishlist,
    requireClienteForCheckout,
  };

  return (
    <ClienteAuthContext.Provider value={value}>
      {children}

      {globalSuccess && (
        <div className="fixed left-1/2 top-4 z-[95] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800 shadow-[0_12px_28px_rgba(74,45,26,0.12)]">
          {globalSuccess}
        </div>
      )}

      {modalMode && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar acesso do cliente"
            onClick={closeClienteModal}
          />

          <section
            className="relative z-10 w-full max-w-[430px] rounded-2xl border border-[#E7E0D8] bg-white p-6 text-[#241C17] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cliente-auth-title"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="cliente-auth-title" className="text-xl font-bold text-[#4A2D1A]">
                  {modalMode === 'account'
                    ? 'Minha conta'
                    : modalMode === 'checkoutPrompt'
                      ? 'Você já tem cadastro?'
                    : modalMode === 'cadastro'
                      ? 'Cadastro de cliente'
                      : modalMode === 'edit'
                        ? 'Editar dados'
                        : modalMode === 'purchases'
                          ? 'Minhas compras'
                          : modalMode === 'wishlist'
                            ? 'Minha lista de desejos'
                        : 'Entrar como cliente'}
                </h2>
                <p className="mt-1 text-sm text-[#6E625A]">
                  {modalMode === 'account'
                    ? 'Escolha uma opcao da sua conta.'
                    : modalMode === 'checkoutPrompt'
                      ? 'Entre ou crie seu cadastro para enviar o pedido pelo WhatsApp.'
                    : modalMode === 'cadastro'
                    ? 'Crie seu acesso com celular, e-mail e senha.'
                      : modalMode === 'edit'
                        ? 'Atualize seus dados de cliente.'
                        : modalMode === 'purchases'
                          ? 'Pedidos vinculados ao seu cadastro.'
                          : modalMode === 'wishlist'
                            ? 'Area preparada para seus favoritos.'
                        : 'Acesse com celular e senha.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeClienteModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F0E7] text-xl leading-none text-[#4A2D1A] transition hover:bg-[#E7E0D8]"
                aria-label="Fechar"
              >
                x
              </button>
            </div>

            {modalMode === 'checkoutPrompt' ? (
              <div className="space-y-3">
                <p className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm leading-relaxed text-[#6E625A]">
                  Para enviar seu pedido pelo WhatsApp, entre como cliente ou crie seu cadastro rapidinho.
                </p>
                <button
                  type="button"
                  onClick={() => setModalMode('login')}
                  className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A]"
                >
                  Já tenho cadastro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCadastroError('');
                    setModalMode('cadastro');
                  }}
                  className="w-full rounded-xl border border-[#C8722C] bg-transparent px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                >
                  Quero me cadastrar
                </button>
              </div>
            ) : modalMode === 'account' ? (
              <div className="space-y-3">
                {profileSuccess && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {profileSuccess}
                  </div>
                )}

                <button
                  type="button"
                  onClick={openCartFromAccount}
                  className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ver meu carrinho
                </button>
                <button
                  type="button"
                  onClick={openPurchases}
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:border-[#C8722C] hover:bg-[#F7F0E7]"
                >
                  Minhas compras
                </button>
                <button
                  type="button"
                  onClick={openWishlist}
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:border-[#C8722C] hover:bg-[#F7F0E7]"
                >
                  Minha lista de desejos
                </button>
                <button
                  type="button"
                  onClick={openProfileEdit}
                  disabled={profileLoading}
                  className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:border-[#C8722C] hover:bg-[#F7F0E7] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar conta
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-[#C8722C] bg-transparent px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                >
                  Sair da conta
                </button>
              </div>
            ) : modalMode === 'purchases' ? (
              <div className="space-y-4">
                {comprasLoading ? (
                  <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-8 text-center text-sm text-[#6E625A]">
                    Carregando suas compras...
                  </div>
                ) : comprasError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {comprasError}
                  </div>
                ) : compras.length === 0 ? (
                  <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-8 text-center text-sm text-[#6E625A]">
                    Voce ainda nao possui compras registradas.
                  </div>
                ) : (
                  <div className="max-h-[58svh] space-y-3 overflow-y-auto pr-1">
                    {compras.map((compra) => (
                      <article key={compra.id} className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[#4A2D1A]">{compra.codigo}</p>
                            <p className="mt-1 text-xs text-[#6E625A]">
                              {new Date(compra.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#6E625A]">
                            {compra.status.replace('_', ' ')}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-1 text-[#6E625A]">
                          {compra.itens.map((item) => (
                            <li key={item.id}>
                              {item.quantidade_final || item.quantidade_original}x {item.nome} - Tam. {item.tamanho}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 font-bold text-[#241C17]">
                          Total: R$ {(compra.total_final ?? compra.total_original).toFixed(2)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setModalMode('account')}
                  className="w-full rounded-xl border border-[#C8722C] bg-transparent px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                >
                  Voltar
                </button>
              </div>
            ) : modalMode === 'wishlist' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-8 text-center text-sm leading-relaxed text-[#6E625A]">
                  A lista de desejos ainda nao esta implementada. A estrutura da conta ja esta preparada para conectar os favoritos quando a funcionalidade for criada.
                </div>
                <button
                  type="button"
                  onClick={() => setModalMode('account')}
                  className="w-full rounded-xl border border-[#C8722C] bg-transparent px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                >
                  Voltar
                </button>
              </div>
            ) : modalMode === 'edit' ? (
              <>
                <form onSubmit={handleProfileSubmit} className="grid max-h-[70svh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Nome</span>
                    <input
                      value={profileNome}
                      onChange={(event) => setProfileNome(event.target.value)}
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">CPF</span>
                    <input
                      value={profileCpf}
                      onChange={(event) => setProfileCpf(formatCpf(event.target.value))}
                      inputMode="numeric"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="000.000.000-00"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Celular</span>
                    <input
                      value={profileCelular}
                      onChange={(event) => setProfileCelular(formatPhone(event.target.value))}
                      inputMode="tel"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="(68) 99999-9999"
                      required
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">E-mail</span>
                    <input
                      value={profileEmail}
                      onChange={(event) => setProfileEmail(event.target.value.toLowerCase())}
                      type="email"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="voce@email.com"
                      required
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Endereco completo opcional</span>
                    <textarea
                      value={profileEndereco}
                      onChange={(event) => setProfileEndereco(event.target.value)}
                      className="min-h-20 w-full resize-y rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="Rua, numero, bairro, cidade e complemento"
                    />
                  </label>

                  {profileError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2">
                      {profileError}
                    </div>
                  )}

                  <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileError('');
                        setModalMode('account');
                      }}
                      className="rounded-xl border border-[#C8722C] bg-transparent px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {profileSaving ? 'Salvando...' : 'Salvar dados'}
                    </button>
                  </div>
                </form>
                <p className="mt-4 text-center text-xs leading-relaxed text-[#6E625A]">
                  Se o celular for alterado, ele tambem passa a ser o celular de acesso do cliente.
                </p>
              </>
            ) : modalMode === 'cadastro' ? (
              <>
                <form onSubmit={handleCadastroSubmit} className="grid max-h-[70svh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Nome</span>
                    <input
                      value={cadastroNome}
                      onChange={(event) => setCadastroNome(event.target.value)}
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">CPF</span>
                    <input
                      value={cadastroCpf}
                      onChange={(event) => setCadastroCpf(formatCpf(event.target.value))}
                      inputMode="numeric"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="000.000.000-00"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Celular</span>
                    <input
                      value={cadastroCelular}
                      onChange={(event) => setCadastroCelular(formatPhone(event.target.value))}
                      inputMode="tel"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="(68) 99999-9999"
                      required
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">E-mail</span>
                    <input
                      value={cadastroEmail}
                      onChange={(event) => setCadastroEmail(event.target.value.toLowerCase())}
                      type="email"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="voce@email.com"
                      required
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Endereco completo opcional</span>
                    <textarea
                      value={cadastroEndereco}
                      onChange={(event) => setCadastroEndereco(event.target.value)}
                      className="min-h-20 w-full resize-y rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="Rua, numero, bairro, cidade e complemento"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Senha</span>
                    <input
                      value={cadastroSenha}
                      onChange={(event) => setCadastroSenha(event.target.value)}
                      type="password"
                      minLength={8}
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Confirmar senha</span>
                    <input
                      value={cadastroConfirmarSenha}
                      onChange={(event) => setCadastroConfirmarSenha(event.target.value)}
                      type="password"
                      minLength={8}
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      required
                    />
                  </label>

                  {cadastroError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2">
                      {cadastroError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                  >
                    {isRegistering ? 'Criando cadastro...' : 'Criar cadastro'}
                  </button>
                </form>

                <p className="mt-5 text-center text-sm text-[#6E625A]">
                  Ja tenho cadastro.{' '}
                  <button
                    type="button"
                    onClick={openLogin}
                    className="font-bold text-[#C8722C] hover:text-[#4A2D1A]"
                  >
                    Entrar
                  </button>
                </p>
              </>
            ) : (
              <>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Celular</span>
                    <input
                      value={celular}
                      onChange={(event) => setCelular(formatPhone(event.target.value))}
                      inputMode="tel"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="(68) 99999-9999"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Senha</span>
                    <input
                      value={senha}
                      onChange={(event) => setSenha(event.target.value)}
                      type="password"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      required
                    />
                  </label>

                  {loginError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {loginError}
                    </div>
                  )}

                  {loginSuccess && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      {loginSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoggingIn ? 'Entrando...' : 'Entrar'}
                  </button>
                </form>

                <p className="mt-4 text-center text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode(null);
                      router.push('/recuperar-senha');
                    }}
                    className="font-bold text-[#C8722C] hover:text-[#4A2D1A]"
                  >
                    Esqueci minha senha
                  </button>
                </p>

                <p className="mt-5 text-center text-sm text-[#6E625A]">
                  Ainda nao tem cadastro?{' '}
                  <button
                    type="button"
                    onClick={openCadastro}
                    className="font-bold text-[#C8722C] hover:text-[#4A2D1A]"
                  >
                    Cadastre-se
                  </button>
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </ClienteAuthContext.Provider>
  );
}
