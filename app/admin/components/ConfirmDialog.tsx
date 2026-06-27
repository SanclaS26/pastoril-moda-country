'use client';

import type { ReactNode } from 'react';

type ConfirmDialogProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: 'danger' | 'neutral';
  title: string;
};

export default function ConfirmDialog({
  cancelLabel = 'Cancelar',
  children,
  confirmLabel = 'Confirmar',
  loading = false,
  message,
  onCancel,
  onConfirm,
  tone = 'neutral',
  title,
}: ConfirmDialogProps) {
  const confirmClass = tone === 'danger'
    ? 'bg-rose-700 text-white hover:bg-rose-800'
    : 'bg-[#4A2D1A] text-white hover:bg-[#2F1B10]';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#241C17]/60 px-4 py-6">
      <section className="admin-modal-surface w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-[color:var(--admin-text)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--admin-muted)]">{message}</p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="admin-table-action-secondary rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
