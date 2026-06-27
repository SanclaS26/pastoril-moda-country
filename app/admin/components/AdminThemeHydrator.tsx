'use client';

import { useLayoutEffect } from 'react';

export default function AdminThemeHydrator() {
  useLayoutEffect(() => {
    const root = document.getElementById('admin-theme-root');
    if (!root) return;

    let theme = root.classList.contains('admin-theme-dark') ? 'dark' : 'light';
    try {
      theme = window.localStorage.getItem('pastoril-admin-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      // Mantém a classe aplicada pelo script inicial.
    }

    root.classList.remove('admin-theme-light', 'admin-theme-dark');
    root.classList.add(`admin-theme-${theme}`);
  }, []);

  return null;
}
