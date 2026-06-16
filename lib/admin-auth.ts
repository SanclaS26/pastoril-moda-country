import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function getErrorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
}

function isInvalidApiKeyError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
    ? error.status
    : null;

  return message.includes('invalid api key') || (status === 401 && message.includes('api key'));
}

export async function requireActiveAdmin(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
    }

    return {
      response: NextResponse.json({ error: 'Erro ao configurar o cliente administrativo do Supabase.' }, { status: 500 }),
    };
  }

  const token = getBearerToken(request);

  if (!token) {
    return { response: NextResponse.json({ error: 'Sessão administrativa ausente.' }, { status: 401 }) };
  }

  const {
    data: { user },
    error: sessionError,
  } = await supabaseAdmin.auth.getUser(token);

  if (isInvalidApiKeyError(sessionError)) {
    return {
      response: NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY inválida para este projeto.' }, { status: 500 }),
    };
  }

  if (sessionError || !user) {
    return { response: NextResponse.json({ error: 'Sessão administrativa inválida ou expirada.' }, { status: 401 }) };
  }

  const { data: adminByUserId, error: userIdError } = await supabaseAdmin
    .from('admin_users')
    .select('id, ativo')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .maybeSingle();

  if (userIdError) {
    return {
      response: NextResponse.json({ error: 'Erro ao verificar permissões administrativas.' }, { status: 500 }),
    };
  }

  if (adminByUserId) {
    return { supabaseAdmin, user };
  }

  if (!user.email) {
    return { response: NextResponse.json({ error: 'Usuário sem permissão administrativa.' }, { status: 403 }) };
  }

  const { data: adminByEmail, error: emailError } = await supabaseAdmin
    .from('admin_users')
    .select('id, ativo')
    .eq('email', user.email)
    .eq('ativo', true)
    .maybeSingle();

  if (emailError) {
    return {
      response: NextResponse.json({ error: 'Erro ao verificar permissões administrativas.' }, { status: 500 }),
    };
  }

  if (!adminByEmail) {
    return { response: NextResponse.json({ error: 'Usuário sem permissão administrativa.' }, { status: 403 }) };
  }

  return { supabaseAdmin, user };
}
