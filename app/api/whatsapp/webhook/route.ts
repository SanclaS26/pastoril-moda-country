import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WebhookEventType = 'mensagem' | 'status' | 'desconhecido';

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id?: string;
  changes?: WhatsAppChange[];
}

interface WhatsAppChange {
  field?: string;
  value?: WhatsAppChangeValue;
}

interface WhatsAppChangeValue {
  metadata?: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppMetadata {
  display_phone_number?: string;
  phone_number_id?: string;
}

interface WhatsAppContact {
  profile?: {
    name?: string;
  };
  wa_id?: string;
}

interface WhatsAppMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
}

interface WhatsAppStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
}

interface ClassifiedWebhookEvent {
  eventCount: number;
  type: WebhookEventType;
}

function getRequiredEnv(name: 'WHATSAPP_VERIFY_TOKEN' | 'META_APP_SECRET') {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const providedBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function classifyEvent(payload: WhatsAppWebhookPayload): ClassifiedWebhookEvent {
  let messageCount = 0;
  let statusCount = 0;
  let unknownCount = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      const statuses = change.value?.statuses;

      if (Array.isArray(messages) && messages.length > 0) {
        messageCount += messages.length;
        continue;
      }

      if (Array.isArray(statuses) && statuses.length > 0) {
        statusCount += statuses.length;
        continue;
      }

      unknownCount += 1;
    }
  }

  const eventCount = messageCount + statusCount + unknownCount;
  const type: WebhookEventType = messageCount > 0 ? 'mensagem' : statusCount > 0 ? 'status' : 'desconhecido';

  return { eventCount, type };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const verifyToken = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (!mode || !verifyToken || !challenge) {
    return NextResponse.json({ error: 'Parametros obrigatorios ausentes.' }, { status: 400 });
  }

  const expectedToken = getRequiredEnv('WHATSAPP_VERIFY_TOKEN');

  if (!expectedToken) {
    return NextResponse.json({ error: 'Webhook WhatsApp nao configurado.' }, { status: 500 });
  }

  if (mode !== 'subscribe' || verifyToken !== expectedToken) {
    return NextResponse.json({ error: 'Verificacao negada.' }, { status: 403 });
  }

  return new Response(challenge, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
    status: 200,
  });
}

export async function POST(request: Request) {
  const appSecret = getRequiredEnv('META_APP_SECRET');

  if (!appSecret) {
    return NextResponse.json({ error: 'Webhook WhatsApp nao configurado.' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-hub-signature-256');

  if (!isValidSignature(rawBody, signatureHeader, appSecret)) {
    return NextResponse.json({ error: 'Assinatura invalida.' }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 });
  }

  const classifiedEvent = classifyEvent(payload);

  console.info('[whatsapp-webhook] Webhook WhatsApp recebido');
  console.info(`[whatsapp-webhook] Tipo: ${classifiedEvent.type}`);
  console.info(`[whatsapp-webhook] Quantidade de eventos: ${classifiedEvent.eventCount}`);

  return NextResponse.json({ received: true }, { status: 200 });
}
