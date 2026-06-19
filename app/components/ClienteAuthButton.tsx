'use client';

import { useClienteAuth } from '@/app/components/ClienteAuthProvider';

type ClienteAuthButtonProps = {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
};

export function ClienteAuthIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.45}
      vectorEffect="non-scaling-stroke"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.4 19.2a6.6 6.6 0 0 1 13.2 0" />
    </svg>
  );
}

export function ClienteAuthButton({
  className = '',
  iconClassName = 'h-6 w-6',
  labelClassName = '',
  showLabel = false,
}: ClienteAuthButtonProps) {
  const { isClienteLoggedIn, openClienteAuth } = useClienteAuth();
  const label = isClienteLoggedIn ? 'Abrir Minha conta do cliente conectado' : 'Entrar como cliente';

  return (
    <button
      type="button"
      onClick={openClienteAuth}
      className={`relative ${className}`}
      aria-label={label}
      aria-pressed={isClienteLoggedIn}
    >
      <span className="relative inline-flex items-center justify-center">
        <ClienteAuthIcon className={iconClassName} />
        {isClienteLoggedIn && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-current bg-emerald-500"
            aria-hidden="true"
          />
        )}
      </span>
      {showLabel && <span className={labelClassName}>Minha conta</span>}
    </button>
  );
}
