import Image from 'next/image';

type PastorilLoadingProps = {
  className?: string;
  fullscreen?: boolean;
  inline?: boolean;
  label?: string;
  size?: 'small' | 'medium';
  scope?: 'admin' | 'public';
};

export default function PastorilLoading({ className = '', fullscreen = true, inline = false, label = 'Carregando', size = 'small', scope = 'public' }: PastorilLoadingProps) {
  const isAdmin = scope === 'admin';
  const shellClasses = inline
    ? 'inline-flex w-auto items-center justify-center px-0 py-0'
    : fullscreen
      ? 'flex min-h-[100svh] w-full items-center justify-center px-4 py-6 sm:px-6'
      : 'flex min-h-[min(48svh,24rem)] w-full items-center justify-center px-4 py-6 sm:px-6';

  const surfaceClasses = isAdmin
    ? 'bg-[color:var(--admin-bg)] text-[color:var(--admin-text)]'
    : 'bg-[color:var(--background)] text-[color:var(--text)]';

  const logoSizeClasses = size === 'medium' ? 'h-14 w-14' : 'h-12 w-12';
  const ringSizeClasses = size === 'medium' ? 'h-16 w-16' : 'h-[3.5rem] w-[3.5rem]';

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={`relative isolate ${shellClasses} ${surfaceClasses} ${className}`.trim()}
    >
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden="true"
          className={`absolute rounded-full border border-current/15 motion-reduce:animate-none motion-safe:animate-[spin_12s_linear_infinite] ${ringSizeClasses}`}
        />
        <span
          aria-hidden="true"
          className={`absolute rounded-full border border-current/8 motion-reduce:animate-none motion-safe:animate-[pastoril-loading-breathe_4.8s_ease-in-out_infinite] ${ringSizeClasses}`}
        />
        <Image
          src="/brand/pastoril-logo-cropped.png"
          alt=""
          width={56}
          height={56}
          priority={fullscreen}
          sizes="56px"
          className={`relative z-10 object-contain motion-reduce:animate-none motion-safe:animate-[pastoril-loading-breathe_4.8s_ease-in-out_infinite] ${logoSizeClasses}`}
        />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}