import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useClienteAuth } from '@/app/components/ClienteAuthProvider';
import { TAMANHO_UNICO } from '@/config/grades-tamanho';
import { clienteSupabase } from '@/lib/supabase-cliente';
import {
  CART_STORAGE_KEY,
  type CartItem,
  type Product,
  getAvailableUniqueStock,
  getProductPrice,
  productUsesVisibleSize,
  readStoredCartItems,
  writeStoredCartItems,
} from '@/lib/catalog';

const CART_CODE_STORAGE_KEY = 'pastoril-cart-code';
const CART_SESSION_STORAGE_KEY = 'pastoril-cart-session';
const CART_UPDATED_STORAGE_KEY = 'pastoril-cart-updated-at';
const CART_EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000;

function getOrCreateStoredId(key: string, prefix: string) {
  if (typeof window === 'undefined') return '';

  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const next = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function getStoredId(key: string) {
  if (typeof window === 'undefined') return '';

  return window.localStorage.getItem(key) ?? '';
}

function resetRemoteCartIdentity() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(CART_CODE_STORAGE_KEY);
  window.localStorage.removeItem(CART_SESSION_STORAGE_KEY);
}

function resetStoredCartIdentity() {
  if (typeof window === 'undefined') return;

  resetRemoteCartIdentity();
  window.localStorage.removeItem(CART_UPDATED_STORAGE_KEY);
}

async function getClienteAuthToken() {
  const { data } = await clienteSupabase.auth.getSession();

  return data.session?.access_token;
}

async function deleteRemoteOpenCart(
  codigo: string,
  accessToken: string,
) {
  if (!codigo) return { ok: true };

  const response = await fetch('/api/vendas/carrinho', {
    body: JSON.stringify({
      codigo,
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    keepalive: true,
    method: 'DELETE',
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || 'Nao foi possivel encerrar o carrinho aberto.');
  }

  return response.json().catch(() => ({ ok: true }));
}

async function saveRemoteOpenCart(cartItems: CartItem[], token: string) {
  return fetch('/api/vendas/carrinho', {
    body: JSON.stringify({
      codigo: getOrCreateStoredId(CART_CODE_STORAGE_KEY, 'CAR'),
      items: cartItems.map(cartItemToVendaInput),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

function cartItemToVendaInput(item: CartItem) {
  const stockItem = productUsesVisibleSize(item)
    ? item.estoque.find((stock) => stock.tamanho === item.tamanhoSelecionado)
    : getAvailableUniqueStock(item);

  return {
    codigo_produto: item.codigo_produto,
    estoque_produto_id: stockItem?.id ?? null,
    nome: item.nome,
    produto_id: item.id,
    quantidade: item.quantity,
    tamanho: item.tamanhoSelecionado,
    valor_unitario: getProductPrice(item),
  };
}

export function usePublicCart() {
  const { isClienteLoggedIn, requireClienteForCheckout } = useClienteAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const previousTotalRef = useRef(0);
  const cartHydrationSeenRef = useRef(false);
  const hasHadCartItemsRef = useRef(false);
  const checkoutInFlightRef = useRef(false);
  const pendingOrderCodeRef = useRef('');
  const [badgeAnimating, setBadgeAnimating] = useState(false);
  const [checkoutObservations, setCheckoutObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsappFallbackUrl, setWhatsAppFallbackUrl] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedItems = readStoredCartItems();
      const storedUpdatedAt = Number(window.localStorage.getItem(CART_UPDATED_STORAGE_KEY) ?? '0');
      const isExpired = storedItems.length > 0 && storedUpdatedAt > 0 && Date.now() - storedUpdatedAt > CART_EXPIRATION_MS;

      if (isExpired) {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        resetStoredCartIdentity();
        setCartItems([]);
      } else {
        hasHadCartItemsRef.current = storedItems.length > 0;
        setCartItems(storedItems);
      }

      setCartHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;

    if (cartItems.length > 0) {
      writeStoredCartItems(cartItems);
      window.localStorage.setItem(CART_UPDATED_STORAGE_KEY, String(Date.now()));
    } else {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cartHydrated, cartItems]);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  useEffect(() => {
    if (!cartHydrated) {
      previousTotalRef.current = totalItems;
      return;
    }

    if (!cartHydrationSeenRef.current) {
      previousTotalRef.current = totalItems;
      cartHydrationSeenRef.current = true;
      return;
    }

    if (totalItems > previousTotalRef.current) {
      setBadgeAnimating(false);

      const frame = window.requestAnimationFrame(() => {
        setBadgeAnimating(true);
      });

      const timeout = window.setTimeout(() => {
        setBadgeAnimating(false);
      }, 450);

      previousTotalRef.current = totalItems;

      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }

    previousTotalRef.current = totalItems;
  }, [cartHydrated, totalItems]);

  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + getProductPrice(item) * item.quantity, 0),
    [cartItems],
  );

  useEffect(() => {
    if (!cartHydrated) return;
    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      if (!cartItems.length) {
        if (hasHadCartItemsRef.current) {
          if (isClienteLoggedIn) {
            const token = await getClienteAuthToken();
            if (!cancelled && token) {
              await deleteRemoteOpenCart(getStoredId(CART_CODE_STORAGE_KEY), token).catch(() => undefined);
            }
          }

          resetStoredCartIdentity();
          hasHadCartItemsRef.current = false;
        }

        return;
      }

      hasHadCartItemsRef.current = true;

      if (!isClienteLoggedIn) {
        resetRemoteCartIdentity();
        return;
      }

      const token = await getClienteAuthToken();

      if (cancelled || !token || readStoredCartItems().length === 0) return;

      await saveRemoteOpenCart(cartItems, token).catch(() => undefined);
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cartHydrated, cartItems, isClienteLoggedIn]);

  const addProductToCart = (product: Product, selectedSize: string, quantity = 1) => {
    const usesVisibleSize = productUsesVisibleSize(product);
    const size = usesVisibleSize ? selectedSize : TAMANHO_UNICO;
    const stockItem = usesVisibleSize
      ? product.estoque.find((item) => item.tamanho === size)
      : getAvailableUniqueStock(product);

    if (!stockItem || stockItem.quantidade <= 0) {
      return {
        ok: false,
        error: usesVisibleSize ? 'Selecione um tamanho disponivel antes de adicionar ao carrinho.' : 'Produto sem estoque disponivel.',
      };
    }

    const safeQuantity = Math.min(quantity, stockItem.quantidade);
    const existing = cartItems.find((item) => item.id === product.id && item.tamanhoSelecionado === size);

    if (existing && existing.quantity >= stockItem.quantidade) {
      return { ok: false, error: 'Quantidade maxima disponivel para este tamanho atingida.' };
    }

    setCartItems((current) => {
      const currentExisting = current.find((item) => item.id === product.id && item.tamanhoSelecionado === size);

      if (currentExisting) {
        return current.map((item) =>
          item.id === product.id && item.tamanhoSelecionado === size
            ? { ...item, quantity: Math.min(item.quantity + safeQuantity, stockItem.quantidade) }
            : item,
        );
      }

      return [...current, { ...product, tamanhoSelecionado: size, quantity: safeQuantity }];
    });

    return { ok: true, error: '' };
  };

  const updateCartQuantity = (productId: number, selectedSize: string, delta: number) => {
    setCartItems((current) =>
      current
        .map((item) => {
          if (item.id !== productId || item.tamanhoSelecionado !== selectedSize) {
            return item;
          }

          const stockItem = productUsesVisibleSize(item)
            ? item.estoque.find((stock) => stock.tamanho === selectedSize)
            : getAvailableUniqueStock(item);
          const maxQuantity = stockItem?.quantidade ?? item.quantity;
          return { ...item, quantity: Math.min(Math.max(item.quantity + delta, 0), maxQuantity) };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId: number, selectedSize: string) => {
    setCartItems((current) => current.filter((item) => item.id !== productId || item.tamanhoSelecionado !== selectedSize));
  };

  const clearCart = () => {
    const confirmed = window.confirm('Tem certeza que deseja remover todos os produtos do carrinho?');
    if (!confirmed) return false;

    setCartItems([]);
    return true;
  };

  const clearCartAfterOrder = async ({
    accessToken,
    cartCode,
  }: {
    accessToken: string;
    cartCode: string;
  }) => {
    await deleteRemoteOpenCart(cartCode, accessToken);

    window.localStorage.removeItem(CART_STORAGE_KEY);
    resetStoredCartIdentity();
    pendingOrderCodeRef.current = '';
    hasHadCartItemsRef.current = false;
    previousTotalRef.current = 0;
    flushSync(() => {
      setBadgeAnimating(false);
      setCheckoutObservations('');
      setWhatsAppFallbackUrl('');
      setCartItems([]);
      setIsCartOpen(false);
    });

  };

  const finalizeOnWhatsApp = async () => {
    if (!cartItems.length) return;
    if (checkoutInFlightRef.current) return;

    checkoutInFlightRef.current = true;
    setIsSubmitting(true);
    setWhatsAppFallbackUrl('');
    const checkoutItems = cartItems;
    const checkoutTotal = totalPrice;
    const checkoutObservationsSnapshot = checkoutObservations;
    let orderSaved = false;

    try {
      const session = await requireClienteForCheckout();
      if (!session) return;

      if (!session.access_token) {
        window.alert('Nao foi possivel confirmar o login do cliente. Tente entrar novamente.');
        return;
      }

      if (!pendingOrderCodeRef.current) {
        pendingOrderCodeRef.current = `PED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      }

      const response = await fetch('/api/vendas/whatsapp', {
        body: JSON.stringify({
          codigo: pendingOrderCodeRef.current,
          items: checkoutItems.map(cartItemToVendaInput),
          observacoes: checkoutObservationsSnapshot,
          total: checkoutTotal,
        }),
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok || !result?.whatsappUrl) {
        window.alert(result?.error || 'Nao foi possivel registrar o pedido antes do WhatsApp.');
        return;
      }

      orderSaved = true;
      const cartCode = getStoredId(CART_CODE_STORAGE_KEY);

      await clearCartAfterOrder({
        accessToken: session.access_token,
        cartCode,
      });

      const whatsappWindow = window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer');

      if (!whatsappWindow) {
        setWhatsAppFallbackUrl(result.whatsappUrl);
        setIsCartOpen(true);
      }
    } catch (error) {
      window.alert(
        orderSaved
          ? error instanceof Error
            ? `O pedido foi registrado, mas a limpeza do carrinho falhou: ${error.message}`
            : 'O pedido foi registrado, mas nao foi possivel limpar o carrinho.'
          : 'Nao foi possivel registrar o pedido. Verifique sua conexao e tente novamente.',
      );
    } finally {
      checkoutInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const openWhatsAppFallback = () => {
    if (!whatsappFallbackUrl) return;

    const url = whatsappFallbackUrl;

    setWhatsAppFallbackUrl('');
    window.location.assign(url);
  };

  return {
    addProductToCart,
    badgeAnimating,
    cartItems,
    checkoutObservations,
    clearCart,
    finalizeOnWhatsApp,
    isCartOpen,
    isSubmitting,
    openWhatsAppFallback,
    removeFromCart,
    setCheckoutObservations,
    setIsCartOpen,
    totalItems,
    totalPrice,
    updateCartQuantity,
    whatsappFallbackUrl,
  };
}
