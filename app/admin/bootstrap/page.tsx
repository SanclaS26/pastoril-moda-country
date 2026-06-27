'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

type BootstrapResponse = {
  error?: string;
};

const inputClassName =
  'admin-input w-full rounded-lg px-4 py-3 outline-none transition';

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export default function AdminBootstrapPage() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const trimmedName = nome.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Informe o nome do administrador.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (!password) {
      setError('Informe uma senha.');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (passwordConfirmation !== password) {
      setError('A confirmação da senha não confere.');
      return;
    }

    if (!secret) {
      setError('Informe a chave de bootstrap.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          email: trimmedEmail,
          password,
          nome: trimmedName,
          celular: normalizePhone(celular),
        }),
      });

      let data: BootstrapResponse = {};

      try {
        data = (await response.json()) as BootstrapResponse;
      } catch {
        data = {};
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError('Chave de bootstrap inválida.');
          return;
        }

        if (
          (response.status === 400 || response.status === 409) &&
          typeof data.error === 'string' &&
          data.error.length <= 240
        ) {
          setError(data.error);
          return;
        }

        setError('Não foi possível criar o administrador.');
        return;
      }

      setPassword('');
      setPasswordConfirmation('');
      setSecret('');
      setIsSuccess(true);
    } catch {
      setError('Não foi possível criar o administrador.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[color:var(--admin-bg)] px-4 text-[color:var(--admin-text)] sm:px-6">
      <Image
        src="/brand/login/login-bg2.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="z-0 object-cover object-[center_bottom]"
      />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(249,246,241,0.7)_0%,rgba(249,246,241,0.48)_60%,rgba(36,28,23,0.2)_100%)]" />

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[560px] items-start justify-center py-6 sm:py-10">
        <section className="admin-modal-surface w-full rounded-lg px-5 py-6 shadow-[0_18px_46px_rgba(74,45,26,0.14)] backdrop-blur-[2px] sm:px-9 sm:py-8">
          <div className="mx-auto mb-5 h-[68px] w-[100px]">
            <div className="relative h-full w-full">
              <Image
                src="/brand/pastoril-logo-header.png"
                alt="Pastoril Moda Country"
                fill
                priority
                sizes="100px"
                className="object-contain"
              />
            </div>
          </div>

          <header className="mb-6 text-center">
            <p className="text-xs font-bold uppercase text-[color:var(--admin-accent)]">Recuperação administrativa</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-[color:var(--admin-text)] sm:text-3xl">
              Criar primeiro administrador
            </h1>
            <p className="mx-auto mt-3 max-w-[430px] text-sm leading-6 text-[color:var(--admin-muted)]">
              Use esta página somente para recriar o primeiro administrador do sistema.
            </p>
          </header>

          {isSuccess ? (
            <div aria-live="polite" className="text-center">
              <div className="rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-soft)] px-4 py-4 text-sm font-semibold text-[color:var(--admin-text)]">
                Administrador criado com sucesso.
              </div>
              <Link
                href="/admin/login"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[color:var(--admin-accent)] px-5 py-3 font-bold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--admin-accent)]"
              >
                Ir para o login administrativo
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="nome" className="mb-1.5 block text-sm font-semibold text-[color:var(--admin-text)]">
                  Nome
                </label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  autoComplete="name"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className={inputClassName}
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[color:var(--admin-text)]">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClassName}
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <label htmlFor="celular" className="mb-1.5 block text-sm font-semibold text-[color:var(--admin-text)]">
                  Celular <span className="font-normal text-[color:var(--admin-muted)]">(opcional)</span>
                </label>
                <input
                  id="celular"
                  name="celular"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={celular}
                  onChange={(event) => setCelular(event.target.value)}
                  placeholder="(34) 99999-9999"
                  className={inputClassName}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[color:var(--admin-text)]">
                    Senha
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClassName}
                    disabled={isLoading}
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password-confirmation" className="mb-1.5 block text-sm font-semibold text-[color:var(--admin-text)]">
                    Confirmar senha
                  </label>
                  <input
                    id="password-confirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className={inputClassName}
                    disabled={isLoading}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bootstrap-secret" className="mb-1.5 block text-sm font-semibold text-[color:var(--admin-text)]">
                  Chave de bootstrap
                </label>
                <input
                  id="bootstrap-secret"
                  name="secret"
                  type="password"
                  autoComplete="off"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  className={inputClassName}
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-soft)] px-4 py-3 text-sm font-medium text-[color:var(--admin-text)]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="min-h-12 w-full rounded-lg bg-[color:var(--admin-accent)] px-6 py-3 font-bold text-white shadow-[0_10px_22px_rgba(200,114,44,0.2)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isLoading ? 'Criando administrador...' : 'Criar administrador'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
