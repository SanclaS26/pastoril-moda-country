import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const resetAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const current = resetAttempts.get(key);

  if (!current || current.resetAt <= now) {
    resetAttempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }

  if (current.count >= 5) {
    return false;
  }

  current.count += 1;
  return true;
}

function pick(chars: string) {
  return chars[randomInt(chars.length)];
}

function shuffle(value: string[]) {
  for (let index = value.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [value[index], value[swapIndex]] = [value[swapIndex], value[index]];
  }

  return value.join('');
}

function generateTemporaryPassword() {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const symbols = '!@#$%&*?+-_';
  const all = lower + upper + numbers + symbols;
  const chars = [pick(lower), pick(upper), pick(numbers), pick(symbols)];

  while (chars.length < 14) {
    chars.push(pick(all));
  }

  return shuffle(chars);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { id } = await context.params;
  const rateKey = `${authorization.user.id}:${id}`;

  if (!checkRateLimit(rateKey)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' }, { status: 429 });
  }

  const { data: cliente, error: clienteError } = await authorization.supabaseAdmin
    .from('clientes')
    .select('id, auth_user_id, nome, email')
    .eq('id', id)
    .maybeSingle();

  if (clienteError) {
    return NextResponse.json({ error: `Erro ao localizar cliente: ${clienteError.message}` }, { status: 500 });
  }

  if (!cliente?.auth_user_id) {
    return NextResponse.json({ error: 'Cliente sem usuario de autenticacao vinculado.' }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();

  const { error: passwordError } = await authorization.supabaseAdmin.auth.admin.updateUserById(
    cliente.auth_user_id,
    { password: temporaryPassword },
  );

  if (passwordError) {
    return NextResponse.json({ error: `Nao foi possivel redefinir a senha: ${passwordError.message}` }, { status: 500 });
  }

  const { error: flagError } = await authorization.supabaseAdmin
    .from('clientes')
    .update({ must_change_password: true })
    .eq('id', cliente.id);

  if (flagError) {
    return NextResponse.json(
      { error: `Senha temporaria gerada, mas nao foi possivel marcar troca obrigatoria: ${flagError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    cliente: {
      email: cliente.email,
      id: cliente.id,
      nome: cliente.nome,
    },
    temporaryPassword,
    warning: 'O cliente sera obrigado a criar uma nova senha no proximo acesso.',
  });
}
