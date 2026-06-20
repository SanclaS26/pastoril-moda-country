import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TIME_ZONE = 'America/Rio_Branco';
const dayFormatter = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE, year: 'numeric' });

function getDateKey(date: Date) {
  const parts = dayFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function getDateKeys(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return getDateKey(date);
  });
}

function getDayStartIso(dateKey: string) {
  return new Date(`${dateKey}T05:00:00.000Z`).toISOString();
}

async function countVisits(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, createdAtGte: string) {
  const { count, error } = await supabaseAdmin.from('site_visits').select('id', { count: 'exact', head: true }).gte('created_at', createdAtGte);
  if (error) throw new Error(`Erro ao contar visitas: ${error.message}`);
  return count ?? 0;
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);
  if (authorization.response) return authorization.response;

  try {
    const last30Keys = getDateKeys(30);
    const last7Keys = last30Keys.slice(-7);
    const [visitsToday, visitsLast7Days, visitsLast30Days] = await Promise.all([
      countVisits(authorization.supabaseAdmin, getDayStartIso(last30Keys.at(-1) as string)),
      countVisits(authorization.supabaseAdmin, getDayStartIso(last7Keys[0])),
      countVisits(authorization.supabaseAdmin, getDayStartIso(last30Keys[0])),
    ]);

    return NextResponse.json({ metrics: { visitsToday, visitsLast7Days, visitsLast30Days } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar estatisticas de visitas.' }, { status: 500 });
  }
}
