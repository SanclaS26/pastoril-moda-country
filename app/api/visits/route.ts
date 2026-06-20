import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VISITOR_COOKIE = 'pastoril_visitor_id';
const SESSION_COOKIE = 'pastoril_session_id';
const VISITOR_MAX_AGE = 60 * 60 * 24 * 400;
const SESSION_MAX_AGE = 60 * 60 * 8;
const TIME_ZONE = 'America/Rio_Branco';
const BOT_PATTERNS = ['bot', 'crawler', 'spider', 'slurp', 'bingpreview', 'facebookexternalhit', 'whatsapp', 'telegrambot', 'discordbot', 'preview', 'lighthouse', 'pagespeed'];

function getCookieValue(request: Request, name: string) {
  const cookie = (request.headers.get('cookie') ?? '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function isUuid(value: string | null) {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
}

function shouldIgnoreRequest(request: Request) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';
  const purpose = request.headers.get('purpose')?.toLowerCase() ?? '';
  const secPurpose = request.headers.get('sec-purpose')?.toLowerCase() ?? '';
  return purpose.includes('prefetch') || secPurpose.includes('prefetch') || request.headers.get('next-router-prefetch') === '1' || BOT_PATTERNS.some((pattern) => userAgent.includes(pattern));
}

function normalizePathname(pathname: unknown) {
  if (typeof pathname !== 'string') return null;
  const trimmed = pathname.trim();
  if (!trimmed.startsWith('/') || trimmed.length > 300 || trimmed.startsWith('/admin') || trimmed.startsWith('/api/') || trimmed.startsWith('/_next/') || trimmed.includes('..')) return null;
  return trimmed.split('?')[0].split('#')[0] || null;
}

function getVisitDate() {
  return new Intl.DateTimeFormat('en-CA', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE, year: 'numeric' }).format(new Date());
}

function getBearerToken(request: Request) {
  const [scheme, token] = request.headers.get('authorization')?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function withVisitCookies(response: NextResponse, visitorId: string | null, sessionId: string) {
  const secure = process.env.NODE_ENV === 'production';
  if (visitorId) response.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, maxAge: VISITOR_MAX_AGE, path: '/', sameSite: 'lax', secure });
  response.cookies.set(SESSION_COOKIE, sessionId, { httpOnly: true, maxAge: SESSION_MAX_AGE, path: '/', sameSite: 'lax', secure });
  return response;
}

export async function POST(request: Request) {
  if (shouldIgnoreRequest(request)) return new NextResponse(null, { status: 204 });

  let pathname: string | null = null;
  try { pathname = normalizePathname((await request.json())?.pathname); } catch { return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 }); }
  if (!pathname) return new NextResponse(null, { status: 204 });

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try { supabaseAdmin = getSupabaseAdmin(); } catch (error) {
    return NextResponse.json({ error: error instanceof SupabaseAdminConfigError ? error.message : 'Erro ao configurar visitas.' }, { status: 500 });
  }

  const token = getBearerToken(request);
  const { data: userData } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } };
  const userId = userData.user?.id ?? null;
  const visitorId = userId ? null : (isUuid(getCookieValue(request, VISITOR_COOKIE)) ? getCookieValue(request, VISITOR_COOKIE) : crypto.randomUUID());
  const sessionId = isUuid(getCookieValue(request, SESSION_COOKIE)) ? (getCookieValue(request, SESSION_COOKIE) as string) : crypto.randomUUID();

  const { error } = await supabaseAdmin.from('site_visits').insert({
    pathname,
    session_id: sessionId,
    user_id: userId,
    visit_date: getVisitDate(),
    visitor_id: visitorId,
  });

  if (error && error.code !== '23505') return NextResponse.json({ error: 'Erro ao registrar visita.' }, { status: 500 });
  return withVisitCookies(NextResponse.json({ ok: true, skipped: error?.code === '23505' }, { status: error ? 200 : 201 }), visitorId, sessionId);
}
