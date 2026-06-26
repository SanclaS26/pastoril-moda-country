import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { departamentosProduto } from '@/config/grades-tamanho';
import { generateWhatsAppReply } from '@/lib/ai/generate-whatsapp-reply';
import { getPublicSiteUrl } from '@/lib/public-site-url';
import {
  detectDepartmentFromMessage,
  extractProductPositionFromMessage,
  getFeaturedProductsByDepartment,
  getProductById,
  type CatalogAudience,
} from '@/lib/whatsapp/catalog/category-flow';
import { getOrCreateWhatsAppSession, startGallerySessionIfAvailable, updateWhatsAppSession } from '@/lib/whatsapp/session';
import { WhatsAppSendMessageError, sendWhatsAppImageMessage, sendWhatsAppTextMessage } from '@/lib/whatsapp/send-message';
import type { WhatsAppPresentedProduct } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGE_ID_TTL_MS = 2 * 60 * 1000;
const SITE_URL = getPublicSiteUrl();

const INTRO_MESSAGE =
  'Olá! Seja bem-vindo(a) à Pastoril Moda Country. 🤎\n\nPosso ajudar você a conhecer nossas novidades e encontrar produtos disponíveis.';
const SITE_INTRO_MESSAGE = `Você também pode conhecer nossa vitrine pelo site:\n\n${SITE_URL}`;

const CATEGORY_PRE_GALLERY_MESSAGE = 'Estas são as novidades em destaque dessa categoria. 🤎';
const CATEGORY_PRE_GALLERY_SITE_MESSAGE =
  `As fotos abaixo mostram as novidades selecionadas da categoria.\n\nPara ver mais produtos, acesse:\n${SITE_URL}`;

const SELECTION_PROMPT_MESSAGE = 'Digite o número da foto que você quer saber mais detalhes.';
const CHANGE_CATEGORY_PROMPT_MESSAGE = buildChangeCategoryPrompt();

const NO_HIGHLIGHTS_MESSAGE = 'Não encontrei novidades em destaque disponíveis nessa categoria agora. 🤎';
const NO_HIGHLIGHTS_SITE_MESSAGE =
  `Você pode escolher outra categoria ou ver todos os produtos no site:\n\n${SITE_URL}`;
const GALLERY_LOAD_FAILED_MESSAGE =
  `Não consegui carregar as fotos dessa categoria agora.\n\nVocê pode ver os produtos no site:\n${SITE_URL}`;

const HUMAN_HANDOFF_MESSAGE = 'Vou encaminhar seu atendimento para a equipe da Pastoril continuar por aqui. 🤎';
const PRODUCT_NOT_FOUND_REPLY =
  'Esse produto não está mais disponível neste momento. Digite outro número da lista ou peça outra categoria.';
const FALLBACK_MESSAGE =
  'Não consegui concluir o atendimento automático agora. Nossa equipe pode continuar por aqui com você. 🤎';

type WebhookEventType = 'mensagem' | 'status' | 'desconhecido';

type CategoryFlowStage =
  | 'start'
  | 'identify_category'
  | 'load_conversation'
  | 'search_featured_products'
  | 'validate_products'
  | 'send_product_images'
  | 'persist_presented_products'
  | 'send_selection_prompt'
  | 'load_selected_product'
  | 'send_product_details';

type SanitizedError = {
  code: string | null;
  details: string | null;
  hint: string | null;
  message: string | null;
  name: string | null;
  status: number | null;
};

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
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppMetadata {
  display_phone_number?: string;
}

interface WhatsAppMessage {
  id?: string;
  from?: string;
  text?: {
    body?: string;
  };
  type?: string;
}

interface WhatsAppStatus {
  id?: string;
  status?: string;
}

interface ClassifiedWebhookEvent {
  eventCount: number;
  type: WebhookEventType;
}

type FeaturedCatalogProduct = Awaited<ReturnType<typeof getFeaturedProductsByDepartment>>[number];

const processedMessageIds = new Map<string, number>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncateDiagnostic(value: string | null) {
  if (!value) return null;
  return value.slice(0, 300);
}

function asDiagnosticString(value: unknown) {
  if (typeof value === 'string') {
    return truncateDiagnostic(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return truncateDiagnostic(String(value));
  }

  return null;
}

function asDiagnosticStatus(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function readCandidateValue(candidates: Record<string, unknown>[], keys: string[]) {
  for (const candidate of candidates) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(candidate, key)) {
        const value = candidate[key];
        if (value !== undefined && value !== null) {
          return value;
        }
      }
    }
  }

  return null;
}

function sanitizeError(error: unknown): SanitizedError {
  const candidates: Record<string, unknown>[] = [];

  if (isRecord(error)) {
    candidates.push(error);

    if (isRecord(error.cause)) {
      candidates.push(error.cause);
    }

    if (isRecord(error.error)) {
      candidates.push(error.error);
    }
  }

  const nameFromError = error instanceof Error ? truncateDiagnostic(error.name) : null;
  const messageFromError = error instanceof Error ? truncateDiagnostic(error.message) : null;

  const name = nameFromError ?? asDiagnosticString(readCandidateValue(candidates, ['name', 'type']));
  const message =
    messageFromError ??
    asDiagnosticString(readCandidateValue(candidates, ['message', 'error_description'])) ??
    (typeof error === 'string' ? truncateDiagnostic(error) : null);
  const code = asDiagnosticString(readCandidateValue(candidates, ['code', 'metaErrorCode', 'type']));
  const status =
    asDiagnosticStatus(readCandidateValue(candidates, ['status', 'statusCode', 'responseStatus'])) ??
    (isRecord(error) && isRecord(error.response) ? asDiagnosticStatus(error.response.status) : null);
  const details = asDiagnosticString(readCandidateValue(candidates, ['details', 'stack', 'responseText']));
  const hint = asDiagnosticString(readCandidateValue(candidates, ['hint']));

  return {
    code,
    details,
    hint,
    message,
    name,
    status,
  };
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

function isHumanHandoffIntent(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  return [
    'fechar compra',
    'quero comprar',
    'reservar',
    'reserva',
    'negociar',
    'desconto',
    'troca',
    'cancelamento',
    'cancelar',
    'pedido',
    'falar com atendente',
    'falar com pessoa',
    'atendimento humano',
  ].some((token) => normalized.includes(token));
}

function buildCategoryExamples() {
  const preferred = ['Botas', 'Camisas', 'Calças'];
  const preferredReal = preferred.filter((name) =>
    departamentosProduto.includes(name as (typeof departamentosProduto)[number]),
  );

  const extraReal = departamentosProduto
    .filter((name) => !preferredReal.includes(name))
    .slice(0, 4);

  return Array.from(new Set([...preferredReal, ...extraReal, 'Masculino', 'Feminino', 'Infantil']));
}

function buildChangeCategoryPrompt() {
  return `Ou digite o nome de outra categoria para ver novas opções.\n\nExemplos de categorias:\n${buildCategoryExamples().join('\n')}`;
}

function buildIdleCategoryHint() {
  return `Posso mostrar as novidades em destaque por categoria. Você pode pedir ${buildCategoryExamples()
    .map((item) => item.toLowerCase())
    .join(', ')}. 🤎`;
}

function normalizeCategorySessionValue(department: string | null, audience: CatalogAudience | null) {
  return department ?? audience ?? null;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatSizes(stock: Array<{ quantidade: number; tamanho: string }>) {
  const sizes = Array.from(new Set(stock.map((item) => item.tamanho).filter(Boolean)));

  if (!sizes.length) {
    return 'Não informado';
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

function isIdleSmalltalk(text: string) {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  return ['ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'quem e voce', 'como funciona'].some((term) =>
    normalized.includes(term),
  );
}

async function sendCategoryGallery(
  department: string | null,
  audience: CatalogAudience | null,
  updateStage: (stage: CategoryFlowStage) => void,
) {
  updateStage('search_featured_products');
  const featuredProducts = await getFeaturedProductsByDepartment(department, audience);

  console.info(`[whatsapp-catalog] Destaques encontrados: ${featuredProducts.length}`);

  updateStage('validate_products');
  return Array.from(new Map(featuredProducts.map((product) => [product.id, product])).values());
}

async function sendCategoryGalleryImages(
  to: string,
  products: FeaturedCatalogProduct[],
  updateStage: (stage: CategoryFlowStage) => void,
) {
  console.info('[whatsapp-media] Galeria iniciada');

  const sentProducts: WhatsAppPresentedProduct[] = [];

  for (const product of products) {
    const position = sentProducts.length + 1;

    try {
      updateStage('send_product_images');
      await sendWhatsAppImageMessage({
        caption: `Foto ${position}`,
        imageUrl: product.imagemPrincipal,
        to,
      });

      sentProducts.push({
        position,
        productId: product.id,
      });

      console.info(`[whatsapp-media] Foto enviada: ${position}`);
    } catch (error) {
      const sanitized = sanitizeError(error);
      console.warn('[whatsapp-media] Falha ao enviar imagem da galeria', {
        stage: 'send_product_images',
        ...sanitized,
      });
    }
  }

  console.info('[whatsapp-media] Galeria concluida');

  return sentProducts;
}

async function sendSelectedProductDetails(to: string, productId: number, updateStage: (stage: CategoryFlowStage) => void) {
  updateStage('load_selected_product');
  const product = await getProductById(productId);

  if (!product) {
    await sendWhatsAppTextMessage({
      body: PRODUCT_NOT_FOUND_REPLY,
      to,
    });

    return null;
  }

  const activePrice = product.emPromocao && product.precoPromocional !== null ? product.precoPromocional : product.preco;
  const hasPromotion = product.emPromocao && product.precoPromocional !== null;

  const lines = [
    product.nome,
    '',
    hasPromotion ? `De: ${formatCurrency(product.preco)}` : `Preço: ${formatCurrency(activePrice)}`,
    hasPromotion ? `Por: ${formatCurrency(activePrice)}` : null,
    '',
    `Tamanhos disponíveis: ${formatSizes(product.estoqueDisponivel)}`,
    '',
    'Ver no site:',
    `${SITE_URL}/produto/${product.id}`,
    '',
    'A disponibilidade pode mudar até a confirmação da venda.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  updateStage('send_product_details');
  await sendWhatsAppImageMessage({
    caption: lines,
    imageUrl: product.imagemPrincipal,
    to,
  });

  await sendWhatsAppTextMessage({
    body: 'Esse produto te interessou ou gostaria de ver outra foto?',
    to,
  });

  await sendWhatsAppTextMessage({
    body: 'Se preferir, digite o nome de outra categoria para ver novas novidades.',
    to,
  });

  return product;
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

        let stage: CategoryFlowStage = 'start';

        try {
          stage = 'load_conversation';
          const session = await getOrCreateWhatsAppSession(message.from);

          if (session.isNewSession) {
            console.info('[whatsapp-flow] Nova sessão');
            await sendWhatsAppTextMessage({ body: INTRO_MESSAGE, to: message.from });
          }

          if (!session.siteNoticeSent) {
            await sendWhatsAppTextMessage({ body: SITE_INTRO_MESSAGE, to: message.from });
            await updateWhatsAppSession(message.from, { siteNoticeSent: true });
            console.info('[whatsapp-flow] Site informado');
          }

          if (isHumanHandoffIntent(customerText)) {
            await sendWhatsAppTextMessage({ body: HUMAN_HANDOFF_MESSAGE, to: message.from });
            continue;
          }

          stage = 'identify_category';
          const detected = detectDepartmentFromMessage(customerText);
          const hasCategoryRequest = Boolean(detected.department || detected.audience);

          if (hasCategoryRequest) {
            console.info('[whatsapp-flow] Categoria alterada');

            const featuredProducts = await sendCategoryGallery(
              detected.department,
              detected.audience,
              (nextStage) => {
                stage = nextStage;
              },
            );

            if (featuredProducts.length === 0) {
              stage = 'persist_presented_products';
              await updateWhatsAppSession(message.from, {
                awaitingProductPosition: false,
                conversationState: 'idle',
                lastCategory: normalizeCategorySessionValue(detected.department, detected.audience),
                presentedProducts: [],
              });

              await sendWhatsAppTextMessage({
                body: NO_HIGHLIGHTS_MESSAGE,
                to: message.from,
              });

              await sendWhatsAppTextMessage({
                body: NO_HIGHLIGHTS_SITE_MESSAGE,
                to: message.from,
              });

              continue;
            }

            await sendWhatsAppTextMessage({ body: CATEGORY_PRE_GALLERY_MESSAGE, to: message.from });
            await sendWhatsAppTextMessage({ body: CATEGORY_PRE_GALLERY_SITE_MESSAGE, to: message.from });

            stage = 'persist_presented_products';
            const startedGallery = await startGallerySessionIfAvailable(message.from, {
              lastCategory: normalizeCategorySessionValue(detected.department, detected.audience),
            });

            if (!startedGallery) {
              continue;
            }

            const sentProducts = await sendCategoryGalleryImages(
              message.from,
              featuredProducts,
              (nextStage) => {
                stage = nextStage;
              },
            );

            stage = 'persist_presented_products';
            if (sentProducts.length === 0) {
              await updateWhatsAppSession(message.from, {
                awaitingProductPosition: false,
                conversationState: 'idle',
                lastCategory: normalizeCategorySessionValue(detected.department, detected.audience),
                presentedProducts: [],
              });

              await sendWhatsAppTextMessage({
                body: GALLERY_LOAD_FAILED_MESSAGE,
                to: message.from,
              });

              continue;
            }

            await updateWhatsAppSession(message.from, {
              awaitingProductPosition: true,
              conversationState: 'awaiting_photo_number',
              lastCategory: normalizeCategorySessionValue(detected.department, detected.audience),
              presentedProducts: sentProducts,
            });

            console.info('[whatsapp-flow] Mapeamento salvo');
            console.info('[whatsapp-flow] Aguardando número da foto');

            stage = 'send_selection_prompt';
            await sendWhatsAppTextMessage({ body: SELECTION_PROMPT_MESSAGE, to: message.from });
            await sendWhatsAppTextMessage({ body: CHANGE_CATEGORY_PROMPT_MESSAGE, to: message.from });

            continue;
          }

          if (session.conversationState === 'sending_gallery') {
            continue;
          }

          if (session.awaitingProductPosition) {
            const presentedProducts = extractValidPresentedProducts(session.presentedProducts);
            const availableCount = presentedProducts.length;
            const selectedPosition = extractProductPositionFromMessage(customerText);

            if (!selectedPosition || selectedPosition <= 0 || availableCount === 0) {
              await sendWhatsAppTextMessage({
                body: `Não encontrei essa foto. Digite um número entre 1 e ${Math.max(availableCount, 1)}.`,
                to: message.from,
              });
              await sendWhatsAppTextMessage({ body: CHANGE_CATEGORY_PROMPT_MESSAGE, to: message.from });
              continue;
            }

            const selected = presentedProducts.find((item) => item.position === selectedPosition);
            if (!selected) {
              await sendWhatsAppTextMessage({
                body: `Não encontrei essa foto. Digite um número entre 1 e ${availableCount}.`,
                to: message.from,
              });
              await sendWhatsAppTextMessage({ body: CHANGE_CATEGORY_PROMPT_MESSAGE, to: message.from });
              continue;
            }

            console.info('[whatsapp-flow] Produto selecionado');
            const product = await sendSelectedProductDetails(message.from, selected.productId, (nextStage) => {
              stage = nextStage;
            });

            if (!product) {
              continue;
            }

            await updateWhatsAppSession(message.from, {
              awaitingProductPosition: true,
              conversationState: 'awaiting_photo_number',
              presentedProducts,
            });

            continue;
          }

          if (isIdleSmalltalk(customerText)) {
            await sendWhatsAppTextMessage({
              body: buildIdleCategoryHint(),
              to: message.from,
            });
            continue;
          }

          const aiReply = await generateWhatsAppReply(customerText);
          if (aiReply?.trim()) {
            await sendWhatsAppTextMessage({ body: aiReply.trim(), to: message.from });
          }

          const categoriesPreview = departamentosProduto.slice(0, 8).join(', ');
          await sendWhatsAppTextMessage({
            body: `Posso mostrar as novidades em destaque por categoria.\n\nCategorias reais no catálogo: ${categoriesPreview}.`,
            to: message.from,
          });
        } catch (error: unknown) {
          const sanitized = sanitizeError(error);
          console.warn('[whatsapp-webhook] Falha no fluxo de atendimento por categoria/foto', {
            stage,
            ...sanitized,
          });

          try {
            await sendWhatsAppTextMessage({ body: FALLBACK_MESSAGE, to: message.from });
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
