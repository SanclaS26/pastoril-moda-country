'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clienteSupabase } from '@/lib/supabase-cliente';

const WISHLIST_STORAGE_KEY = 'pastoril-wishlist-product-ids';

type WishlistContextValue = {
  error: string;
  favoriteIds: Set<number>;
  isLoading: boolean;
  toggleFavorite: (productId: number) => void;
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

  const toggleFavorite = useCallback((productId: number) => {
    if (!Number.isInteger(productId) || productId <= 0) return;

    setError('');
    setFavoriteIds((current) => {
      const wasFavorite = current.has(productId);
      const next = new Set(current);
      if (wasFavorite) next.delete(productId);
      else next.add(productId);

      void (async () => {
        const { data: sessionData } = await clienteSupabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          writeLocalWishlist(next);
          return;
        }

        const result = wasFavorite
          ? await clienteSupabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', productId)
          : await clienteSupabase.from('wishlist_items').insert({ product_id: productId, user_id: user.id });

        if (result.error) {
          setFavoriteIds(current);
          setError('Não foi possível atualizar sua lista de desejos.');
        }
      })();

      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ error, favoriteIds, isLoading, toggleFavorite }),
    [error, favoriteIds, isLoading, toggleFavorite],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist deve ser usado dentro de WishlistProvider.');
  return context;
}
