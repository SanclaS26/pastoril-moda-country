'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

function shouldTrackPath(pathname: string | null) {
  return Boolean(
    pathname &&
      pathname.startsWith('/') &&
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/api/') &&
      !pathname.startsWith('/_next/'),
  );
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldTrackPath(pathname)) {
      return;
    }

    const storageKey = `pastoril_visit_tracked:${pathname}`;
    const now = Date.now();

    try {
      const lastTracked = Number(window.sessionStorage.getItem(storageKey) ?? 0);

      if (lastTracked && now - lastTracked < DEDUPE_WINDOW_MS) {
        return;
      }

      window.sessionStorage.setItem(storageKey, String(now));
    } catch {
      // Storage can be unavailable in restricted browsing modes; tracking must never block the page.
    }

    void fetch('/api/visits', {
      body: JSON.stringify({ pathname }),
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      keepalive: true,
      method: 'POST',
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
