import type { VendaRow } from '@/lib/supabase-admin';

export const OPEN_STATUS = 'em_aberto' as const;
export const COMPLETED_STATUS = 'concluida' as const;
export const CART_TYPE = 'carrinho' as const;
export const ORDER_TYPE = 'pedido_whatsapp' as const;

export function isOpenCart(venda: Pick<VendaRow, 'status' | 'tipo' | 'whatsapp_enviado_em'>) {
  return venda.tipo === CART_TYPE && venda.status === OPEN_STATUS && venda.whatsapp_enviado_em === null;
}

export function isOpenOrder(venda: Pick<VendaRow, 'status' | 'tipo'>) {
  return venda.tipo === ORDER_TYPE && venda.status === OPEN_STATUS;
}

export function isCompletedSale(venda: Pick<VendaRow, 'status'>) {
  return venda.status === COMPLETED_STATUS;
}

export function getVendaValue(venda: Pick<VendaRow, 'total_final' | 'total_original'>) {
  return venda.total_final ?? venda.total_original;
}
