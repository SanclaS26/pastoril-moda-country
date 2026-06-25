import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin, type VendaRow } from '@/lib/supabase-admin';
import { getVendaValue, isCompletedSale, isOpenCart, isOpenOrder } from '@/lib/admin-dashboard';
import { cleanupExpiredOpenCarts } from '@/lib/vendas-cleanup';

export const dynamic = 'force-dynamic';

const TIME_ZONE = 'America/Rio_Branco';
const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;
type VisitRow = { created_at: string; user_id: string | null; visit_date: string | null; visitor_id: string | null };
type DashboardVenda = Pick<VendaRow, 'concluded_at' | 'created_at' | 'first_admin_response_at' | 'id' | 'status' | 'tipo' | 'total_final' | 'total_original' | 'whatsapp_enviado_em'> & {
  itemCount: number;
};

function getTodayParts() {
  const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE, year: 'numeric' }).formatToParts(new Date());
  return {
    day: Number(parts.find((part) => part.type === 'day')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    year: Number(parts.find((part) => part.type === 'year')?.value),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function rollingDateKeys(days: number, today: ReturnType<typeof getTodayParts>) {
  const end = Date.UTC(today.year, today.month - 1, today.day);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - 1 - index) * 86400000);
    return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  });
}

function monthDateKeys(today: ReturnType<typeof getTodayParts>) {
  const daysInMonth = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => dateKey(today.year, today.month, index + 1));
}

function startIso(key: string) {
  return new Date(`${key}T05:00:00.000Z`).toISOString();
}

function getValidTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function visitDateKey(visit: VisitRow) {
  if (visit.visit_date) return visit.visit_date;
  const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE, year: 'numeric' }).formatToParts(new Date(visit.created_at));
  return dateKey(Number(parts.find((part) => part.type === 'year')?.value), Number(parts.find((part) => part.type === 'month')?.value), Number(parts.find((part) => part.type === 'day')?.value));
}

async function loadVisits(supabase: ReturnType<typeof getSupabaseAdmin>, since: string) {
  const rows: VisitRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('site_visits').select('user_id, visitor_id, visit_date, created_at').gte('created_at', since).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Erro ao carregar visitas: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as VisitRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadVendas(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const rows: Omit<DashboardVenda, 'itemCount'>[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('vendas').select('id, tipo, status, total_original, total_final, created_at, whatsapp_enviado_em, concluded_at, first_admin_response_at').not('cliente_auth_user_id', 'is', null).is('deleted_at', null).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Erro ao carregar vendas: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Omit<DashboardVenda, 'itemCount'>[]));
    if (data.length < PAGE_SIZE) break;
  }

  const itemCounts = new Map<string, number>();
  const vendaIds = rows.map((venda) => venda.id);
  for (let from = 0; from < vendaIds.length; from += PAGE_SIZE) {
    const chunk = vendaIds.slice(from, from + PAGE_SIZE);
    if (!chunk.length) break;
    const { data, error } = await supabase.from('venda_itens').select('venda_id, quantidade_final').in('venda_id', chunk);
    if (error) throw new Error(`Erro ao carregar itens das vendas: ${error.message}`);
    (data ?? []).forEach((item) => {
      if (Number(item.quantidade_final) > 0) {
        itemCounts.set(item.venda_id, (itemCounts.get(item.venda_id) ?? 0) + 1);
      }
    });
  }

  return rows.map((venda) => ({ ...venda, itemCount: itemCounts.get(venda.id) ?? 0 }));
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);
  if (authorization.response) return authorization.response;

  try {
    await cleanupExpiredOpenCarts(authorization.supabaseAdmin);
    const period = new URL(request.url).searchParams.get('period');
    const today = getTodayParts();
    const keys = period === '15' ? rollingDateKeys(15, today) : period === 'month' ? monthDateKeys(today) : rollingDateKeys(7, today);
    const queryKeys = period === 'month' ? keys.slice(0, today.day) : keys;
    const [visits, vendas] = await Promise.all([loadVisits(authorization.supabaseAdmin, startIso(queryKeys[0])), loadVendas(authorization.supabaseAdmin)]);
    const identitiesByDay = new Map(keys.map((key) => [key, new Set<string>()]));

    visits.forEach((visit) => {
      const key = visitDateKey(visit);
      const identity = visit.user_id ? `user:${visit.user_id}` : visit.visitor_id ? `visitor:${visit.visitor_id}` : null;
      if (identity && identitiesByDay.has(key)) identitiesByDay.get(key)?.add(identity);
    });

    const openOrders = vendas.filter(isOpenOrder);
    const completedOrders = vendas.filter((venda) => venda.tipo === 'pedido_whatsapp' && isCompletedSale(venda));
    const openCarts = vendas.filter((venda) => isOpenCart(venda) && venda.itemCount > 0);
    const completedSales = vendas.filter(isCompletedSale);
    const now = Date.now();
    const answeredOrders = vendas
      .filter((order) => order.tipo === 'pedido_whatsapp' && order.whatsapp_enviado_em && order.first_admin_response_at)
      .map((order) => {
        const sentAt = getValidTimestamp(order.whatsapp_enviado_em);
        const responseAt = getValidTimestamp(order.first_admin_response_at);
        return sentAt !== null && responseAt !== null ? Math.max(0, responseAt - sentAt) : null;
      })
      .filter((duration): duration is number => duration !== null);
    const unansweredOpenOrders = openOrders.filter((order) => !getValidTimestamp(order.first_admin_response_at));
    const averageFirstResponseMs = answeredOrders.length ? answeredOrders.reduce((sum, duration) => sum + duration, 0) / answeredOrders.length : 0;
    const averageWaitMs = unansweredOpenOrders.length
      ? unansweredOpenOrders.reduce((sum, order) => {
          const sentAt = getValidTimestamp(order.whatsapp_enviado_em) ?? getValidTimestamp(order.created_at) ?? now;
          return sum + Math.max(0, now - sentAt);
        }, 0) / unansweredOpenOrders.length
      : 0;
    const todayKey = dateKey(today.year, today.month, today.day);
    const last15Start = rollingDateKeys(15, today)[0];
    const monthStart = dateKey(today.year, today.month, 1);
    const sumSince = (key: string) => completedSales.filter((venda) => (venda.concluded_at ?? venda.created_at) >= startIso(key)).reduce((sum, venda) => sum + getVendaValue(venda), 0);

    return NextResponse.json({
      carts: { count: openCarts.length, total: openCarts.reduce((sum, cart) => sum + getVendaValue(cart), 0) },
      finance: { month: sumSince(monthStart), last15Days: sumSince(last15Start), today: sumSince(todayKey) },
      orders: { averageFirstResponseMs, averageWaitMs, completed: completedOrders.length, open: openOrders.length, waitingOpen: unansweredOpenOrders.length },
      visits: keys.map((key) => ({ date: key, visits: identitiesByDay.get(key)?.size ?? 0 })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar dashboard.' }, { status: 500 });
  }
}
