import { getSupabaseAdmin, type WhatsAppAtendimentoSessaoRow, type WhatsAppPresentedProduct } from '@/lib/supabase-admin';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type WhatsAppSessionState = {
  awaitingProductPosition: boolean;
  isNewSession: boolean;
  lastCategory: string | null;
  phone: string;
  presentedProducts: WhatsAppPresentedProduct[];
  siteNoticeSent: boolean;
};

export type UpdateWhatsAppSessionInput = {
  awaitingProductPosition?: boolean;
  lastCategory?: string | null;
  presentedProducts?: WhatsAppPresentedProduct[];
  siteNoticeSent?: boolean;
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
    awaitingProductPosition: row.awaiting_product_position,
    isNewSession,
    lastCategory: row.last_category,
    phone: row.phone,
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
    .select('id, phone, session_started_at, last_interaction_at, site_notice_sent, awaiting_product_position, last_category, presented_products, created_at, updated_at')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (error) {
    throw new Error('Falha ao consultar sessao do WhatsApp.');
  }

  const nowIso = new Date().toISOString();

  if (!data) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('whatsapp_atendimento_sessoes')
      .insert({
        awaiting_product_position: false,
        last_category: null,
        last_interaction_at: nowIso,
        phone: normalizedPhone,
        presented_products: [],
        session_started_at: nowIso,
        site_notice_sent: false,
      })
      .select('id, phone, session_started_at, last_interaction_at, site_notice_sent, awaiting_product_position, last_category, presented_products, created_at, updated_at')
      .single();

    if (insertError) {
      throw new Error('Falha ao criar sessao do WhatsApp.');
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
        last_category: null,
        last_interaction_at: nowIso,
        presented_products: [],
        session_started_at: nowIso,
        site_notice_sent: false,
      })
      .eq('id', data.id)
      .select('id, phone, session_started_at, last_interaction_at, site_notice_sent, awaiting_product_position, last_category, presented_products, created_at, updated_at')
      .single();

    if (resetError) {
      throw new Error('Falha ao renovar sessao do WhatsApp.');
    }

    return mapSession(resetSession, true);
  }

  const { data: touched, error: touchError } = await supabaseAdmin
    .from('whatsapp_atendimento_sessoes')
    .update({ last_interaction_at: nowIso })
    .eq('id', data.id)
    .select('id, phone, session_started_at, last_interaction_at, site_notice_sent, awaiting_product_position, last_category, presented_products, created_at, updated_at')
    .single();

  if (touchError) {
    throw new Error('Falha ao atualizar sessao do WhatsApp.');
  }

  return mapSession(touched, false);
}

export async function updateWhatsAppSession(phone: string, input: UpdateWhatsAppSessionInput) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error('Telefone invalido para atualizar sessao WhatsApp.');
  }

  const updates: {
    awaiting_product_position?: boolean;
    last_category?: string | null;
    last_interaction_at: string;
    presented_products?: WhatsAppPresentedProduct[];
    site_notice_sent?: boolean;
  } = {
    last_interaction_at: new Date().toISOString(),
  };

  if (typeof input.awaitingProductPosition === 'boolean') {
    updates.awaiting_product_position = input.awaitingProductPosition;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'lastCategory')) {
    updates.last_category = input.lastCategory ?? null;
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
    throw new Error('Falha ao atualizar estado da sessao do WhatsApp.');
  }
}