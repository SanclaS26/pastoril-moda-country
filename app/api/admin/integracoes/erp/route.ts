import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import type { ErpIntegrationUpdate } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const environments = ['Producao', 'Homologacao', 'Sandbox'] as const;
const authTypes = ['API Key', 'Bearer Token', 'OAuth 2.0', 'Usuario e senha', 'Ainda nao definido'] as const;

function optionalText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalUrl(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function booleanValue(value: unknown) {
  return value === true;
}

function parsePayload(body: Record<string, unknown>): ErpIntegrationUpdate | { error: string } {
  const environment = typeof body.environment === 'string' && environments.includes(body.environment as (typeof environments)[number])
    ? body.environment as ErpIntegrationUpdate['environment']
    : 'Homologacao';
  const authType = typeof body.auth_type === 'string' && authTypes.includes(body.auth_type as (typeof authTypes)[number])
    ? body.auth_type as ErpIntegrationUpdate['auth_type']
    : 'Ainda nao definido';
  const syncInterval = Number(body.sync_interval_minutes);

  if (!Number.isInteger(syncInterval) || syncInterval < 1 || syncInterval > 1440) {
    return { error: 'Informe um intervalo de sincronizacao entre 1 e 1440 minutos.' };
  }

  if (optionalText(body.api_base_url) && !optionalUrl(body.api_base_url)) {
    return { error: 'Informe uma URL base valida usando http ou https.' };
  }

  return {
    api_base_url: optionalUrl(body.api_base_url),
    api_version: optionalText(body.api_version),
    auth_type: authType,
    environment,
    erp_name: optionalText(body.erp_name),
    provider_name: optionalText(body.provider_name),
    send_confirmed_sales: booleanValue(body.send_confirmed_sales),
    sync_categories: booleanValue(body.sync_categories),
    sync_images: booleanValue(body.sync_images),
    sync_interval_minutes: syncInterval,
    sync_prices: booleanValue(body.sync_prices),
    sync_products: booleanValue(body.sync_products),
    sync_stock: booleanValue(body.sync_stock),
  };
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);
  if (authorization.response) return authorization.response;

  const { data, error } = await authorization.supabaseAdmin
    .from('erp_integrations')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Erro ao carregar configuracao ERP: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ integration: data ?? null });
}

export async function PATCH(request: Request) {
  const authorization = await requireActiveAdmin(request);
  if (authorization.response) return authorization.response;

  try {
    const body = await request.json();
    const payload = parsePayload(body && typeof body === 'object' ? body as Record<string, unknown> : {});

    if ('error' in payload) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const { data, error } = await authorization.supabaseAdmin
      .from('erp_integrations')
      .upsert({ id: 1, ...payload }, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: `Erro ao salvar configuracao ERP: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ integration: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, { status: 500 });
  }
}
