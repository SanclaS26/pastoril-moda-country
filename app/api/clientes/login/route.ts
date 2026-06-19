import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { normalizeClientePhone } from '@/lib/cliente-utils';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function getAuthErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;
}

function getAuthErrorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'Erro desconhecido no Supabase Auth.';
}

export async function POST(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar login de cliente.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const normalizedPhone = normalizeClientePhone(String(body?.celular ?? ''));
    const password = String(body?.senha ?? '');

    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Informe um celular valido com DDD.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Informe a senha.' }, { status: 400 });
    }

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      console.info('[cliente-login-auth-users-error]', {
        code: getAuthErrorCode(usersError),
        message: getAuthErrorMessage(usersError),
      });

      return NextResponse.json(
        { error: `Nao foi possivel verificar o usuario no Supabase Auth: ${getAuthErrorMessage(usersError)}` },
        { status: 500 },
      );
    }

    const authUser = usersData.users.find((user) => user.email?.toLowerCase() === normalizedPhone.technicalEmail);

    if (!authUser) {
      return NextResponse.json(
        {
          error:
            'Nao existe usuario no Supabase Auth para este celular. Refaca o cadastro ou verifique se ele foi criado corretamente.',
        },
        { status: 404 },
      );
    }

    if (!authUser.email_confirmed_at) {
      return NextResponse.json(
        {
          error:
            'O usuario existe no Supabase Auth, mas o e-mail tecnico ainda nao esta confirmado.',
        },
        { status: 409 },
      );
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: loginData, error: loginError } = await supabaseAuth.auth.signInWithPassword({
      email: normalizedPhone.technicalEmail,
      password,
    });

    if (loginError || !loginData.session) {
      console.info('[cliente-login-auth-error]', {
        code: getAuthErrorCode(loginError),
        message: getAuthErrorMessage(loginError),
      });

      const message = getAuthErrorMessage(loginError);
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('provider') || lowerMessage.includes('email')) {
        return NextResponse.json(
          {
            error:
              `${message}. Verifique se o usuario foi criado com o e-mail tecnico derivado do celular.`,
          },
          { status: 401 },
        );
      }

      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({
      session: {
        access_token: loginData.session.access_token,
        refresh_token: loginData.session.refresh_token,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao autenticar cliente.' }, { status: 500 });
  }
}
