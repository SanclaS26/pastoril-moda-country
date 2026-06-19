import type {
  ClienteRow,
  VendaInsert,
  VendaItemInsert,
  VendaItemRow,
  VendaRow,
  VendaStatus,
} from '@/lib/supabase-admin';

export const WHATSAPP_STORE_PHONE = '5568999244811';

export type PublicVendaItemInput = {
  produto_id: number;
  estoque_produto_id?: number | null;
  codigo_produto: string;
  nome: string;
  tamanho: string;
  quantidade: number;
  valor_unitario: number;
};

export type VendaWithItems = VendaRow & {
  itens: VendaItemRow[];
};

export function generateVendaCode(prefix: 'CAR' | 'PED') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `${prefix}-${timestamp}-${random}`;
}

export function calculateVendaTotal(items: Pick<PublicVendaItemInput, 'quantidade' | 'valor_unitario'>[]) {
  return items.reduce((total, item) => total + item.quantidade * item.valor_unitario, 0);
}

export function createVendaPayload({
  cliente,
  codigo,
  items,
  sessionId,
  tipo,
}: {
  cliente: ClienteRow | null;
  codigo: string;
  items: PublicVendaItemInput[];
  sessionId: string | null;
  tipo: 'carrinho' | 'pedido_whatsapp';
}): VendaInsert {
  return {
    cliente_auth_user_id: cliente?.auth_user_id ?? null,
    cliente_celular: cliente?.celular ?? null,
    cliente_cpf: cliente?.cpf ?? null,
    cliente_nome: cliente?.nome ?? null,
    codigo,
    estoque_baixado: false,
    observacoes_admin: null,
    session_id: sessionId,
    status: 'em_aberto',
    telefone_whatsapp: cliente?.celular ?? null,
    tipo,
    total_final: null,
    total_original: calculateVendaTotal(items),
    whatsapp_enviado_em: tipo === 'pedido_whatsapp' ? new Date().toISOString() : null,
  };
}

export function createVendaItemPayload(vendaId: string, item: PublicVendaItemInput): VendaItemInsert {
  return {
    codigo_produto: item.codigo_produto,
    estoque_produto_id: item.estoque_produto_id ?? null,
    nome: item.nome,
    produto_id: item.produto_id,
    quantidade_final: item.quantidade,
    quantidade_original: item.quantidade,
    tamanho: item.tamanho,
    valor_unitario_final: item.valor_unitario,
    valor_unitario_original: item.valor_unitario,
    venda_id: vendaId,
  };
}

export function normalizeVendaStatus(value: string | null): VendaStatus | null {
  if (value === 'em_aberto' || value === 'concluida' || value === 'cancelada') {
    return value;
  }

  return null;
}
