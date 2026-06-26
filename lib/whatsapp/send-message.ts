const GRAPH_API_VERSION = 'v25.0';

interface SendWhatsAppTextMessageInput {
  body: string;
  to: string;
}

interface SendWhatsAppImageMessageInput {
  caption?: string;
  imageUrl: string;
  to: string;
}

interface MetaErrorPayload {
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
}

export class WhatsAppSendMessageError extends Error {
  metaErrorCode: number | null;
  status: number | null;

  constructor(message: string, options?: { metaErrorCode?: number | null; status?: number | null }) {
    super(message);
    this.name = 'WhatsAppSendMessageError';
    this.metaErrorCode = options?.metaErrorCode ?? null;
    this.status = options?.status ?? null;
  }
}

function getRequiredEnv(name: 'WHATSAPP_ACCESS_TOKEN' | 'WHATSAPP_PHONE_NUMBER_ID') {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new WhatsAppSendMessageError('Configuracao ausente para envio WhatsApp.');
  }

  return value;
}

async function sendMetaWhatsAppMessage(payload: Record<string, unknown>) {
  const accessToken = getRequiredEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = getRequiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(endpoint, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    let metaErrorCode: number | null = null;

    try {
      const errorPayload = (await response.json()) as MetaErrorPayload;
      metaErrorCode = errorPayload.error?.code ?? null;
    } catch {
      metaErrorCode = null;
    }

    throw new WhatsAppSendMessageError('Falha ao enviar resposta automatica.', {
      metaErrorCode,
      status: response.status,
    });
  }
}

export async function sendWhatsAppTextMessage({ body, to }: SendWhatsAppTextMessageInput) {
  await sendMetaWhatsAppMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    text: {
      body,
      preview_url: false,
    },
    to,
    type: 'text',
  });
}

export async function sendWhatsAppImageMessage({ caption, imageUrl, to }: SendWhatsAppImageMessageInput) {
  await sendMetaWhatsAppMessage({
    image: {
      caption: caption?.trim() ? caption.trim().slice(0, 1024) : undefined,
      link: imageUrl,
    },
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
  });
}