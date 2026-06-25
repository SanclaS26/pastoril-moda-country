import { NextResponse } from 'next/server';
import {
  isValidCpf,
  normalizeCpf,
  normalizeClientePhone,
  normalizeRequiredEmail,
} from '@/lib/cliente-utils';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteInsert } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
}

function getErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;
}

function isAlreadyRegisteredError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('already') ||
    message.includes('duplicate') ||
    message.includes('already registered') ||
    message.includes('unique')
  );
}

function isPasswordError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return message.includes('password') || message.includes('senha') || message.includes('weak');
}

export async function POST(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar cadastro de clientes.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const nome = String(body?.nome ?? '').trim();
    const cpf = normalizeCpf(String(body?.cpf ?? ''));
    const celular = normalizeClientePhone(String(body?.celular ?? ''));
    const senha = String(body?.senha ?? '');
    const confirmarSenha = String(body?.confirmarSenha ?? '');
    const emailInput = String(body?.email ?? '').trim();
    const email = normalizeRequiredEmail(emailInput);
    const enderecoCompleto = String(body?.enderecoCompleto ?? '').trim() || null;

    if (!nome || !cpf || !celular || !emailInput || !senha || !confirmarSenha) {
      return NextResponse.json({ error: 'Preencha nome, CPF, celular, e-mail, senha e confirmacao da senha.' }, { status: 400 });
    }

    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF invalido.' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'E-mail invalido.' }, { status: 400 });
    }

    if (senha.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json({ error: 'A confirmacao da senha nao confere.' }, { status: 400 });
    }

    const [{ data: existingCpf, error: cpfError }, { data: existingPhone, error: phoneError }, { data: existingEmail, error: emailError }, { data: authUsers, error: authUsersError }] = await Promise.all([
      supabaseAdmin.from('clientes').select('id').eq('cpf', cpf).maybeSingle(),
      supabaseAdmin.from('clientes').select('id').eq('celular', celular.dbPhone).maybeSingle(),
      supabaseAdmin.from('clientes').select('id').eq('email', email).maybeSingle(),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (cpfError || phoneError || emailError) {
      return NextResponse.json({ error: 'Erro ao verificar CPF, celular ou e-mail cadastrado.' }, { status: 500 });
    }

    if (authUsersError) {
      console.info('[cliente-cadastro-auth-users-error]', {
        code: getErrorCode(authUsersError),
        message: getErrorMessage(authUsersError),
      });

      return NextResponse.json({ error: 'Falha ao verificar usuarios existentes no Supabase Auth.' }, { status: 500 });
    }

    if (existingCpf) {
      return NextResponse.json({ error: 'Ja existe um cadastro com este CPF.' }, { status: 409 });
    }

    if (existingPhone) {
      return NextResponse.json({ error: 'Ja existe um cadastro com este celular.' }, { status: 409 });
    }

    if (existingEmail) {
      return NextResponse.json({ error: 'Ja existe um cadastro com este e-mail.' }, { status: 409 });
    }

    const existingAuthUser = authUsers.users.find((user) => user.email?.toLowerCase() === email);

    if (existingAuthUser) {
      return NextResponse.json({ error: 'Ja existe um acesso de login com este e-mail.' }, { status: 409 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: senha,
      user_metadata: {
        celular: celular.dbPhone,
        email,
        nome,
        tipo: 'cliente',
      },
    });

    if (isAlreadyRegisteredError(authError)) {
      return NextResponse.json({ error: 'Ja existe um acesso cadastrado para este e-mail.' }, { status: 409 });
    }

    if (isPasswordError(authError)) {
      return NextResponse.json({ error: 'Senha invalida. Use uma senha com pelo menos 8 caracteres.' }, { status: 400 });
    }

    if (authError || !authData?.user) {
      console.info('[cliente-cadastro-create-auth-error]', {
        code: getErrorCode(authError),
        message: getErrorMessage(authError),
      });

      return NextResponse.json(
        { error: `Falha ao criar usuario no Supabase Auth: ${authError?.message || 'usuario nao retornado.'}` },
        { status: 500 },
      );
    }

    const authUser = authData.user;

    if (authUser.email?.toLowerCase() !== email || !authUser.email_confirmed_at) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      return NextResponse.json(
        {
          error:
            'Falha ao confirmar usuario no Supabase Auth. O e-mail do cliente nao foi criado ou confirmado corretamente.',
        },
        { status: 500 },
      );
    }

    const payload: ClienteInsert = {
      celular: celular.dbPhone,
      cpf,
      email,
      endereco_completo: enderecoCompleto,
      must_change_password: false,
      nome,
      auth_user_id: authUser.id,
    };

    const { data: cliente, error: insertError } = await supabaseAdmin
      .from('clientes')
      .insert([payload])
      .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo')
      .single();

    if (insertError || !cliente) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      if (isAlreadyRegisteredError(insertError)) {
        return NextResponse.json({ error: 'CPF ou celular ja cadastrado.' }, { status: 409 });
      }

      return NextResponse.json(
        { error: `Falha ao criar perfil em clientes: ${insertError?.message ?? 'cliente nao retornado.'}` },
        { status: 500 },
      );
    }

    const [{ data: confirmedAuthUser, error: confirmAuthError }, { data: confirmedCliente, error: confirmClienteError }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(authUser.id),
      supabaseAdmin
        .from('clientes')
        .select('id, auth_user_id, celular, email')
        .eq('auth_user_id', authUser.id)
        .maybeSingle(),
    ]);

    if (
      confirmAuthError ||
      !confirmedAuthUser.user ||
      confirmedAuthUser.user.email?.toLowerCase() !== email ||
      !confirmedAuthUser.user.email_confirmed_at ||
      confirmClienteError ||
      !confirmedCliente ||
      confirmedCliente.auth_user_id !== authUser.id ||
      confirmedCliente.celular !== celular.dbPhone ||
      confirmedCliente.email !== email
    ) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      await supabaseAdmin.from('clientes').delete().eq('auth_user_id', authUser.id);

      return NextResponse.json(
        {
          error:
            'Falha ao confirmar cadastro completo. O usuario do Auth e o perfil do cliente nao ficaram consistentes.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      cliente,
      auth: {
        email_confirmed: Boolean(confirmedAuthUser.user.email_confirmed_at),
        user_id: authUser.id,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao cadastrar cliente.' }, { status: 500 });
  }
}
