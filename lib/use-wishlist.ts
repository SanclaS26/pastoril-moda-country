'use client';

import { useCallback, useEffect, useState } from 'react';

const WISHLIST_STORAGE_KEY = 'pastoril-wishlist-product-ids';

function readWishlist() {
  if (typeof window === 'undefined') return new Set<number>();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(WISHLIST_STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is number => Number.isInteger(id) && id > 0)
        : [],
    );
  } catch {
    return new Set<number>();
  }
}

export function useWishlist() {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timeout = window.setTimeout(() => setFavoriteIds(readWishlist()), 0);
    const syncWishlist = () => setFavoriteIds(readWishlist());

    window.addEventListener('storage', syncWishlist);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('storage', syncWishlist);
    };
  }, []);

  const toggleFavorite = useCallback((productId: number) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favoriteIds, toggleFavorite };
}
