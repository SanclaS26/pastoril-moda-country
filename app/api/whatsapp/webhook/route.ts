import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { departamentosProduto } from '@/config/grades-tamanho';
import { WhatsAppAIError, generateWhatsAppReply } from '@/lib/ai/generate-whatsapp-reply';
import { detectDepartmentFromMessage, extractProductPositionFromMessage, getFeaturedProductsByDepartment, getProductById } from '@/lib/whatsapp/catalog/category-flow';
import { getOrCreateWhatsAppSession, updateWhatsAppSession } from '@/lib/whatsapp/session';
import { WhatsAppSendMessageError, sendWhatsAppImageMessage, sendWhatsAppTextMessage } from '@/lib/whatsapp/send-message';
import type { WhatsAppPresentedProduct } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGE_ID_TTL_MS = 2 * 60 * 1000;
const MAX_FEATURED_IMAGES = 20;

const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pastorilmodacountry.com.br').trim();

const WELCOME_MESSAGE =
  'Oi! Seja bem-vinda a Pastoril Moda Country. Posso te mostrar os destaques por categoria e voce escolhe pela numeracao das fotos.';

const SITE_NOTICE_MESSAGE =
  `Voce tambem pode acompanhar novidades no nosso site: ${SITE_URL}`;

const DEFAULT_CATEGORY_PROMPT =
  'Me diga a categoria que voce quer ver primeiro. Exemplo: botas, camisas, cintos ou bolsas.';

const CATEGORY_NOT_FOUND_PROMPT =
  'Nao identifiquei a categoria. Me diga uma categoria, como botas, camisas, cintos, bolsas ou vestidos.';

const PHOTO_SELECTION_PROMPT = 'Digite o numero da foto que voce quer saber mais detalhes.';

const PRODUCT_NOT_FOUND_PROMPT =
  'Esse produto nao esta mais disponivel neste momento. Digite outro numero da lista para ver mais detalhes.';

const CATEGORY_WITHOUT_PRODUCTS_PROMPT =
  'No momento nao encontrei destaques disponiveis nessa categoria. Se quiser, te mostro outra categoria.';

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

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatCategoryExamples() {
  return departamentosProduto.slice(0, 8).join(', ').toLowerCase();
}

function normalizeBaseSiteUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function formatSizes(stock: Array<{ quantidade: number; tamanho: string }>) {
  const sizes = Array.from(new Set(stock.map((item) => item.tamanho).filter(Boolean)));

  if (!sizes.length) {
    return 'Nao informado';
  }

  if (sizes.length === 1) {
    return sizes[0];
  }

  if (sizes.length === 2) {
    return `${sizes[0]} e ${sizes[1]}`;
  }

  return `${sizes.slice(0, -1).join(', ')} e ${sizes[sizes.length - 1]}`;
}

function extractValidPresentedProducts(presentedProducts: WhatsAppPresentedProduct[]) {
  return presentedProducts
    .filter((item) => Number.isInteger(item.position) && item.position > 0 && Number.isInteger(item.productId) && item.productId > 0)
    .sort((a, b) => a.position - b.position);
}

async function sendCategoryFeaturedProducts(to: string, department: string) {
  const featuredProducts = (await getFeaturedProductsByDepartment(department)).slice(0, MAX_FEATURED_IMAGES);
  const uniqueProducts = Array.from(new Map(featuredProducts.map((product) => [product.id, product])).values());

  if (!uniqueProducts.length) {
    await sendWhatsAppTextMessage({
      body: CATEGORY_WITHOUT_PRODUCTS_PROMPT,
      to,
    });

    return [] as WhatsAppPresentedProduct[];
  }

  const presentedProducts: WhatsAppPresentedProduct[] = [];
  let currentPosition = 1;

  for (const product of uniqueProducts) {
    try {
      await sendWhatsAppImageMessage({
        caption: `Foto ${currentPosition}`,
        imageUrl: product.imagemPrincipal,
        to,
      });

      presentedProducts.push({
        position: currentPosition,
        productId: product.id,
      });

      currentPosition += 1;
    } catch (error) {
      if (error instanceof WhatsAppSendMessageError) {
        console.warn('[whatsapp-webhook] Falha ao enviar imagem de produto por categoria');
      } else {
        console.warn('[whatsapp-webhook] Erro interno ao enviar imagem de produto por categoria');
      }
    }
  }

  if (!presentedProducts.length) {
    await sendWhatsAppTextMessage({
      body: 'Nao consegui enviar fotos dessa categoria agora. Me pede outra categoria para tentar novamente.',
      to,
    });

    return [];
  }

  await sendWhatsAppTextMessage({
    body: PHOTO_SELECTION_PROMPT,
    to,
  });

  return presentedProducts;
}

async function sendProductDetailsById(to: string, productId: number) {
  const product = await getProductById(productId);

  if (!product) {
    await sendWhatsAppTextMessage({
      body: PRODUCT_NOT_FOUND_PROMPT,
      to,
    });

    return null;
  }

  const productPublicUrl = `${normalizeBaseSiteUrl(SITE_URL)}/produto/${product.id}`;

  const activePrice = product.emPromocao && product.precoPromocional !== null ? product.precoPromocional : product.preco;
  const hasPromotion = product.emPromocao && product.precoPromocional !== null;

  const detailMessage = [
    `${product.nome}`,
    hasPromotion ? `De: ${formatCurrency(product.preco)}` : null,
    hasPromotion ? `Por: ${formatCurrency(activePrice)}` : `Preco: ${formatCurrency(activePrice)}`,
    `Tamanhos disponiveis: ${formatSizes(product.estoqueDisponivel)}`,
    `Ver no site: ${productPublicUrl}`,
    '',
    'A disponibilidade pode mudar ate a confirmacao da venda.',
  ]
    .filter(Boolean)
    .join('\n');

  await sendWhatsAppImageMessage({
    caption: detailMessage,
    imageUrl: product.imagemPrincipal,
    to,
  });

  await sendWhatsAppTextMessage({
    body: 'Esse produto te interessou ou gostaria de ver outra foto?',
    to,
  });

  return product;
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

        try {
          const session = await getOrCreateWhatsAppSession(message.from);

          if (session.isNewSession) {
            await sendWhatsAppTextMessage({
              body: WELCOME_MESSAGE,
              to: message.from,
            });
          }

          if (!session.siteNoticeSent) {
            await sendWhatsAppTextMessage({
              body: SITE_NOTICE_MESSAGE,
              to: message.from,
            });

            await updateWhatsAppSession(message.from, { siteNoticeSent: true });
          }

          const requestedDepartment = detectDepartmentFromMessage(customerText);

          if (requestedDepartment) {
            const presentedProducts = await sendCategoryFeaturedProducts(message.from, requestedDepartment);

            if (presentedProducts.length > 0) {
              await updateWhatsAppSession(message.from, {
                awaitingProductPosition: true,
                lastCategory: requestedDepartment,
                presentedProducts,
              });
            } else {
              await updateWhatsAppSession(message.from, {
                awaitingProductPosition: false,
                lastCategory: requestedDepartment,
                presentedProducts: [],
              });
            }

            console.info('[whatsapp-webhook] Fluxo por categoria executado');
            continue;
          }

          if (session.awaitingProductPosition) {
            const position = extractProductPositionFromMessage(customerText);
            const presentedProducts = extractValidPresentedProducts(session.presentedProducts);
            const availableCount = presentedProducts.length;

            if (!Number.isInteger(position) || !position || position <= 0 || availableCount === 0) {
              await sendWhatsAppTextMessage({
                body: `Nao encontrei essa foto. Digite um numero entre 1 e ${Math.max(availableCount, 1)}.`,
                to: message.from,
              });

              continue;
            }

            const selected = presentedProducts.find((item) => item.position === position);

            if (!selected) {
              await sendWhatsAppTextMessage({
                body: `Nao encontrei essa foto. Digite um numero entre 1 e ${availableCount}.`,
                to: message.from,
              });

              continue;
            }

            const product = await sendProductDetailsById(message.from, selected.productId);

            if (!product) {
              continue;
            }

            await updateWhatsAppSession(message.from, {
              awaitingProductPosition: true,
              presentedProducts,
            });

            console.info('[whatsapp-webhook] Detalhamento por posicao enviado');
            continue;
          }

          const categoryExamples = formatCategoryExamples();

          try {
            const aiReply = await generateWhatsAppReply(customerText);

            if (aiReply?.trim()) {
              await sendWhatsAppTextMessage({
                body: aiReply.trim(),
                to: message.from,
              });
            }
          } catch (error) {
            if (error instanceof WhatsAppAIError) {
              console.warn('[whatsapp-ai] Fallback utilizado no fluxo de categoria');
            }
          }

          await sendWhatsAppTextMessage({
            body: `${DEFAULT_CATEGORY_PROMPT}\nCategorias populares: ${categoryExamples}.`,
            to: message.from,
          });

          await sendWhatsAppTextMessage({
            body: CATEGORY_NOT_FOUND_PROMPT,
            to: message.from,
          });

          console.info('[whatsapp-webhook] Fluxo inicial de categorias enviado');
        } catch {
          console.warn('[whatsapp-webhook] Falha no fluxo de atendimento por categoria/foto');

          try {
            await sendWhatsAppTextMessage({
              body: 'Nao consegui concluir o atendimento automatico agora. Nossa equipe pode continuar por aqui com voce. 🤎',
              to: message.from,
            });
          } catch (sendError) {
            if (sendError instanceof WhatsAppSendMessageError) {
              console.error(
                `[whatsapp-webhook] Falha ao enviar resposta automatica: status=${sendError.status ?? 'n/a'} metaCode=${sendError.metaErrorCode ?? 'n/a'}`,
              );
              continue;
            }

            console.error('[whatsapp-webhook] Falha ao enviar resposta automatica: erro_interno');
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
