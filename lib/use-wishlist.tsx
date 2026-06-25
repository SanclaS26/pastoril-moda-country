'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clienteSupabase } from '@/lib/supabase-cliente';

const WISHLIST_STORAGE_KEY = 'pastoril-wishlist-product-ids';

type WishlistContextValue = {
  error: string;
  favoriteIds: Set<number>;
  isLoading: boolean;
  pendingIds: Set<number>;
  toggleFavorite: (productId: number | string | bigint) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readLocalWishlist() {
  if (typeof window === 'undefined') return new Set<number>();

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(WISHLIST_STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is number => Number.isInteger(id) && id > 0)
        : [],
    );
  } catch {
    return new Set<number>();
  }
}

function writeLocalWishlist(ids: Set<number>) {
  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...ids]));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const synchronize = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const { data: sessionData } = await clienteSupabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setFavoriteIds(readLocalWishlist());
      setIsLoading(false);
      return;
    }

    const localIds = [...readLocalWishlist()];

    if (localIds.length > 0) {
      const { error: syncError } = await clienteSupabase
        .from('wishlist_items')
        .upsert(
          localIds.map((productId) => ({ product_id: productId, user_id: user.id })),
          { onConflict: 'user_id,product_id', ignoreDuplicates: true },
        );

      if (syncError) {
        setError('Não foi possível sincronizar seus favoritos locais.');
      } else {
        writeLocalWishlist(new Set());
      }
    }

    const { data, error: loadError } = await clienteSupabase
      .from('wishlist_items')
      .select('product_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError('Não foi possível carregar seus favoritos.');
      setFavoriteIds(new Set(localIds));
    } else {
      setFavoriteIds(new Set((data ?? []).map((item) => Number(item.product_id))));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void synchronize(), 0);
    const syncLocalStorage = () => void synchronize();
    const { data: listener } = clienteSupabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void synchronize(), 0);
    });

    window.addEventListener('storage', syncLocalStorage);

    return () => {
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
      window.removeEventListener('storage', syncLocalStorage);
    };
  }, [synchronize]);

  const normalizeProductId = useCallback((productId: number | string | bigint) => {
    const normalized = Number(productId);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined;
  }, []);

  const toggleFavorite = useCallback((productId: number | string | bigint) => {
    const normalizedId = normalizeProductId(productId);
    if (!normalizedId) return;

    setError('');
    setPendingIds((current) => {
      if (current.has(normalizedId)) return current;
      const next = new Set(current);
      next.add(normalizedId);
      return next;
    });

    setFavoriteIds((current) => {
      const wasFavorite = current.has(normalizedId);
      const next = new Set(current);
      if (wasFavorite) next.delete(normalizedId);
      else next.add(normalizedId);

      void (async () => {
        const { data: sessionData } = await clienteSupabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          writeLocalWishlist(next);
          setPendingIds((currentPending) => {
            const nextPending = new Set(currentPending);
            nextPending.delete(normalizedId);
            return nextPending;
          });
          return;
        }

        const result = wasFavorite
          ? await clienteSupabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', normalizedId)
          : await clienteSupabase.from('wishlist_items').insert({ product_id: normalizedId, user_id: user.id });

        if (result.error) {
          setFavoriteIds((currentRevert) => {
            const reverted = new Set(currentRevert);
            if (wasFavorite) reverted.add(normalizedId);
            else reverted.delete(normalizedId);
            return reverted;
          });
          setError('Não foi possível atualizar sua lista de desejos.');
        }

        setPendingIds((currentPending) => {
          const nextPending = new Set(currentPending);
          nextPending.delete(normalizedId);
          return nextPending;
        });
      })();

      return next;
    });
  }, [normalizeProductId]);

  const value = useMemo(
    () => ({ error, favoriteIds, isLoading, pendingIds, toggleFavorite }),
    [error, favoriteIds, isLoading, pendingIds, toggleFavorite],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist deve ser usado dentro de WishlistProvider.');
  return context;
}
