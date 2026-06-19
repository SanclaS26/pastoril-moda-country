'use client';

import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { formatCpf, formatPhone, normalizeClientePhone } from '@/lib/cliente-utils';
import { clienteSupabase } from '@/lib/supabase-cliente';

type ClienteAuthContextValue = {
  isClienteLoggedIn: boolean;
  openClienteAuth: () => void;
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
  const [modalMode, setModalMode] = useState<'login' | 'cadastro' | 'account' | null>(null);
  const [celular, setCelular] = useState('');
  const [senha, setSenha] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [cadastroNome, setCadastroNome] = useState('');
  const [cadastroCpf, setCadastroCpf] = useState('');
  const [cadastroCelular, setCadastroCelular] = useState('');
  const [cadastroEmail, setCadastroEmail] = useState('');
  const [cadastroEndereco, setCadastroEndereco] = useState('');
  const [cadastroSenha, setCadastroSenha] = useState('');
  const [cadastroConfirmarSenha, setCadastroConfirmarSenha] = useState('');
  const [cadastroError, setCadastroError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

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
    });

    return () => {
      activeRequest = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!modalMode) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalMode(null);
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modalMode]);

  const openClienteAuth = useCallback(() => {
    setLoginError('');
    setLoginSuccess('');
    setModalMode(clienteSession ? 'account' : 'login');
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

    const normalizedPhone = normalizeClientePhone(celular);

    if (!normalizedPhone) {
      setLoginError('Informe um celular valido com DDD.');
      return;
    }

    setIsLoggingIn(true);

    const { error } = await clienteSupabase.auth.signInWithPassword({
      password: senha,
      phone: normalizedPhone.authPhone,
    });

    setIsLoggingIn(false);

    if (error) {
      setLoginError('Celular ou senha invalidos.');
      return;
    }

    setCelular('');
    setSenha('');
    setModalMode(null);
    router.push('/minha-conta');
  };

  const handleLogout = async () => {
    await clienteSupabase.auth.signOut();
    setModalMode(null);
    router.refresh();
  };

  const handleCadastroSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCadastroError('');
    setLoginSuccess('');
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
        const { error } = await clienteSupabase.auth.signInWithPassword({
          password: cadastroSenha,
          phone: normalizedPhone.authPhone,
        });

        if (!error) {
          setCadastroNome('');
          setCadastroCpf('');
          setCadastroCelular('');
          setCadastroEmail('');
          setCadastroEndereco('');
          setCadastroSenha('');
          setCadastroConfirmarSenha('');
          setModalMode(null);
          router.push('/minha-conta');
          return;
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

  const value = useMemo(
    () => ({
      isClienteLoggedIn: Boolean(clienteSession),
      openClienteAuth,
    }),
    [clienteSession, openClienteAuth],
  );

  return (
    <ClienteAuthContext.Provider value={value}>
      {children}

      {modalMode && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fechar acesso do cliente"
            onClick={() => setModalMode(null)}
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
                    ? 'Conta do cliente'
                    : modalMode === 'cadastro'
                      ? 'Cadastro de cliente'
                      : 'Entrar como cliente'}
                </h2>
                <p className="mt-1 text-sm text-[#6E625A]">
                  {modalMode === 'account'
                    ? 'Acesse seus dados ou encerre a sessao.'
                    : modalMode === 'cadastro'
                      ? 'Crie seu acesso com celular e senha.'
                      : 'Acesse com celular e senha.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F0E7] text-xl leading-none text-[#4A2D1A] transition hover:bg-[#E7E0D8]"
                aria-label="Fechar"
              >
                x
              </button>
            </div>

            {modalMode === 'account' ? (
              <div className="space-y-3">
                <Link
                  href="/minha-conta"
                  onClick={() => setModalMode(null)}
                  className="block w-full rounded-xl bg-[#C8722C] px-6 py-3.5 text-center text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A]"
                >
                  Minha conta
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-[#C8722C] bg-transparent px-6 py-3.5 text-base font-bold text-[#4A2D1A] transition hover:bg-[#F7F0E7]"
                >
                  Sair
                </button>
              </div>
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
                    <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">E-mail opcional</span>
                    <input
                      value={cadastroEmail}
                      onChange={(event) => setCadastroEmail(event.target.value)}
                      type="email"
                      className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
                      placeholder="voce@email.com"
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
