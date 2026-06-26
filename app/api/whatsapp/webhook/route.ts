import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { WhatsAppSendMessageError, sendWhatsAppTextMessage } from '@/lib/whatsapp/send-message';
import { WhatsAppAIError, generateWhatsAppReply } from '@/lib/ai/generate-whatsapp-reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_FALLBACK_REPLY =
  'Olá! Recebemos sua mensagem. Nosso atendimento automático está temporariamente indisponível, mas a equipe da Pastoril poderá continuar o atendimento por aqui. 🤎';
const MESSAGE_ID_TTL_MS = 2 * 60 * 1000;

// This in-memory dedupe is only a best-effort layer; serverless instances may restart
// and will not persist this state. Persistent dedupe will be implemented later.
const processedMessageIds = new Map<string, number>();

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
  text?: {
    body?: string;
  };
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

function normalizeDigits(value: string | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function isDuplicateMessageId(messageId: string) {
  const now = Date.now();

  for (const [id, expiresAt] of processedMessageIds.entries()) {
    if (expiresAt <= now) {
      processedMessageIds.delete(id);
    }
  }

  const existingExpiry = processedMessageIds.get(messageId);

  if (existingExpiry && existingExpiry > now) {
    return true;
  }

  processedMessageIds.set(messageId, now + MESSAGE_ID_TTL_MS);
  return false;
}

function isSelfMessage(from: string | undefined, metadata: WhatsAppMetadata | undefined) {
  const fromDigits = normalizeDigits(from);
  const displayPhoneDigits = normalizeDigits(metadata?.display_phone_number);

  if (!fromDigits || !displayPhoneDigits) return false;

  return fromDigits === displayPhoneDigits;
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

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const messages = value?.messages;
      const statuses = value?.statuses;

      if ((!messages || messages.length === 0) && Array.isArray(statuses) && statuses.length > 0) {
        console.info('[whatsapp-webhook] Evento de status ignorado');
        continue;
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        continue;
      }

      for (const message of messages) {
        if (!message.id) {
          continue;
        }

        if (isDuplicateMessageId(message.id)) {
          continue;
        }

        if (!message.from) {
          continue;
        }

        if (isSelfMessage(message.from, value?.metadata)) {
          continue;
        }

        if (message.type !== 'text') {
          console.info(`[whatsapp-webhook] Tipo nao suportado: ${message.type ?? 'desconhecido'}`);
          continue;
        }

        const customerText = message.text?.body?.trim();

        if (!customerText) {
          continue;
        }

        console.info('[whatsapp-webhook] Mensagem de texto recebida');

        let replyText = OPENAI_FALLBACK_REPLY;

        try {
          replyText = await generateWhatsAppReply(customerText);
        } catch (error) {
          if (error instanceof WhatsAppAIError) {
            console.warn('[whatsapp-ai] Fallback utilizado');
          } else {
            console.warn('[whatsapp-ai] Fallback utilizado');
          }
        }

        try {
          await sendWhatsAppTextMessage({
            body: replyText,
            to: message.from,
          });

          console.info('[whatsapp-webhook] Resposta automatica enviada');
        } catch (error) {
          if (error instanceof WhatsAppSendMessageError) {
            console.error(
              `[whatsapp-webhook] Falha ao enviar resposta automatica: status=${error.status ?? 'n/a'} metaCode=${error.metaErrorCode ?? 'n/a'}`,
            );
            continue;
          }

          console.error('[whatsapp-webhook] Falha ao enviar resposta automatica: erro_interno');
        }
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
