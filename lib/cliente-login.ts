'use client';

import { clienteSupabase } from '@/lib/supabase-cliente';

export async function signInClienteWithPhone(celular: string, senha: string) {
  const response = await fetch('/api/clientes/login', {
    body: JSON.stringify({ celular, senha }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Nao foi possivel autenticar o cliente.');
  }

  if (!data?.session?.access_token || !data?.session?.refresh_token) {
    throw new Error('Sessao de cliente nao foi retornada pelo Supabase Auth.');
  }

  const { error } = await clienteSupabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (error) {
    throw new Error(error.message);
  }
}
