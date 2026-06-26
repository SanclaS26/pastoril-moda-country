import {
  detectDepartmentFromMessage,
  type CatalogAudience,
} from '@/lib/whatsapp/catalog/category-flow';
import type { WhatsAppSessionState } from '@/lib/whatsapp/session';

export type WhatsAppIntent =
  | 'human_service'
  | 'change_category'
  | 'request_category'
  | 'store_hours'
  | 'store_address'
  | 'store_instagram'
  | 'store_website'
  | 'delivery_question'
  | 'purchase_question'
  | 'cancel_gallery'
  | 'select_photo'
  | 'product_question'
  | 'greeting'
  | 'general_question'
  | 'unknown';

export type WhatsAppIntentResult = {
  audience: CatalogAudience | null;
  department: string | null;
  intent: WhatsAppIntent;
  selectedPhotoPosition: number | null;
};

const HUMAN_SERVICE_KEYWORDS = [
  'fechar compra',
  'quero comprar',
  'reservar',
  'reserva',
  'negociar',
  'desconto',
  'troca',
  'cancelamento',
  'cancelar pedido',
  'pedido',
  'falar com atendente',
  'falar com pessoa',
  'atendimento humano',
];

const CANCEL_GALLERY_KEYWORDS = [
  'cancelar galeria',
  'parar galeria',
  'encerrar galeria',
  'cancelar fotos',
  'parar fotos',
  'sair da galeria',
  'cancelar selecao',
  'parar selecao',
  'encerrar selecao',
];

const CHANGE_CATEGORY_KEYWORDS = [
  'outra categoria',
  'mudar categoria',
  'trocar categoria',
  'agora mostre',
  'voltar para',
  'quero ver outra',
  'mostrar outra',
];

const STORE_HOURS_KEYWORDS = [
  'qual o horario',
  'que horas abre',
  'que horas fecha',
  'horario de funcionamento',
  'abre sabado',
  'funciona domingo',
];

const STORE_ADDRESS_KEYWORDS = ['onde fica', 'qual o endereco', 'localizacao da loja', 'tem loja fisica'];
const STORE_INSTAGRAM_KEYWORDS = ['qual o instagram', 'instagram da loja', 'rede social'];
const STORE_WEBSITE_KEYWORDS = ['qual o site', 'site da loja', 'onde vejo os produtos'];

const DELIVERY_KEYWORDS = ['entrega', 'entregam', 'frete', 'envio', 'retirada'];
const PURCHASE_KEYWORDS = ['como comprar', 'forma de pagamento', 'pagamento', 'parcelamento', 'comprar'];
const PRODUCT_KEYWORDS = ['produto', 'preco', 'valor', 'tamanho', 'tem desse', 'codigo', 'cor'];
const GREETING_KEYWORDS = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem'];
const GENERAL_QUESTION_KEYWORDS = ['como', 'qual', 'quais', 'quando', 'onde', 'vocês', 'voces', 'tem'];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(normalizedText: string, keywords: string[]) {
  return keywords.some((keyword) => normalizedText.includes(keyword));
}

function normalizeCategoryValue(value: string | null) {
  return normalizeText(value ?? '');
}

function isExplicitCategoryChange(normalizedText: string, session: WhatsAppSessionState) {
  return session.awaitingProductPosition || containsAny(normalizedText, CHANGE_CATEGORY_KEYWORDS);
}

export function extractPhotoSelection(message: string): number | null {
  const normalized = normalizeText(message);

  if (!normalized) {
    return null;
  }

  const allNumbers = normalized.match(/\d+/g) ?? [];
  if (allNumbers.length !== 1) {
    return null;
  }

  if (/^\d{1,3}$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  const explicitSelectionPatterns = [
    /(?:^|\b)foto\s*(\d{1,3})(?:\b|$)/,
    /(?:^|\b)(?:numero|número)\s*(\d{1,3})(?:\b|$)/,
    /(?:^|\b)(?:quero|gostei|mostre|mostrar|me mostra|quero saber)\b[^\d]{0,30}(\d{1,3})(?:\b|$)/,
  ];

  for (const pattern of explicitSelectionPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return Number.parseInt(match[1], 10);
    }
  }

  return null;
}

export function routeWhatsAppIntent({
  message,
  session,
}: {
  message: string;
  session: WhatsAppSessionState;
}): WhatsAppIntentResult {
  const normalizedText = normalizeText(message);
  const categoryDetection = detectDepartmentFromMessage(message);
  const hasCategoryRequest = Boolean(categoryDetection.department || categoryDetection.audience);

  if (containsAny(normalizedText, HUMAN_SERVICE_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'human_service',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, CANCEL_GALLERY_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'cancel_gallery',
      selectedPhotoPosition: null,
    };
  }

  const requestedCategoryValue = normalizeCategoryValue(categoryDetection.department ?? categoryDetection.audience);
  const currentCategoryValue = normalizeCategoryValue(session.lastCategory);

  if (hasCategoryRequest && isExplicitCategoryChange(normalizedText, session) && requestedCategoryValue !== currentCategoryValue) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'change_category',
      selectedPhotoPosition: null,
    };
  }

  if (hasCategoryRequest) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'request_category',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, STORE_HOURS_KEYWORDS)) {
    console.info('[whatsapp-intent] Pergunta de horário identificada');
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'store_hours',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, STORE_ADDRESS_KEYWORDS)) {
    console.info('[whatsapp-intent] Pergunta institucional identificada');
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'store_address',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, STORE_INSTAGRAM_KEYWORDS)) {
    console.info('[whatsapp-intent] Pergunta institucional identificada');
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'store_instagram',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, STORE_WEBSITE_KEYWORDS)) {
    console.info('[whatsapp-intent] Pergunta institucional identificada');
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'store_website',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, DELIVERY_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'delivery_question',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, PURCHASE_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'purchase_question',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, PRODUCT_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'product_question',
      selectedPhotoPosition: null,
    };
  }

  const selectedPhotoPosition = extractPhotoSelection(message);
  if (selectedPhotoPosition && selectedPhotoPosition > 0) {
    console.info('[whatsapp-intent] Seleção de foto identificada');
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'select_photo',
      selectedPhotoPosition,
    };
  }

  console.info('[whatsapp-intent] Mensagem não é seleção de foto');

  if (containsAny(normalizedText, GREETING_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'greeting',
      selectedPhotoPosition: null,
    };
  }

  if (containsAny(normalizedText, GENERAL_QUESTION_KEYWORDS)) {
    return {
      audience: categoryDetection.audience,
      department: categoryDetection.department,
      intent: 'general_question',
      selectedPhotoPosition: null,
    };
  }

  return {
    audience: categoryDetection.audience,
    department: categoryDetection.department,
    intent: normalizedText ? 'general_question' : 'unknown',
    selectedPhotoPosition: null,
  };
}
