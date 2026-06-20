'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { clienteSupabase } from '@/lib/supabase-cliente';

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
    if (!shouldTrackPath(pathname)) return;
    let active = true;

    const track = (session: Session | null) => {
      if (!active) return;
      const identity = session?.user.id ?? 'anonymous';
      const dateKey = new Date().toISOString().slice(0, 10);
      const storageKey = `pastoril_visit_tracked:${identity}:${dateKey}`;

      try {
        if (window.sessionStorage.getItem(storageKey)) return;
        window.sessionStorage.setItem(storageKey, 'pending');
      } catch {
        // The database remains the definitive deduplication layer.
      }

      void fetch('/api/visits', {
        body: JSON.stringify({ pathname }),
        cache: 'no-store',
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          'Content-Type': 'application/json',
        },
        keepalive: true,
        method: 'POST',
      }).then((response) => {
        if (!response.ok) window.sessionStorage.removeItem(storageKey);
        else window.sessionStorage.setItem(storageKey, 'done');
      }).catch(() => {
        try { window.sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      });
    };

    void clienteSupabase.auth.getSession().then(({ data }) => track(data.session));
    const { data: listener } = clienteSupabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => track(session), 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}
