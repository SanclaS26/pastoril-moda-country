import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SupabaseAdminConfigError } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VISITOR_COOKIE = 'pastoril_visitor_id';
const SESSION_COOKIE = 'pastoril_session_id';
const VISITOR_MAX_AGE = 60 * 60 * 24 * 400;
const SESSION_MAX_AGE = 60 * 60 * 8;
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

const BOT_PATTERNS = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'bingpreview',
  'facebookexternalhit',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'preview',
  'lighthouse',
  'pagespeed',
];

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function isUuid(value: string | null) {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
}

function shouldIgnoreRequest(request: Request) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';
  const purpose = request.headers.get('purpose')?.toLowerCase() ?? '';
  const secPurpose = request.headers.get('sec-purpose')?.toLowerCase() ?? '';
  const nextPrefetch = request.headers.get('next-router-prefetch');

  return (
    purpose.includes('prefetch') ||
    secPurpose.includes('prefetch') ||
    nextPrefetch === '1' ||
    BOT_PATTERNS.some((pattern) => userAgent.includes(pattern))
  );
}

function normalizePathname(pathname: unknown) {
  if (typeof pathname !== 'string') {
    return null;
  }

  const trimmed = pathname.trim();

  if (!trimmed.startsWith('/') || trimmed.length > 300) {
    return null;
  }

  if (
    trimmed.startsWith('/admin') ||
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/_next/') ||
    trimmed.includes('..')
  ) {
    return null;
  }

  return trimmed.split('?')[0].split('#')[0] || null;
}

function withVisitCookies(response: NextResponse, visitorId: string, sessionId: string) {
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    maxAge: VISITOR_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure,
  });

  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure,
  });

  return response;
}

export async function POST(request: Request) {
  if (shouldIgnoreRequest(request)) {
    return new NextResponse(null, { status: 204 });
  }

  let pathname: string | null = null;

  try {
    const body = await request.json();
    pathname = normalizePathname(body?.pathname);
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  if (!pathname) {
    return new NextResponse(null, { status: 204 });
  }

  const visitorId = isUuid(getCookieValue(request, VISITOR_COOKIE))
    ? (getCookieValue(request, VISITOR_COOKIE) as string)
    : crypto.randomUUID();

  const sessionId = isUuid(getCookieValue(request, SESSION_COOKIE))
    ? (getCookieValue(request, SESSION_COOKIE) as string)
    : crypto.randomUUID();

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof SupabaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao configurar visitas.' }, { status: 500 });
  }

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const { data: recentVisit, error: recentVisitError } = await supabaseAdmin
    .from('site_visits')
    .select('id')
    .eq('visitor_id', visitorId)
    .eq('session_id', sessionId)
    .eq('pathname', pathname)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();

  if (recentVisitError) {
    return NextResponse.json({ error: 'Erro ao verificar visita recente.' }, { status: 500 });
  }

  if (recentVisit) {
    return withVisitCookies(NextResponse.json({ ok: true, skipped: true }), visitorId, sessionId);
  }

  const { error: insertError } = await supabaseAdmin.from('site_visits').insert([
    {
      visitor_id: visitorId,
      session_id: sessionId,
      pathname,
    },
  ]);

  if (insertError) {
    return NextResponse.json({ error: 'Erro ao registrar visita.' }, { status: 500 });
  }

  return withVisitCookies(NextResponse.json({ ok: true }, { status: 201 }), visitorId, sessionId);
}
