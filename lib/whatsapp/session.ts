import {
  getSupabaseAdmin,
  type WhatsAppAtendimentoSessaoRow,
  type WhatsAppConversationState,
  type WhatsAppPresentedProduct,
} from '@/lib/supabase-admin';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type WhatsAppSessionState = {
  activeGalleryId: string | null;
  awaitingProductPosition: boolean;
  conversationState: WhatsAppConversationState;
  isNewSession: boolean;
  lastCategory: string | null;
  phone: string;
  photoSelectionExpiresAt: string | null;
  presentedProducts: WhatsAppPresentedProduct[];
  siteNoticeSent: boolean;
};

export type UpdateWhatsAppSessionInput = {
  activeGalleryId?: string | null;
  awaitingProductPosition?: boolean;
  conversationState?: WhatsAppConversationState;
  lastCategory?: string | null;
  photoSelectionExpiresAt?: string | null;
  presentedProducts?: WhatsAppPresentedProduct[];
  siteNoticeSent?: boolean;
};

export type StartGallerySessionInput = {
  activeGalleryId: string;
  lastCategory?: string | null;
};

export type FinalizeGallerySessionInput = {
  activeGalleryId: string;
  photoSelectionExpiresAt: string;
  presentedProducts: WhatsAppPresentedProduct[];
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function mapSession(row: WhatsAppAtendimentoSessaoRow, isNewSession: boolean): WhatsAppSessionState {
  const presentedProducts = Array.isArray(row.presented_products)
    ? row.presented_products
        .filter((item) => Number.isInteger(item.position) && item.position > 0 && Number.isInteger(item.productId) && item.productId > 0)
        .map((item) => ({ position: item.position, productId: item.productId }))
    : [];

  return {
    activeGalleryId: row.active_gallery_id,
    awaitingProductPosition: row.awaiting_product_position,
    conversationState: row.conversation_state,
    isNewSession,
    lastCategory: row.last_category,
    phone: row.phone,
    photoSelectionExpiresAt: row.photo_selection_expires_at,
    presentedProducts,
    siteNoticeSent: row.site_notice_sent,
  };
}

export async function getOrCreateWhatsAppSession(phone: string): Promise<WhatsAppSessionState> {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error('Telefone invalido para sessao WhatsApp.');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .select('id, phone, session_started_at, last_interaction_at, active_gallery_id, photo_selection_expires_at, site_notice_sent, awaiting_product_position, conversation_state, last_category, presented_products, created_at, updated_at')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const nowIso = new Date().toISOString();

  if (!data) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('whatsapp_atendimento_sessoes')
      .insert({
        awaiting_product_position: false,
        active_gallery_id: null,
        conversation_state: 'idle',
        last_category: null,
        last_interaction_at: nowIso,
        photo_selection_expires_at: null,
        phone: normalizedPhone,
        presented_products: [],
        session_started_at: nowIso,
        site_notice_sent: false,
      })
      .select('id, phone, session_started_at, last_interaction_at, active_gallery_id, photo_selection_expires_at, site_notice_sent, awaiting_product_position, conversation_state, last_category, presented_products, created_at, updated_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    return mapSession(inserted, true);
  }

  const lastInteractionAt = new Date(data.last_interaction_at).getTime();
  const expired = Number.isFinite(lastInteractionAt) ? Date.now() - lastInteractionAt > SESSION_TTL_MS : true;

  if (expired) {
    const { data: resetSession, error: resetError } = await supabaseAdmin
      .from('whatsapp_atendimento_sessoes')
      .update({
        awaiting_product_position: false,
        active_gallery_id: null,
        conversation_state: 'idle',
        last_category: null,
        last_interaction_at: nowIso,
        photo_selection_expires_at: null,
        presented_products: [],
        session_started_at: nowIso,
        site_notice_sent: false,
      })
      .eq('id', data.id)
      .select('id, phone, session_started_at, last_interaction_at, active_gallery_id, photo_selection_expires_at, site_notice_sent, awaiting_product_position, conversation_state, last_category, presented_products, created_at, updated_at')
      .single();

    if (resetError) {
      throw resetError;
    }

    return mapSession(resetSession, true);
  }

  const { data: touched, error: touchError } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .update({ last_interaction_at: nowIso })
    .eq('id', data.id)
    .select('id, phone, session_started_at, last_interaction_at, active_gallery_id, photo_selection_expires_at, site_notice_sent, awaiting_product_position, conversation_state, last_category, presented_products, created_at, updated_at')
    .single();

  if (touchError) {
    throw touchError;
  }

  return mapSession(touched, false);
}

export async function updateWhatsAppSession(phone: string, input: UpdateWhatsAppSessionInput) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error('Telefone invalido para atualizar sessao WhatsApp.');
  }

  const updates: {
    active_gallery_id?: string | null;
    awaiting_product_position?: boolean;
    conversation_state?: WhatsAppConversationState;
    last_category?: string | null;
    last_interaction_at: string;
    photo_selection_expires_at?: string | null;
    presented_products?: WhatsAppPresentedProduct[];
    site_notice_sent?: boolean;
  } = {
    last_interaction_at: new Date().toISOString(),
  };

  if (typeof input.awaitingProductPosition === 'boolean') {
    updates.awaiting_product_position = input.awaitingProductPosition;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'activeGalleryId')) {
    updates.active_gallery_id = input.activeGalleryId ?? null;
  }

  if (input.conversationState) {
    updates.conversation_state = input.conversationState;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'lastCategory')) {
    updates.last_category = input.lastCategory ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'photoSelectionExpiresAt')) {
    updates.photo_selection_expires_at = input.photoSelectionExpiresAt ?? null;
  }

  if (typeof input.siteNoticeSent === 'boolean') {
    updates.site_notice_sent = input.siteNoticeSent;
  }

  if (Array.isArray(input.presentedProducts)) {
    updates.presented_products = input.presentedProducts
      .filter((item) => Number.isInteger(item.position) && item.position > 0 && Number.isInteger(item.productId) && item.productId > 0)
      .map((item) => ({
        position: item.position,
        productId: item.productId,
      }));
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .update(updates)
    .eq('phone', normalizedPhone);

  if (error) {
    throw error;
  }
}

export async function startGallerySessionIfAvailable(phone: string, input?: StartGallerySessionInput) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error('Telefone invalido para atualizar sessao WhatsApp.');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const updates: {
    active_gallery_id: string;
    awaiting_product_position: boolean;
    conversation_state: WhatsAppConversationState;
    last_category?: string | null;
    last_interaction_at: string;
    photo_selection_expires_at: string | null;
    presented_products: WhatsAppPresentedProduct[];
  } = {
    active_gallery_id: input?.activeGalleryId ?? '',
    awaiting_product_position: false,
    conversation_state: 'sending_gallery',
    last_interaction_at: new Date().toISOString(),
    photo_selection_expires_at: null,
    presented_products: [],
  };

  if (Object.prototype.hasOwnProperty.call(input ?? {}, 'lastCategory')) {
    updates.last_category = input?.lastCategory ?? null;
  }

  if (!updates.active_gallery_id) {
    throw new Error('activeGalleryId obrigatorio para iniciar galeria.');
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .update(updates)
    .eq('phone', normalizedPhone)
    .select('id');

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function isGallerySessionActive(phone: string, activeGalleryId: string) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !activeGalleryId) {
    return false;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .select('id')
    .eq('phone', normalizedPhone)
    .eq('conversation_state', 'sending_gallery')
    .eq('active_gallery_id', activeGalleryId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function persistGalleryProgress(phone: string, activeGalleryId: string, presentedProducts: WhatsAppPresentedProduct[]) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !activeGalleryId) {
    throw new Error('Dados invalidos para persistir progresso da galeria.');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const updates = {
    last_interaction_at: new Date().toISOString(),
    presented_products: presentedProducts
      .filter((item) => Number.isInteger(item.position) && item.position > 0 && Number.isInteger(item.productId) && item.productId > 0)
      .map((item) => ({ position: item.position, productId: item.productId })),
  };

  const { data, error } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .update(updates)
    .eq('phone', normalizedPhone)
    .eq('conversation_state', 'sending_gallery')
    .eq('active_gallery_id', activeGalleryId)
    .select('id');

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function finalizeGallerySession(phone: string, input: FinalizeGallerySessionInput) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone || !input.activeGalleryId) {
    throw new Error('Dados invalidos para finalizar galeria.');
  }

  const supabaseAdmin = getSupabaseAdmin();

  const updates = {
    awaiting_product_position: true,
    conversation_state: 'awaiting_photo_number' as const,
    last_interaction_at: new Date().toISOString(),
    photo_selection_expires_at: input.photoSelectionExpiresAt,
    presented_products: input.presentedProducts
      .filter((item) => Number.isInteger(item.position) && item.position > 0 && Number.isInteger(item.productId) && item.productId > 0)
      .map((item) => ({ position: item.position, productId: item.productId })),
  };

  const { data, error } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .update(updates)
    .eq('phone', normalizedPhone)
    .eq('conversation_state', 'sending_gallery')
    .eq('active_gallery_id', input.activeGalleryId)
    .select('id');

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}