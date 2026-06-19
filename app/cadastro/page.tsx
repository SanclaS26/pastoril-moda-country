'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInClienteWithPhone } from '@/lib/cliente-login';
import { formatCpf, formatPhone, normalizeClientePhone } from '@/lib/cliente-utils';

export default function ClienteCadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [celular, setCelular] = useState('');
  const [email, setEmail] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/clientes/cadastro', {
        body: JSON.stringify({
          celular,
          confirmarSenha,
          cpf,
          email,
          enderecoCompleto,
          nome,
          senha,
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

      const normalizedPhone = normalizeClientePhone(celular);

      if (normalizedPhone) {
        try {
          await signInClienteWithPhone(celular, senha);
          router.push('/minha-conta');
          return;
        } catch {
          setSuccess('Cadastro criado com sucesso. Entre com seu celular e senha.');
        }
      }

      setSuccess('Cadastro criado com sucesso. Entre com seu celular e senha.');
      router.push('/login');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro inesperado no cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[100svh] bg-[#F9F6F1] px-5 py-8 text-[#241C17]">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E7E0D8] bg-white/95 p-6 shadow-[0_14px_36px_rgba(74,45,26,0.08)] sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/brand/pastoril-logo-header.png"
            alt="Pastoril Moda Country"
            width={130}
            height={80}
            priority
            className="h-auto w-[120px] object-contain"
          />
          <h1 className="mt-5 text-2xl font-bold text-[#4A2D1A]">Criar cadastro</h1>
          <p className="mt-2 text-sm leading-6 text-[#6E625A]">
            Use seu celular e uma senha para acessar sua conta Pastoril.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Nome</span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">CPF</span>
            <input
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              inputMode="numeric"
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              placeholder="000.000.000-00"
              required
            />
          </label>

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

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">E-mail opcional</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              placeholder="voce@email.com"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Endereco completo opcional</span>
            <textarea
              value={enderecoCompleto}
              onChange={(event) => setEnderecoCompleto(event.target.value)}
              className="min-h-24 w-full resize-y rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              placeholder="Rua, numero, bairro, cidade e complemento"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Senha</span>
            <input
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              type="password"
              minLength={8}
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#4A2D1A]">Confirmar senha</span>
            <input
              value={confirmarSenha}
              onChange={(event) => setConfirmarSenha(event.target.value)}
              type="password"
              minLength={8}
              className="w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-[#241C17] outline-none focus:border-[#C8722C] focus:ring-4 focus:ring-[#C8722C]/10"
              required
            />
          </label>

          {(error || success) && (
            <div
              className={`sm:col-span-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {error || success}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="sm:col-span-2 rounded-xl bg-[#C8722C] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Criando cadastro...' : 'Criar cadastro'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6E625A]">
          Ja tem conta?{' '}
          <Link href="/login" className="font-bold text-[#C8722C] hover:text-[#4A2D1A]">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
