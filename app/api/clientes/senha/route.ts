import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getClienteByUserId, requireClienteSession } from '@/lib/cliente-access';

export const dynamic = 'force-dynamic';

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export async function POST(request: Request) {
  const authorization = await requireClienteSession(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const body = await request.json();
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');
    const confirmPassword = String(body?.confirmPassword ?? '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'Informe a senha atual, a nova senha e a confirmacao.' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'A confirmacao da nova senha nao confere.' }, { status: 400 });
    }

    if (newPassword === currentPassword) {
      return NextResponse.json({ error: 'A nova senha deve ser diferente da senha temporaria.' }, { status: 400 });
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        { error: 'Use ao menos 8 caracteres com maiusculas, minusculas, numeros e simbolos.' },
        { status: 400 },
      );
    }

    const cliente = await getClienteByUserId(authorization.supabaseAdmin, authorization.user.id);

    if (!cliente) {
      return NextResponse.json({ error: 'Perfil de cliente nao encontrado.' }, { status: 404 });
    }

    const authEmail = authorization.user.email;

    if (!authEmail) {
      return NextResponse.json({ error: 'Usuario sem e-mail de autenticacao.' }, { status: 422 });
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );

    const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({
      email: authEmail,
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.json({ error: 'Senha atual invalida.' }, { status: 401 });
    }

    const { error: updateError } = await authorization.supabaseAdmin.auth.admin.updateUserById(
      authorization.user.id,
      { password: newPassword },
    );

    if (updateError) {
      return NextResponse.json({ error: `Nao foi possivel alterar a senha: ${updateError.message}` }, { status: 500 });
    }

    const { error: profileError } = await authorization.supabaseAdmin
      .from('clientes')
      .update({ must_change_password: false })
      .eq('auth_user_id', authorization.user.id);

    if (profileError) {
      return NextResponse.json({ error: `Senha alterada, mas houve falha ao liberar a conta: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Senha alterada com sucesso.' });
  } catch {
    return NextResponse.json({ error: 'Erro inesperado ao alterar senha.' }, { status: 500 });
  }
}
