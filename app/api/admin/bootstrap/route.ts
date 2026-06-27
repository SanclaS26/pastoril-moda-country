import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { normalizeClientePhone, normalizeRequiredEmail } from '@/lib/cliente-utils';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type BootstrapBody = {
  secret?: unknown;
  email?: unknown;
  password?: unknown;
  nome?: unknown;
  celular?: unknown;
  force?: unknown;
};

function secureSecretMatches(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email: string,
) {
  const perPage = 200;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error('Falha ao verificar os usuarios existentes no Supabase Auth.');
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }
  }
}

export async function POST(request: Request) {
  const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!configuredSecret) {
    return errorResponse('Bootstrap administrativo indisponivel.', 503);
  }

  let body: BootstrapBody;

  try {
    body = (await request.json()) as BootstrapBody;
  } catch {
    return errorResponse('Corpo JSON invalido.', 400);
  }

  const receivedSecret = typeof body.secret === 'string' ? body.secret : '';

  if (!receivedSecret || !secureSecretMatches(receivedSecret, configuredSecret)) {
    return errorResponse('Nao autorizado.', 401);
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = normalizeRequiredEmail(typeof body.email === 'string' ? body.email : '');
  const password = typeof body.password === 'string' ? body.password : '';
  const celularInput = typeof body.celular === 'string' ? body.celular.trim() : '';
  const celular = celularInput ? normalizeClientePhone(celularInput) : null;
  const force = body.force === true;

  if (!nome || nome.length > 120) {
    return errorResponse('Informe um nome valido com ate 120 caracteres.', 400);
  }

  if (!email) {
    return errorResponse('Informe um e-mail valido.', 400);
  }

  if (password.length < 8 || password.length > 128) {
    return errorResponse('A senha deve ter entre 8 e 128 caracteres.', 400);
  }

  if (celularInput && !celular) {
    return errorResponse('Informe um celular valido com DDD.', 400);
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return errorResponse('Bootstrap administrativo indisponivel.', 503);
    }

    return errorResponse('Falha ao iniciar o bootstrap administrativo.', 500);
  }

  const { count: activeAdminCount, error: countError } = await supabaseAdmin
    .from('admin_users')
    .select('id', { count: 'exact', head: true })
    .eq('ativo', true);

  if (countError) {
    return errorResponse('Falha ao verificar administradores existentes.', 500);
  }

  if ((activeAdminCount ?? 0) > 0 && !force) {
    return errorResponse('Ja existe administrador ativo. Envie force: true para confirmar a operacao.', 409);
  }

  let authUser: Awaited<ReturnType<typeof findAuthUserByEmail>> = null;
  let createdAuthUser = false;

  try {
    authUser = await findAuthUserByEmail(supabaseAdmin, email);

    const userMetadata = {
      nome,
      email,
      tipo: 'admin',
      ...(celular ? { celular: celular.dbPhone } : {}),
    };

    if (authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: {
          ...authUser.user_metadata,
          ...userMetadata,
        },
      });

      if (error || !data.user) {
        return errorResponse('Falha ao preparar o acesso administrativo.', 500);
      }

      authUser = data.user;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (error || !data.user) {
        return errorResponse('Falha ao criar o acesso administrativo.', 500);
      }

      authUser = data.user;
      createdAuthUser = true;
    }

    const { data: adminByUserId, error: userIdError } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (userIdError) {
      throw new Error('Falha ao verificar o perfil administrativo.');
    }

    const { data: adminByEmail, error: emailError } = adminByUserId
      ? { data: null, error: null }
      : await supabaseAdmin.from('admin_users').select('id').eq('email', email).maybeSingle();

    if (emailError) {
      throw new Error('Falha ao verificar o perfil administrativo.');
    }

    const existingAdminId = adminByUserId?.id ?? adminByEmail?.id;
    const adminPayload = {
      user_id: authUser.id,
      nome,
      email,
      ativo: true,
    };
    const { error: profileError } = existingAdminId
      ? await supabaseAdmin.from('admin_users').update(adminPayload).eq('id', existingAdminId)
      : await supabaseAdmin.from('admin_users').insert([adminPayload]);

    if (profileError) {
      throw new Error('Falha ao salvar o perfil administrativo.');
    }

    return NextResponse.json(
      { success: true, message: 'Administrador preparado com sucesso.' },
      {
        status: createdAuthUser ? 201 : 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    if (createdAuthUser && authUser) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    }

    return errorResponse('Falha ao concluir o bootstrap administrativo.', 500);
  }
}
