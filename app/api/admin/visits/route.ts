import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin, type SiteVisitRow } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TIME_ZONE = 'America/Rio_Branco';
const PAGE_SIZE = 1000;
const MAX_ROWS_TO_AGGREGATE = 50000;

type VisitAggregateRow = Pick<SiteVisitRow, 'visitor_id' | 'created_at'>;

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: TIME_ZONE,
  year: 'numeric',
});

function getRioBrancoDateKey(date: Date) {
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
    return getRioBrancoDateKey(date);
  });
}

function getRioBrancoStartIso(dateKey: string) {
  return new Date(`${dateKey}T05:00:00.000Z`).toISOString();
}

async function countVisits(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  createdAtGte?: string,
) {
  let query = supabaseAdmin
    .from('site_visits')
    .select('id', { count: 'exact', head: true });

  if (createdAtGte) {
    query = query.gte('created_at', createdAtGte);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Erro ao contar visitas: ${error.message}`);
  }

  return count ?? 0;
}

async function fetchVisitsSince(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  createdAtGte: string,
) {
  const visits: VisitAggregateRow[] = [];

  for (let from = 0; from < MAX_ROWS_TO_AGGREGATE; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('site_visits')
      .select('visitor_id, created_at')
      .gte('created_at', createdAtGte)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao carregar visitas: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    visits.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return visits;
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const last30Keys = getDateKeys(30);
    const last7Keys = last30Keys.slice(-7);
    const todayKey = last30Keys[last30Keys.length - 1];
    const startLast30Iso = getRioBrancoStartIso(last30Keys[0]);
    const startLast7Iso = getRioBrancoStartIso(last7Keys[0]);
    const startTodayIso = getRioBrancoStartIso(todayKey);

    const [visitsTotal, visitsToday, visitsLast7Days, visitsLast30Days, recentVisits] = await Promise.all([
      countVisits(authorization.supabaseAdmin),
      countVisits(authorization.supabaseAdmin, startTodayIso),
      countVisits(authorization.supabaseAdmin, startLast7Iso),
      countVisits(authorization.supabaseAdmin, startLast30Iso),
      fetchVisitsSince(authorization.supabaseAdmin, startLast30Iso),
    ]);

    const todayVisitors = new Set<string>();
    const last30Visitors = new Set<string>();
    const dailyCounts = new Map(last30Keys.map((date) => [date, 0]));

    recentVisits.forEach((visit) => {
      const dateKey = getRioBrancoDateKey(new Date(visit.created_at));

      if (!dailyCounts.has(dateKey)) {
        return;
      }

      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);
      last30Visitors.add(visit.visitor_id);

      if (dateKey === todayKey) {
        todayVisitors.add(visit.visitor_id);
      }
    });

    return NextResponse.json({
      metrics: {
        visitsToday,
        visitsLast7Days,
        visitsLast30Days,
        visitsTotal,
        uniqueVisitorsToday: todayVisitors.size,
        uniqueVisitorsLast30Days: last30Visitors.size,
      },
      daily: last30Keys.map((date) => ({
        date,
        visits: dailyCounts.get(date) ?? 0,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar estatisticas de visitas.' },
      { status: 500 },
    );
  }
}
