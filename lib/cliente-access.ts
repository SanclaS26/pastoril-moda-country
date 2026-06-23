import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteRow } from '@/lib/supabase-admin';

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export async function requireClienteSession(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
    }

    return { response: NextResponse.json({ error: 'Erro ao configurar area do cliente.' }, { status: 500 }) };
  }

  const token = getBearerToken(request);

  if (!token) {
    return { response: NextResponse.json({ error: 'Sessao do cliente ausente.' }, { status: 401 }) };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { response: NextResponse.json({ error: 'Sessao invalida ou expirada.' }, { status: 401 }) };
  }

  return { response: undefined, supabaseAdmin, user };
}

export async function getClienteByUserId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  columns = 'id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password',
) {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select(columns)
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar perfil: ${error.message}`);
  }

  return (data as ClienteRow | null) ?? null;
}

export function getClienteAccessBlock(cliente: Pick<ClienteRow, 'email' | 'must_change_password'> | null) {
  if (!cliente) {
    return { error: 'Perfil de cliente nao encontrado.', status: 404 };
  }

  if (cliente.must_change_password) {
    return { code: 'MUST_CHANGE_PASSWORD', error: 'Altere sua senha antes de continuar.', status: 403 };
  }

  if (!cliente.email) {
    return { code: 'EMAIL_REQUIRED', error: 'Cadastre seu e-mail antes de continuar.', status: 403 };
  }

  return null;
}

export async function requireClienteReady(request: Request) {
  const authorization = await requireClienteSession(request);

  if (authorization.response) {
    return authorization;
  }

  try {
    const cliente = await getClienteByUserId(authorization.supabaseAdmin, authorization.user.id);
    const block = getClienteAccessBlock(cliente);

    if (block) {
      return {
        response: NextResponse.json(
          { code: block.code, error: block.error },
          { status: block.status },
        ),
      };
    }

    return {
      cliente: cliente as ClienteRow,
      response: undefined,
      supabaseAdmin: authorization.supabaseAdmin,
      user: authorization.user as User,
    };
  } catch (error) {
    return {
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : 'Erro ao validar acesso do cliente.' },
        { status: 500 },
      ),
    };
  }
}
