import { NextResponse } from 'next/server';
import {
  isValidCpf,
  normalizeClientePhone,
  normalizeOptionalEmail,
  onlyDigits,
} from '@/lib/cliente-utils';
import { getSupabaseAdmin, SupabaseAdminConfigError, type ClienteInsert } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
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
    const cpf = onlyDigits(String(body?.cpf ?? ''));
    const celular = normalizeClientePhone(String(body?.celular ?? ''));
    const senha = String(body?.senha ?? '');
    const confirmarSenha = String(body?.confirmarSenha ?? '');
    const emailInput = String(body?.email ?? '').trim();
    const email = normalizeOptionalEmail(emailInput);
    const enderecoCompleto = String(body?.enderecoCompleto ?? '').trim() || null;

    if (!nome || !cpf || !celular || !senha || !confirmarSenha) {
      return NextResponse.json({ error: 'Preencha nome, CPF, celular, senha e confirmacao da senha.' }, { status: 400 });
    }

    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF invalido.' }, { status: 400 });
    }

    if (emailInput && !email) {
      return NextResponse.json({ error: 'E-mail invalido.' }, { status: 400 });
    }

    if (senha.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json({ error: 'A confirmacao da senha nao confere.' }, { status: 400 });
    }

    const [{ data: existingCpf, error: cpfError }, { data: existingPhone, error: phoneError }] = await Promise.all([
      supabaseAdmin.from('clientes').select('id').eq('cpf', cpf).maybeSingle(),
      supabaseAdmin.from('clientes').select('id').eq('celular', celular.dbPhone).maybeSingle(),
    ]);

    if (cpfError || phoneError) {
      return NextResponse.json({ error: 'Erro ao verificar CPF ou celular cadastrado.' }, { status: 500 });
    }

    if (existingCpf) {
      return NextResponse.json({ error: 'Ja existe um cadastro com este CPF.' }, { status: 409 });
    }

    if (existingPhone) {
      return NextResponse.json({ error: 'Ja existe um cadastro com este celular.' }, { status: 409 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email ?? undefined,
      email_confirm: Boolean(email),
      password: senha,
      phone: celular.authPhone,
      phone_confirm: true,
      user_metadata: {
        nome,
        tipo: 'cliente',
      },
    });

    if (isAlreadyRegisteredError(authError)) {
      return NextResponse.json({ error: 'Ja existe um acesso cadastrado para este celular ou e-mail.' }, { status: 409 });
    }

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message || 'Erro ao criar acesso do cliente.' },
        { status: 500 },
      );
    }

    const payload: ClienteInsert = {
      celular: celular.dbPhone,
      cpf,
      email,
      endereco_completo: enderecoCompleto,
      nome,
      auth_user_id: authData.user.id,
    };

    const { data: cliente, error: insertError } = await supabaseAdmin
      .from('clientes')
      .insert([payload])
      .select('id, auth_user_id, nome, cpf, celular, email, endereco_completo')
      .single();

    if (insertError || !cliente) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      if (isAlreadyRegisteredError(insertError)) {
        return NextResponse.json({ error: 'CPF ou celular ja cadastrado.' }, { status: 409 });
      }

      return NextResponse.json(
        { error: `Erro ao salvar cadastro do cliente: ${insertError?.message ?? 'cliente nao retornado.'}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ cliente }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao cadastrar cliente.' }, { status: 500 });
  }
}
