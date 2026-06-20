import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin, type SiteVisitRow } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const TIME_ZONE = 'America/Rio_Branco';
const PAGE_SIZE = 1000;
const MAX_ROWS_TO_AGGREGATE = 50000;
const UNKNOWN_CITY = 'Localização não identificada';

type VisitLocationRow = Pick<SiteVisitRow, 'city' | 'region'>;

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

async function fetchVisitLocationsSince(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  createdAtGte: string,
) {
  const visits: VisitLocationRow[] = [];

  for (let from = 0; from < MAX_ROWS_TO_AGGREGATE; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('site_visits')
      .select('city, region')
      .gte('created_at', createdAtGte)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao carregar localizacao das visitas: ${error.message}`);
    }

    if (!data?.length) break;

    visits.push(...data);
    if (data.length < PAGE_SIZE) break;
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

    const [visitsToday, visitsLast7Days, visitsLast30Days, visitLocations] = await Promise.all([
      countVisits(authorization.supabaseAdmin, startTodayIso),
      countVisits(authorization.supabaseAdmin, startLast7Iso),
      countVisits(authorization.supabaseAdmin, startLast30Iso),
      fetchVisitLocationsSince(authorization.supabaseAdmin, startLast7Iso),
    ]);

    const cityCounts = new Map<string, { city: string; region: string | null; visits: number }>();

    visitLocations.forEach((visit) => {
      const city = visit.city?.trim() || UNKNOWN_CITY;
      const region = city === UNKNOWN_CITY ? null : visit.region?.trim() || null;
      const key = city === UNKNOWN_CITY
        ? '__unknown__'
        : `${city.toLocaleLowerCase('pt-BR')}|${region?.toLocaleLowerCase('pt-BR') ?? ''}`;
      const current = cityCounts.get(key);

      if (current) {
        current.visits += 1;
      } else {
        cityCounts.set(key, { city, region, visits: 1 });
      }
    });

    return NextResponse.json({
      metrics: {
        visitsToday,
        visitsLast7Days,
        visitsLast30Days,
      },
      cities: [...cityCounts.values()].sort((left, right) => right.visits - left.visits),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar estatisticas de visitas.' },
      { status: 500 },
    );
  }
}
