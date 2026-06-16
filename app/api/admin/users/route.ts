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

function isEmailAlreadyRegisteredError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('email_exists') ||
    message.includes('user already')
  );
}

async function isActiveAdmin(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email: string | undefined
) {
  const { data: adminByUserId, error: userIdError } = await supabaseAdmin
    .from('admin_users')
    .select('id, ativo')
    .eq('user_id', userId)
    .eq('ativo', true)
    .maybeSingle();

  if (userIdError) {
    throw new Error('Erro ao verificar permissões administrativas.');
  }

  if (adminByUserId) {
    return true;
  }

  if (!email) {
    return false;
  }

  const { data: adminByEmail, error: emailError } = await supabaseAdmin
    .from('admin_users')
    .select('id, ativo')
    .eq('email', email)
    .eq('ativo', true)
    .maybeSingle();

  if (emailError) {
    throw new Error('Erro ao verificar permissões administrativas.');
  }

  return Boolean(adminByEmail);
}

async function getAuthorizedSupabaseAdmin(request: Request) {
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
    data: { user: currentUser },
    error: sessionError,
  } = await supabaseAdmin.auth.getUser(token);

  if (isInvalidApiKeyError(sessionError)) {
    return {
      response: NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY inválida para este projeto.' }, { status: 500 }),
    };
  }

  if (sessionError || !currentUser) {
    return { response: NextResponse.json({ error: 'Sessão administrativa inválida ou expirada.' }, { status: 401 }) };
  }

  try {
    const hasPermission = await isActiveAdmin(supabaseAdmin, currentUser.id, currentUser.email);

    if (!hasPermission) {
      return { response: NextResponse.json({ error: 'Usuário sem permissão administrativa.' }, { status: 403 }) };
    }
  } catch (error) {
    return {
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : 'Erro ao verificar permissões administrativas.' },
        { status: 500 }
      ),
    };
  }

  return { supabaseAdmin };
}

export async function GET(request: Request) {
  const authorization = await getAuthorizedSupabaseAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { data, error } = await authorization.supabaseAdmin
    .from('admin_users')
    .select('id, user_id, nome, email, ativo')
    .order('id', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Erro ao carregar usuários administrativos: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const authorization = await getAuthorizedSupabaseAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { supabaseAdmin } = authorization;

  try {
    const body = await request.json();
    const { nome, email, senha } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (isInvalidApiKeyError(userError)) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY inválida para criar usuários.' }, { status: 500 });
    }

    if (isEmailAlreadyRegisteredError(userError)) {
      return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 409 });
    }

    if (userError) {
      return NextResponse.json({ error: `Erro ao criar usuário no Supabase Auth: ${userError.message}` }, { status: 500 });
    }

    if (!userData?.user) {
      return NextResponse.json({ error: 'Falha ao criar usuário no Supabase Auth.' }, { status: 500 });
    }

    const userId = userData.user.id;

    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from('admin_users')
      .insert([{ user_id: userId, nome, email, ativo: true }])
      .select('id, user_id, nome, email, ativo')
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: `Erro ao inserir usuário na tabela admin_users: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: insertedUser ?? { user_id: userId, nome, email, ativo: true } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, { status: 500 });
  }
}
