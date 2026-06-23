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

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('id, auth_user_id, nome, celular, email, must_change_password')
      .eq('celular', normalizedPhone.dbPhone)
      .maybeSingle();

    if (clienteError) {
      return NextResponse.json({ error: `Nao foi possivel verificar o cadastro: ${clienteError.message}` }, { status: 500 });
    }

    if (!cliente?.auth_user_id) {
      return NextResponse.json(
        {
          error:
            'Nao existe usuario no Supabase Auth para este celular. Refaca o cadastro ou verifique se ele foi criado corretamente.',
        },
        { status: 404 },
      );
    }

    const { data: authUserData, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(cliente.auth_user_id);
    const authUser = authUserData.user;

    if (authLookupError || !authUser?.email) {
      return NextResponse.json(
        { error: `Nao foi possivel localizar o acesso do cliente: ${getAuthErrorMessage(authLookupError)}` },
        { status: 500 },
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
      email: authUser.email,
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
      cliente: {
        email: cliente.email,
        must_change_password: cliente.must_change_password,
      },
      session: {
        access_token: loginData.session.access_token,
        refresh_token: loginData.session.refresh_token,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao autenticar cliente.' }, { status: 500 });
  }
}
