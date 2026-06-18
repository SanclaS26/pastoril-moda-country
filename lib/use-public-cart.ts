import { useEffect, useMemo, useRef, useState } from 'react';
import { TAMANHO_UNICO } from '@/config/grades-tamanho';
import {
  type CartItem,
  type Product,
  formatCurrency,
  getAvailableUniqueStock,
  getProductPrice,
  productUsesVisibleSize,
  readStoredCartItems,
  writeStoredCartItems,
} from '@/lib/catalog';

export function usePublicCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const previousTotalRef = useRef(0);
  const cartHydrationSeenRef = useRef(false);
  const [badgeAnimating, setBadgeAnimating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCartItems(readStoredCartItems());
      setCartHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cartHydrated) {
      writeStoredCartItems(cartItems);
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

  const whatsappMessage = encodeURIComponent(
    `Olá, gostaria de fazer um pedido na Pastoril Moda Country.${cartItems.length ? '\n' : ''}${cartItems
      .map((item) => {
        const tamanho = productUsesVisibleSize(item) ? ` tamanho ${item.tamanhoSelecionado}` : '';
        return `${item.quantity}x ${item.nome} (${item.codigo_produto})${tamanho} - ${formatCurrency(getProductPrice(item))}`;
      })
      .join('\n')}${cartItems.length ? `\nTotal: ${formatCurrency(totalPrice)}` : ''}`,
  );

  const addProductToCart = (product: Product, selectedSize: string, quantity = 1) => {
    const usesVisibleSize = productUsesVisibleSize(product);
    const size = usesVisibleSize ? selectedSize : TAMANHO_UNICO;
    const stockItem = usesVisibleSize
      ? product.estoque.find((item) => item.tamanho === size)
      : getAvailableUniqueStock(product);

    if (!stockItem || stockItem.quantidade <= 0) {
      return {
        ok: false,
        error: usesVisibleSize ? 'Selecione um tamanho disponível antes de adicionar ao carrinho.' : 'Produto sem estoque disponível.',
      };
    }

    const safeQuantity = Math.min(quantity, stockItem.quantidade);
    const existing = cartItems.find((item) => item.id === product.id && item.tamanhoSelecionado === size);

    if (existing && existing.quantity >= stockItem.quantidade) {
      return { ok: false, error: 'Quantidade máxima disponível para este tamanho atingida.' };
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

  return {
    addProductToCart,
    badgeAnimating,
    cartItems,
    clearCart,
    isCartOpen,
    removeFromCart,
    setIsCartOpen,
    totalItems,
    totalPrice,
    updateCartQuantity,
    whatsappMessage,
  };
}
