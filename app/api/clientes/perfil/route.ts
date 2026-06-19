import { NextResponse } from 'next/server';
import {
  getClienteTechnicalEmail,
  isValidCpf,
  normalizeClientePhone,
  normalizeOptionalEmail,
  onlyDigits,
} from '@/lib/cliente-utils';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteUpdate } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

async function requireCliente(request: Request) {
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

  return { supabaseAdmin, user };
}

export async function GET(request: Request) {
  const authorization = await requireCliente(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { data: cliente, error } = await authorization.supabaseAdmin
    .from('clientes')
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo')
    .eq('auth_user_id', authorization.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Erro ao carregar perfil: ${error.message}` }, { status: 500 });
  }

  if (!cliente) {
    return NextResponse.json({ error: 'Perfil de cliente nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ cliente });
}

export async function PATCH(request: Request) {
  const authorization = await requireCliente(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const body = await request.json();
    const nome = String(body?.nome ?? '').trim();
    const cpf = onlyDigits(String(body?.cpf ?? ''));
    const celular = normalizeClientePhone(String(body?.celular ?? ''));
    const emailInput = String(body?.email ?? '').trim();
    const email = normalizeOptionalEmail(emailInput);
    const enderecoCompleto = String(body?.enderecoCompleto ?? '').trim() || null;

    if (!nome) {
      return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });
    }

    if (!cpf || !isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF invalido.' }, { status: 400 });
    }

    if (!celular) {
      return NextResponse.json({ error: 'Informe um celular valido com DDD.' }, { status: 400 });
    }

    if (emailInput && !email) {
      return NextResponse.json({ error: 'E-mail invalido.' }, { status: 400 });
    }

    const [{ data: currentCliente, error: currentError }, { data: existingCpf }, { data: existingPhone }, { data: existingEmail }] =
      await Promise.all([
        authorization.supabaseAdmin
          .from('clientes')
          .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo')
          .eq('auth_user_id', authorization.user.id)
          .maybeSingle(),
        authorization.supabaseAdmin
          .from('clientes')
          .select('id')
          .eq('cpf', cpf)
          .neq('auth_user_id', authorization.user.id)
          .maybeSingle(),
        authorization.supabaseAdmin
          .from('clientes')
          .select('id')
          .eq('celular', celular.dbPhone)
          .neq('auth_user_id', authorization.user.id)
          .maybeSingle(),
        email
          ? authorization.supabaseAdmin
              .from('clientes')
              .select('id')
              .eq('email', email)
              .neq('auth_user_id', authorization.user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (currentError || !currentCliente) {
      return NextResponse.json({ error: 'Perfil de cliente nao encontrado.' }, { status: 404 });
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

    const phoneChanged = celular.dbPhone !== currentCliente.celular;

    if (phoneChanged) {
      const { error: authUpdateError } = await authorization.supabaseAdmin.auth.admin.updateUserById(
        authorization.user.id,
        {
          email: celular.technicalEmail,
          email_confirm: true,
          user_metadata: {
            ...(authorization.user.user_metadata ?? {}),
            celular: celular.dbPhone,
            nome,
          },
        },
      );

      if (authUpdateError) {
        return NextResponse.json(
          { error: `Nao foi possivel atualizar o acesso do cliente: ${authUpdateError.message}` },
          { status: 500 },
        );
      }
    }

    const updatePayload: ClienteUpdate = {
      celular: celular.dbPhone,
      cpf,
      email,
      endereco_completo: enderecoCompleto,
      nome,
    };

    const { data: cliente, error } = await authorization.supabaseAdmin
      .from('clientes')
      .update(updatePayload)
      .eq('auth_user_id', authorization.user.id)
      .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo')
      .single();

    if (error || !cliente) {
      if (phoneChanged) {
        await authorization.supabaseAdmin.auth.admin.updateUserById(authorization.user.id, {
          email: getClienteTechnicalEmail(currentCliente.celular),
          email_confirm: true,
          user_metadata: {
            ...(authorization.user.user_metadata ?? {}),
            celular: currentCliente.celular,
            nome: currentCliente.nome,
          },
        });
      }

      return NextResponse.json(
        { error: `Erro ao atualizar perfil: ${error?.message ?? 'cliente nao retornado.'}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      cliente,
      message: phoneChanged
        ? 'Perfil atualizado. Seu celular de acesso tambem foi atualizado.'
        : 'Perfil atualizado com sucesso.',
    });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao atualizar perfil.' }, { status: 500 });
  }
}
