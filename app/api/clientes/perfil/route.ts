import { NextResponse } from 'next/server';
import {
  getClienteTechnicalEmail,
  isValidCpf,
  isTechnicalClienteEmail,
  normalizeCpf,
  normalizeClientePhone,
  normalizeRequiredEmail,
} from '@/lib/cliente-utils';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteUpdate } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type ErrorDetails = {
  code?: string;
  message: string;
  name?: string;
  status?: number;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === 'string' ? value : undefined;
}

function getErrorDetails(error: unknown): ErrorDetails {
  const errorRecord = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const message = errorRecord && 'message' in errorRecord && errorRecord.message
    ? String(errorRecord.message)
    : error instanceof Error && error.message
      ? error.message
      : 'Erro desconhecido';
  const code = errorRecord && 'code' in errorRecord && errorRecord.code ? String(errorRecord.code) : undefined;
  const statusValue = errorRecord && 'status' in errorRecord ? Number(errorRecord.status) : undefined;

  return {
    code,
    message,
    name: error instanceof Error ? error.name : undefined,
    status: Number.isFinite(statusValue) ? statusValue : undefined,
  };
}

function isEmailAlreadyRegisteredError(details: ErrorDetails) {
  const message = details.message.toLowerCase();
  const code = details.code?.toLowerCase() ?? '';

  return (
    code.includes('email') ||
    code.includes('user_already_exists') ||
    message.includes('already') ||
    message.includes('registered') ||
    message.includes('email_exists') ||
    message.includes('duplicate') ||
    message.includes('unique')
  );
}

function getClientAuthUpdateMessage(error: unknown) {
  const details = getErrorDetails(error);

  if (isEmailAlreadyRegisteredError(details)) {
    return 'Este e-mail ja esta vinculado a outra conta. Use outro e-mail ou recupere o acesso a conta existente.';
  }

  if (details.status === 401 || details.status === 403 || details.message.toLowerCase().includes('api key')) {
    return 'Configuracao administrativa do Supabase invalida ou sem permissao para atualizar o acesso do cliente.';
  }

  return `Nao foi possivel atualizar o acesso do cliente: ${details.message}`;
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
    .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password')
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
    const parsedBody = await request.json();
    const body = parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
      ? parsedBody as Record<string, unknown>
      : {};

    const { data: currentCliente, error: currentError } = await authorization.supabaseAdmin
      .from('clientes')
      .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password')
      .eq('auth_user_id', authorization.user.id)
      .maybeSingle();

    if (currentError || !currentCliente) {
      return NextResponse.json({ error: 'Perfil de cliente nao encontrado.' }, { status: 404 });
    }

    const updates: ClienteUpdate = {};
    const nomeInput = getStringField(body, 'nome');
    const cpfInput = getStringField(body, 'cpf');
    const celularInput = getStringField(body, 'celular');
    const emailInput = getStringField(body, 'email');
    const enderecoInput = getStringField(body, 'enderecoCompleto');

    if (nomeInput !== undefined) {
      const normalizedNome = nomeInput.trim();
      if (!normalizedNome) {
        return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });
      }
      updates.nome = normalizedNome;
    }

    if (cpfInput !== undefined && cpfInput.trim() !== '') {
      const normalizedCpf = normalizeCpf(cpfInput);
      const currentCpf = normalizeCpf(currentCliente.cpf);

      if (normalizedCpf !== currentCpf) {
        if (normalizedCpf.length !== 11 || !isValidCpf(normalizedCpf)) {
          return NextResponse.json({ error: 'CPF invalido.' }, { status: 400 });
        }

        updates.cpf = normalizedCpf;
      }
    }

    if (celularInput !== undefined && celularInput.trim() !== '') {
      const normalizedPhone = normalizeClientePhone(celularInput);

      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Informe um celular valido com DDD.' }, { status: 400 });
      }

      updates.celular = normalizedPhone.dbPhone;
    }

    if (emailInput !== undefined) {
      const normalizedEmail = normalizeRequiredEmail(emailInput);

      if (!emailInput.trim() || !normalizedEmail) {
        return NextResponse.json({ error: 'E-mail invalido.' }, { status: 400 });
      }

      updates.email = normalizedEmail;
    }

    if (enderecoInput !== undefined && enderecoInput.trim() !== '') {
      updates.endereco_completo = enderecoInput.trim();
    }

    const nextNome = updates.nome ?? currentCliente.nome;
    const nextCelular = updates.celular ?? currentCliente.celular;
    const nextEmail = updates.email ?? currentCliente.email;

    if (!nextEmail) {
      return NextResponse.json({ error: 'E-mail invalido.' }, { status: 400 });
    }

    if (!currentCliente.auth_user_id) {
      return NextResponse.json(
        { error: 'Este cliente nao possui vinculo com uma conta do Supabase Auth.' },
        { status: 409 },
      );
    }

    if (currentCliente.auth_user_id !== authorization.user.id) {
      return NextResponse.json(
        { error: 'O vinculo de autenticacao do cliente nao corresponde a sessao atual.' },
        { status: 409 },
      );
    }

    if (updates.cpf && updates.cpf !== normalizeCpf(currentCliente.cpf)) {
      const { data, error } = await authorization.supabaseAdmin
        .from('clientes')
        .select('id, cpf')
        .neq('auth_user_id', authorization.user.id);

      if (error) {
        return NextResponse.json({ error: 'Erro ao verificar CPF cadastrado.' }, { status: 500 });
      }

      const duplicatedCpf = (data ?? []).find((cliente) => normalizeCpf(cliente.cpf ?? '') === updates.cpf);

      if (duplicatedCpf) {
        return NextResponse.json({ error: 'Ja existe um cadastro com este CPF.' }, { status: 409 });
      }
    }

    if (updates.celular && updates.celular !== currentCliente.celular) {
      const { data: existingPhone, error: phoneError } = await authorization.supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('celular', updates.celular)
        .neq('auth_user_id', authorization.user.id)
        .maybeSingle();

      if (phoneError) {
        return NextResponse.json({ error: 'Erro ao verificar celular cadastrado.' }, { status: 500 });
      }

      if (existingPhone) {
        return NextResponse.json({ error: 'Ja existe um cadastro com este celular.' }, { status: 409 });
      }
    }

    if (updates.email && updates.email !== currentCliente.email) {
      const { data: authUsers, error: authUsersError } = await authorization.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

      if (authUsersError) {
        return NextResponse.json(
          { error: `Erro ao verificar e-mail no Supabase Auth: ${getErrorDetails(authUsersError).message}` },
          { status: 500 },
        );
      }

      const existingAuthUser = authUsers.users.find((user) => user.email?.trim().toLowerCase() === updates.email);

      if (existingAuthUser && existingAuthUser.id !== currentCliente.auth_user_id) {
        const { data: linkedCliente, error: linkedClienteError } = await authorization.supabaseAdmin
          .from('clientes')
          .select('id, auth_user_id')
          .eq('auth_user_id', existingAuthUser.id)
          .maybeSingle();

        if (linkedClienteError) {
          return NextResponse.json({ error: 'Erro ao verificar o vinculo do e-mail informado.' }, { status: 500 });
        }

        if (linkedCliente) {
          return NextResponse.json(
            { error: 'Este e-mail ja esta vinculado a outra conta. Use outro e-mail ou recupere o acesso a conta existente em Esqueci minha senha.' },
            { status: 409 },
          );
        }

        return NextResponse.json(
          { error: 'Este e-mail pertence a uma conta antiga sem vinculo completo. Entre em contato com a administracao para corrigir o acesso com seguranca.' },
          { status: 409 },
        );
      }

      const { data: existingEmailProfiles, error: emailError } = await authorization.supabaseAdmin
        .from('clientes')
        .select('id, auth_user_id')
        .eq('email', updates.email);

      if (emailError) {
        return NextResponse.json({ error: 'Erro ao verificar e-mail cadastrado.' }, { status: 500 });
      }

      const conflictingProfile = (existingEmailProfiles ?? []).find((cliente) => cliente.auth_user_id !== currentCliente.auth_user_id);

      if (conflictingProfile?.auth_user_id) {
        return NextResponse.json(
          { error: 'Este e-mail ja esta vinculado a outra conta. Use outro e-mail ou recupere o acesso a conta existente em Esqueci minha senha.' },
          { status: 409 },
        );
      }

      if (conflictingProfile) {
        return NextResponse.json(
          { error: 'Este e-mail aparece em um cadastro antigo sem vinculo completo. Entre em contato com a administracao para corrigir o acesso com seguranca.' },
          { status: 409 },
        );
      }
    }

    const phoneChanged = nextCelular !== currentCliente.celular;
    const emailChanged = nextEmail !== currentCliente.email;
    const shouldUpdateAuthEmail = emailChanged || isTechnicalClienteEmail(authorization.user.email);

    if (phoneChanged || shouldUpdateAuthEmail) {
      const { data: linkedAuthUser, error: authLookupError } = await authorization.supabaseAdmin.auth.admin.getUserById(currentCliente.auth_user_id);

      if (authLookupError || !linkedAuthUser.user) {
        return NextResponse.json(
          { error: `Conta Auth vinculada ao cliente nao encontrada: ${getErrorDetails(authLookupError).message}` },
          { status: 409 },
        );
      }

      const { error: authUpdateError } = await authorization.supabaseAdmin.auth.admin.updateUserById(
        currentCliente.auth_user_id,
        {
          email: nextEmail,
          email_confirm: true,
          user_metadata: {
            ...(authorization.user.user_metadata ?? {}),
            celular: nextCelular,
            email: nextEmail,
            nome: nextNome,
          },
        },
      );

      if (authUpdateError) {
        return NextResponse.json(
          { error: getClientAuthUpdateMessage(authUpdateError) },
          { status: 500 },
        );
      }
    }

    const updatePayload: ClienteUpdate = updates;

    const { data: cliente, error } = await authorization.supabaseAdmin
      .from('clientes')
      .update(updatePayload)
      .eq('auth_user_id', authorization.user.id)
      .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo, must_change_password')
      .single();

    if (error || !cliente) {
      if (phoneChanged || shouldUpdateAuthEmail) {
        await authorization.supabaseAdmin.auth.admin.updateUserById(currentCliente.auth_user_id, {
          email: authorization.user.email || getClienteTechnicalEmail(currentCliente.celular),
          email_confirm: true,
          user_metadata: {
            ...(authorization.user.user_metadata ?? {}),
            celular: currentCliente.celular,
            email: currentCliente.email,
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
      message: phoneChanged || emailChanged
        ? 'Perfil atualizado. Seus dados de acesso tambem foram atualizados.'
        : 'Perfil atualizado com sucesso.',
    });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao atualizar perfil.' }, { status: 500 });
  }
}
