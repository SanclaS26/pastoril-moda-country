import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const REQUIRED_CONFIRMATION = 'APAGAR_USUARIOS_DE_TESTE';

type CleanupAuthBody = {
  confirm?: unknown;
  secret?: unknown;
};

function secureSecretMatches(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!configuredSecret) {
    return jsonResponse({ error: 'Manutencao administrativa indisponivel.' }, 503);
  }

  let body: CleanupAuthBody;

  try {
    body = (await request.json()) as CleanupAuthBody;
  } catch {
    return jsonResponse({ error: 'Corpo JSON invalido.' }, 400);
  }

  const receivedSecret = typeof body.secret === 'string' ? body.secret : '';

  if (!receivedSecret || !secureSecretMatches(receivedSecret, configuredSecret)) {
    return jsonResponse({ error: 'Nao autorizado.' }, 401);
  }

  if (body.confirm !== REQUIRED_CONFIRMATION) {
    return jsonResponse(
      { error: `Confirmacao obrigatoria: ${REQUIRED_CONFIRMATION}.` },
      400,
    );
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return jsonResponse({ error: 'Manutencao administrativa indisponivel.' }, 503);
    }

    return jsonResponse({ error: 'Falha ao iniciar a manutencao administrativa.' }, 500);
  }

  let deletedUsers = 0;

  try {
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });

      if (error) {
        throw new Error('Falha ao listar usuarios do Supabase Auth.');
      }

      if (data.users.length === 0) {
        break;
      }

      for (const user of data.users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
          throw new Error('Falha ao remover usuario do Supabase Auth.');
        }

        deletedUsers += 1;
      }
    }

    return jsonResponse(
      {
        success: true,
        message: 'Usuarios do Supabase Auth removidos com sucesso.',
        deletedUsers,
      },
      200,
    );
  } catch {
    return jsonResponse(
      {
        error: 'A limpeza do Supabase Auth nao foi concluida.',
        deletedUsers,
      },
      500,
    );
  }
}
