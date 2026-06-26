import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { departamentosProduto, getOpcoesTamanho, getTipoGradeTamanho } from '@/config/grades-tamanho';
import { generateWhatsAppReply } from '@/lib/ai/generate-whatsapp-reply';
import {
  categoryRequiresSizeSelection,
  getAvailableSizesForCategory,
  getFeaturedProductsByDepartment,
  getProductById,
  type CatalogAudience,
} from '@/lib/whatsapp/catalog/category-flow';
import { routeWhatsAppIntent, type WhatsAppIntentResult } from '@/lib/whatsapp/intent-router';
import { enqueueWhatsAppSend } from '@/lib/whatsapp/send-queue';
import {
  finalizeGallerySession,
  getOrCreateWhatsAppSession,
  isGallerySessionActive,
  persistGalleryProgress,
  startGallerySessionIfAvailable,
  updateWhatsAppSession,
} from '@/lib/whatsapp/session';
import { WhatsAppSendMessageError, sendWhatsAppImageMessage, sendWhatsAppTextMessage } from '@/lib/whatsapp/send-message';
import {
  STORE_DELIVERY_PURCHASE_MESSAGE,
  STORE_GALLERY_CONTEXT_REMINDER,
  STORE_GENERAL_HELP_MESSAGE,
  STORE_INFO,
} from '@/lib/whatsapp/store-config';
import type { WhatsAppPresentedProduct } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGE_ID_TTL_MS = 2 * 60 * 1000;
const IMAGE_SEND_DELAY_MS = 700;
const FINAL_PROMPT_DELAY_MS = 1000;
const PRODUCT_DETAILS_FOLLOW_UP_DELAY_MS = 1000;
const PHOTO_SELECTION_TIMEOUT_MINUTES = 30;

const INTRO_MESSAGE =
  'Olá! Seja bem-vindo(a) à Pastoril Moda Country. 🤎\n\nPosso ajudar você a conhecer nossas novidades e encontrar produtos disponíveis.';
const SITE_INTRO_MESSAGE = `Você também pode conhecer nossa vitrine pelo site:\n\n${STORE_INFO.siteUrl}`;

const CATEGORY_PRE_GALLERY_MESSAGE = 'Estas são as novidades em destaque dessa categoria. 🤎';
const CATEGORY_PRE_GALLERY_SITE_MESSAGE =
  `As fotos abaixo mostram as novidades selecionadas da categoria.\n\nPara ver mais produtos, acesse:\n${STORE_INFO.siteUrl}`;

const CATEGORY_PRE_GALLERY_ALL_SIZES_MESSAGE = 'Estas são as novidades em destaque dessa categoria com tamanhos disponíveis. 🤎';
const CATEGORY_PRE_GALLERY_SIZE_MESSAGE = 'Estas são as novidades em destaque disponíveis no tamanho {size}. 🤎';
const SIZE_PREFERENCE_REMINDER_MESSAGE = 'Quando quiser continuar, responda “todos” ou informe o tamanho que procura.';
const SIZE_PREFERENCE_RETRY_MESSAGE = 'Você quer ver todos os tamanhos disponíveis ou informar outro tamanho?';
const INVALID_SIZE_MESSAGE =
  'Não reconheci esse tamanho. Você pode responder “todos” ou informar um tamanho disponível para essa categoria.';

const SELECTION_PROMPT_MESSAGE =
  'Digite o número da foto que você quer saber mais detalhes.\n\nOu digite o nome de outra categoria para ver novas opções.';

const NO_HIGHLIGHTS_MESSAGE = 'Não encontrei novidades em destaque disponíveis nessa categoria agora. 🤎';
const NO_HIGHLIGHTS_SITE_MESSAGE =
  `Você pode escolher outra categoria ou ver todos os produtos no site:\n\n${STORE_INFO.siteUrl}`;
const GALLERY_LOAD_FAILED_MESSAGE =
  `Não consegui carregar as fotos dessa categoria agora.\n\nVocê pode ver os produtos no site:\n${STORE_INFO.siteUrl}`;

const HUMAN_HANDOFF_MESSAGE = 'Vou encaminhar seu atendimento para a equipe da Pastoril continuar por aqui. 🤎';
const PRODUCT_NOT_FOUND_REPLY =
  'Esse produto não está mais disponível neste momento. Digite outro número da lista ou peça outra categoria.';
const FALLBACK_MESSAGE =
  'Não consegui concluir o atendimento automático agora. Nossa equipe pode continuar por aqui com você. 🤎';

type WebhookEventType = 'mensagem' | 'status' | 'desconhecido';

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

function normalizeCategorySessionValue(department: string | null, audience: string | null) {
  return department ?? audience ?? null;
}

function normalizeSizeValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMessageForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllSizesRequest(message: string) {
  const normalized = normalizeMessageForMatch(message);
  return [
    'todos',
    'todo',
    'todas',
    'qualquer tamanho',
    'todos os tamanhos',
    'mostrar tudo',
    'quero ver todos',
  ].includes(normalized);
}

function looksLikeSizeAttempt(message: string) {
  const normalized = normalizeMessageForMatch(message);
  if (!normalized) return false;
  if (/(^|\b)(foto|pedido|codigo|cod|horario|hora|abre|fecha)\b/.test(normalized)) return false;
  if (/^(pp|p|m|g|gg|xg)$/.test(normalized)) return true;
  if (/^\d{1,2}$/.test(normalized)) return true;
  return /\b(tamanho|numero|número|calco|calço|uso|quero)\b/.test(normalized) && /\b(pp|p|m|g|gg|xg|\d{1,2})\b/.test(normalized);
}

function extractRequestedSize(message: string, validSizes: string[]) {
  const validByNormalized = new Map(validSizes.map((size) => [normalizeSizeValue(size), size]));
  const normalizedMessage = normalizeMessageForMatch(message).toUpperCase();

  if (!normalizedMessage || /\b(FOTO|PEDIDO|CODIGO|COD)\b/.test(normalizedMessage)) {
    return null;
  }

  for (const token of normalizedMessage.split(' ')) {
    const match = validByNormalized.get(normalizeSizeValue(token));
    if (match) {
      return match;
    }
  }

  return null;
}

function formatShortSizeList(sizes: string[]) {
  const unique = Array.from(new Set(sizes.map((size) => size.trim()).filter(Boolean)));
  if (!unique.length) return '';
  return ` Tamanhos disponíveis: ${unique.slice(0, 12).join(', ')}.`;
}

function getRecognizedSizesForCategory(department: string | null, audience: CatalogAudience | null, availableSizes: string[]) {
  const configuredSizes = department ? getOpcoesTamanho(department, audience) : [];
  return Array.from(new Set([...configuredSizes, ...availableSizes]));
}

function buildSizePreferenceQuestion(department: string | null, audience: CatalogAudience | null, availableSizes: string[]) {
  const category = department ?? audience;
  const tipoGrade = category ? getTipoGradeTamanho(category, audience) : null;
  const configuredSizes = department ? getOpcoesTamanho(department, audience) : [];
  const examples = availableSizes.length ? availableSizes.slice(0, 5) : configuredSizes.slice(0, 5);
  const exampleText = examples.length ? examples.join(', ') : tipoGrade === 'calcado' ? '35, 38, 40 ou 42' : 'P, M, G, GG ou 42';
  const categoryKind = tipoGrade === 'calcado' ? 'uma numeração' : 'um tamanho';

  return [
    'Você quer ver todos os tamanhos disponíveis ou procura algum tamanho específico?',
    '',
    `Você pode responder “todos” ou informar ${categoryKind}, como ${exampleText}.`,
  ].join('\n');
}

function getPendingAudience(value: string | null): CatalogAudience | null {
  if (value === 'Feminino' || value === 'Masculino' || value === 'Infantil') {
    return value;
  }

  return null;
}

async function sendSizeReminderIfNeeded(to: string, conversationState: string) {
  if (conversationState !== 'awaiting_size_preference') {
    return;
  }

  await sendWhatsAppTextMessage({
    body: SIZE_PREFERENCE_REMINDER_MESSAGE,
    to,
  });
}

function buildIdleCategoryHint() {
  const preferred = ['Botas', 'Camisas', 'Calças'];
  const preferredReal = preferred.filter((name) => departamentosProduto.includes(name as (typeof departamentosProduto)[number]));
  const extras = departamentosProduto.filter((name) => !preferredReal.includes(name)).slice(0, 4);
  const categories = [...preferredReal, ...extras, 'Masculino', 'Feminino', 'Infantil'];

  return `Posso mostrar as novidades em destaque por categoria. Você pode pedir ${Array.from(new Set(categories))
    .map((value) => value.toLowerCase())
    .join(', ')}. 🤎`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getPhotoSelectionExpiresAtIso() {
  return new Date(Date.now() + PHOTO_SELECTION_TIMEOUT_MINUTES * 60 * 1000).toISOString();
}

function isPhotoSelectionExpired(expiresAt: string | null) {
  if (!expiresAt) {
    return true;
  }

  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return Date.now() > timestamp;
}

async function sendSelectedProductDetails(to: string, productId: number) {
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
    `${STORE_INFO.siteUrl}/produto/${product.id}`,
    '',
    'A disponibilidade pode mudar até a confirmação da venda.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  try {
    await sendWhatsAppImageMessage({
      caption: lines,
      imageUrl: product.imagemPrincipal,
      to,
    });
    console.info('[whatsapp-product] Foto detalhada enviada');
  } catch (error) {
    const sanitized = sanitizeError(error);
    console.warn('[whatsapp-media] Falha ao enviar imagem detalhada', {
      ...sanitized,
    });

    await sendWhatsAppTextMessage({
      body: lines,
      to,
    });
  }

  await delay(PRODUCT_DETAILS_FOLLOW_UP_DELAY_MS);

  await sendWhatsAppTextMessage({
    body: 'Esse produto te interessou ou gostaria de ver outra foto?',
    to,
  });

  console.info('[whatsapp-product] Pergunta de continuidade enviada');

  return product;
}

async function askSizePreference({
  to,
  audience,
  department,
}: {
  to: string;
  audience: CatalogAudience | null;
  department: string | null;
}) {
  const availableSizes = await getAvailableSizesForCategory(department, audience);

  console.info('[whatsapp-size] Categoria exige tamanho');

  await updateWhatsAppSession(to, {
    activeGalleryId: null,
    awaitingProductPosition: false,
    conversationState: 'awaiting_size_preference',
    lastCategory: normalizeCategorySessionValue(department, audience),
    pendingCategory: audience,
    pendingDepartment: department,
    photoSelectionExpiresAt: null,
    presentedProducts: [],
    requestedSize: null,
  });

  console.info('[whatsapp-size] Aguardando preferência de tamanho');

  await sendWhatsAppTextMessage({
    body: buildSizePreferenceQuestion(department, audience, availableSizes),
    to,
  });
}

async function sendCategoryGalleryFlow({
  to,
  audience,
  department,
  requestedSize,
}: {
  to: string;
  audience: WhatsAppIntentResult['audience'];
  department: WhatsAppIntentResult['department'];
  requestedSize?: string | null;
}) {
  const featuredProducts = Array.from(
    new Map((await getFeaturedProductsByDepartment(department, audience, { size: requestedSize })).map((product) => [product.id, product])).values(),
  ) as FeaturedCatalogProduct[];

  console.info(`[whatsapp-catalog] Destaques encontrados: ${featuredProducts.length}`);

  if (featuredProducts.length === 0) {
    await updateWhatsAppSession(to, {
      activeGalleryId: null,
      awaitingProductPosition: false,
      conversationState: 'idle',
      lastCategory: normalizeCategorySessionValue(department, audience),
      pendingCategory: null,
      pendingDepartment: null,
      photoSelectionExpiresAt: null,
      presentedProducts: [],
      requestedSize: null,
    });

    await sendWhatsAppTextMessage({ body: NO_HIGHLIGHTS_MESSAGE, to });
    await sendWhatsAppTextMessage({ body: NO_HIGHLIGHTS_SITE_MESSAGE, to });
    return;
  }

  await sendWhatsAppTextMessage({
    body: requestedSize
      ? CATEGORY_PRE_GALLERY_SIZE_MESSAGE.replace('{size}', requestedSize)
      : categoryRequiresSizeSelection(department, audience)
        ? CATEGORY_PRE_GALLERY_ALL_SIZES_MESSAGE
        : CATEGORY_PRE_GALLERY_MESSAGE,
    to,
  });
  await sendWhatsAppTextMessage({ body: CATEGORY_PRE_GALLERY_SITE_MESSAGE, to });

  const activeGalleryId = randomUUID();
  const startedGallery = await startGallerySessionIfAvailable(to, {
    activeGalleryId,
    lastCategory: normalizeCategorySessionValue(department, audience),
    pendingCategory: null,
    pendingDepartment: null,
    requestedSize: requestedSize ?? null,
  });

  if (!startedGallery) {
    return;
  }

  console.info('[whatsapp-gallery] Galeria enfileirada');

  await enqueueWhatsAppSend(to, async () => {
    console.info('[whatsapp-gallery] Galeria iniciada');

    const sentProducts: WhatsAppPresentedProduct[] = [];

    for (const product of featuredProducts) {
      const stillActive = await isGallerySessionActive(to, activeGalleryId);
      if (!stillActive) {
        console.info('[whatsapp-gallery] Galeria substituída');
        return;
      }

      const position = sentProducts.length + 1;

      try {
        await sendWhatsAppImageMessage({
          caption: `Foto ${position}`,
          imageUrl: product.imagemPrincipal,
          to,
        });

        sentProducts.push({ position, productId: product.id });
        console.info(`[whatsapp-gallery] Foto aceita: ${position}`);

        const progressSaved = await persistGalleryProgress(to, activeGalleryId, sentProducts);
        if (!progressSaved) {
          console.info('[whatsapp-gallery] Galeria substituída');
          return;
        }
      } catch (error) {
        const sanitized = sanitizeError(error);
        console.warn('[whatsapp-media] Falha ao enviar imagem da galeria', {
          ...sanitized,
        });
      }

      await delay(IMAGE_SEND_DELAY_MS);
    }

    if (sentProducts.length === 0) {
      const stillActive = await isGallerySessionActive(to, activeGalleryId);
      if (!stillActive) {
        console.info('[whatsapp-gallery] Galeria substituída');
        return;
      }

      await updateWhatsAppSession(to, {
        activeGalleryId: null,
        awaitingProductPosition: false,
        conversationState: 'idle',
        pendingCategory: null,
        pendingDepartment: null,
        photoSelectionExpiresAt: null,
        presentedProducts: [],
        requestedSize: null,
      });

      await sendWhatsAppTextMessage({ body: GALLERY_LOAD_FAILED_MESSAGE, to });
      return;
    }

    const finalized = await finalizeGallerySession(to, {
      activeGalleryId,
      photoSelectionExpiresAt: getPhotoSelectionExpiresAtIso(),
      presentedProducts: sentProducts,
    });

    if (!finalized) {
      console.info('[whatsapp-gallery] Galeria substituída');
      return;
    }

    await delay(FINAL_PROMPT_DELAY_MS);

    await sendWhatsAppTextMessage({ body: SELECTION_PROMPT_MESSAGE, to });

    console.info('[whatsapp-gallery] Galeria concluída');
    console.info('[whatsapp-gallery] Pergunta final enviada');
  });
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
        if (!message.id || !message.from) {
          continue;
        }

        if (isDuplicateMessageId(message.id)) {
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

        try {
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

          if (session.awaitingProductPosition && isPhotoSelectionExpired(session.photoSelectionExpiresAt)) {
            await updateWhatsAppSession(message.from, {
              activeGalleryId: null,
              awaitingProductPosition: false,
              conversationState: 'idle',
              pendingCategory: null,
              pendingDepartment: null,
              photoSelectionExpiresAt: null,
              presentedProducts: [],
              requestedSize: null,
            });
          }

          const currentSession = await getOrCreateWhatsAppSession(message.from);
          const intentResult = routeWhatsAppIntent({
            message: customerText,
            session: currentSession,
          });

          if (intentResult.intent === 'human_service') {
            await sendWhatsAppTextMessage({ body: HUMAN_HANDOFF_MESSAGE, to: message.from });
            continue;
          }

          if (intentResult.intent === 'cancel_gallery') {
            await updateWhatsAppSession(message.from, {
              activeGalleryId: null,
              awaitingProductPosition: false,
              conversationState: 'idle',
              pendingCategory: null,
              pendingDepartment: null,
              photoSelectionExpiresAt: null,
              presentedProducts: [],
              requestedSize: null,
            });

            await sendWhatsAppTextMessage({
              body: 'Perfeito, encerrei esta galeria. Se quiser, posso te mostrar outra categoria. 🤎',
              to: message.from,
            });
            continue;
          }

          if (intentResult.intent === 'change_category' || intentResult.intent === 'request_category') {
            if (!intentResult.department && !intentResult.audience) {
              await sendWhatsAppTextMessage({
                body: buildIdleCategoryHint(),
                to: message.from,
              });
              continue;
            }

            console.info('[whatsapp-flow] Categoria alterada');
            if (categoryRequiresSizeSelection(intentResult.department, intentResult.audience)) {
              await askSizePreference({
                to: message.from,
                audience: intentResult.audience,
                department: intentResult.department,
              });
              continue;
            }

            await sendCategoryGalleryFlow({
              to: message.from,
              audience: intentResult.audience,
              department: intentResult.department,
              requestedSize: null,
            });
            continue;
          }

          if (currentSession.conversationState === 'sending_gallery') {
            continue;
          }

          if (intentResult.intent === 'store_hours') {
            await sendWhatsAppTextMessage({ body: STORE_INFO.hours, to: message.from });
            await sendSizeReminderIfNeeded(message.from, currentSession.conversationState);
            continue;
          }

          if (intentResult.intent === 'store_address') {
            await sendWhatsAppTextMessage({ body: STORE_INFO.address, to: message.from });
            await sendSizeReminderIfNeeded(message.from, currentSession.conversationState);
            continue;
          }

          if (intentResult.intent === 'store_instagram') {
            await sendWhatsAppTextMessage({ body: STORE_INFO.instagram, to: message.from });
            await sendSizeReminderIfNeeded(message.from, currentSession.conversationState);
            continue;
          }

          if (intentResult.intent === 'store_website') {
            await sendWhatsAppTextMessage({ body: STORE_INFO.siteNotice, to: message.from });
            await sendSizeReminderIfNeeded(message.from, currentSession.conversationState);
            continue;
          }

          if (intentResult.intent === 'delivery_question' || intentResult.intent === 'purchase_question') {
            await sendWhatsAppTextMessage({ body: STORE_DELIVERY_PURCHASE_MESSAGE, to: message.from });
            await sendSizeReminderIfNeeded(message.from, currentSession.conversationState);
            continue;
          }

          if (currentSession.conversationState === 'awaiting_size_preference') {
            const pendingDepartment = currentSession.pendingDepartment;
            const pendingAudience = getPendingAudience(currentSession.pendingCategory);

            if (!pendingDepartment && !pendingAudience) {
              await updateWhatsAppSession(message.from, {
                conversationState: 'idle',
                pendingCategory: null,
                pendingDepartment: null,
                requestedSize: null,
              });
              await sendWhatsAppTextMessage({ body: buildIdleCategoryHint(), to: message.from });
              continue;
            }

            const availableSizes = await getAvailableSizesForCategory(pendingDepartment, pendingAudience);
            const recognizedSizes = getRecognizedSizesForCategory(pendingDepartment, pendingAudience, availableSizes);

            if (isAllSizesRequest(customerText)) {
              console.info('[whatsapp-size] Todos os tamanhos selecionados');
              await sendCategoryGalleryFlow({
                to: message.from,
                audience: pendingAudience,
                department: pendingDepartment,
                requestedSize: null,
              });
              continue;
            }

            const requestedSize = extractRequestedSize(customerText, recognizedSizes);
            if (requestedSize) {
              console.info('[whatsapp-size] Tamanho específico identificado');

              const productsForSize = await getFeaturedProductsByDepartment(pendingDepartment, pendingAudience, { size: requestedSize });
              console.info(`[whatsapp-size] Produtos encontrados para o tamanho: ${productsForSize.length}`);

              if (!productsForSize.length) {
                console.info('[whatsapp-size] Nenhum produto para o tamanho');
                await updateWhatsAppSession(message.from, {
                  conversationState: 'awaiting_size_preference',
                  pendingCategory: pendingAudience,
                  pendingDepartment,
                  requestedSize,
                });
                await sendWhatsAppTextMessage({
                  body: `Não encontrei novidades em destaque dessa categoria no tamanho ${requestedSize} agora. 🤎`,
                  to: message.from,
                });
                await sendWhatsAppTextMessage({ body: SIZE_PREFERENCE_RETRY_MESSAGE, to: message.from });
                continue;
              }

              await sendCategoryGalleryFlow({
                to: message.from,
                audience: pendingAudience,
                department: pendingDepartment,
                requestedSize,
              });
              continue;
            }

            if (looksLikeSizeAttempt(customerText)) {
              await sendWhatsAppTextMessage({
                body: `${INVALID_SIZE_MESSAGE}${formatShortSizeList(availableSizes)}`,
                to: message.from,
              });
              continue;
            }

            if (intentResult.intent === 'greeting' || intentResult.intent === 'general_question') {
              const aiReply = await generateWhatsAppReply(customerText);
              if (aiReply?.trim()) {
                await sendWhatsAppTextMessage({ body: aiReply.trim(), to: message.from });
              }

              await sendWhatsAppTextMessage({ body: SIZE_PREFERENCE_REMINDER_MESSAGE, to: message.from });
              continue;
            }

            await sendWhatsAppTextMessage({
              body: buildSizePreferenceQuestion(pendingDepartment, pendingAudience, availableSizes),
              to: message.from,
            });
            continue;
          }

          if (intentResult.intent === 'product_question') {
            const aiReply = await generateWhatsAppReply(customerText);
            if (aiReply?.trim()) {
              await sendWhatsAppTextMessage({ body: aiReply.trim(), to: message.from });
            }

            await sendWhatsAppTextMessage({ body: STORE_GALLERY_CONTEXT_REMINDER, to: message.from });
            continue;
          }

          if (intentResult.intent === 'select_photo') {
            const presentedProducts = extractValidPresentedProducts(currentSession.presentedProducts);
            const availableCount = presentedProducts.length;

            if (!currentSession.awaitingProductPosition || isPhotoSelectionExpired(currentSession.photoSelectionExpiresAt) || availableCount === 0) {
              await sendWhatsAppTextMessage({
                body: buildIdleCategoryHint(),
                to: message.from,
              });
              continue;
            }

            const selected = presentedProducts.find((item) => item.position === intentResult.selectedPhotoPosition);

            if (!selected) {
              await sendWhatsAppTextMessage({
                body: `Não encontrei essa foto. Digite um número entre 1 e ${availableCount}.`,
                to: message.from,
              });
              continue;
            }

            console.info('[whatsapp-flow] Produto selecionado');
            const recipient = message.from;
            const product = await enqueueWhatsAppSend(recipient, () => sendSelectedProductDetails(recipient, selected.productId));

            if (!product) {
              continue;
            }

            await updateWhatsAppSession(message.from, {
              awaitingProductPosition: true,
              conversationState: 'awaiting_photo_number',
              photoSelectionExpiresAt: getPhotoSelectionExpiresAtIso(),
              presentedProducts,
            });

            continue;
          }

          if (intentResult.intent === 'greeting') {
            await sendWhatsAppTextMessage({
              body: STORE_GENERAL_HELP_MESSAGE,
              to: message.from,
            });
            continue;
          }

          const aiReply = await generateWhatsAppReply(customerText);
          if (aiReply?.trim()) {
            await sendWhatsAppTextMessage({ body: aiReply.trim(), to: message.from });
          }

          await sendWhatsAppTextMessage({
            body: buildIdleCategoryHint(),
            to: message.from,
          });
        } catch (error: unknown) {
          const sanitized = sanitizeError(error);
          console.warn('[whatsapp-webhook] Falha no fluxo de atendimento por categoria/foto', {
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
