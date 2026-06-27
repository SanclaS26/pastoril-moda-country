import Image from 'next/image';

type PastorilLoadingProps = {
  className?: string;
  layout?: 'contained' | 'fullscreen';
  message?: string;
  scope?: 'admin' | 'public';
};

export default function PastorilLoading({ className = '', layout = 'fullscreen', message = 'Carregando...', scope = 'public' }: PastorilLoadingProps) {
  const isAdmin = scope === 'admin';
  const shellClasses = layout === 'fullscreen'
    ? 'min-h-[100svh] w-full px-6 py-10'
    : 'min-h-[min(72svh,32rem)] w-full rounded-[28px] border border-[#E2D7CC] px-6 py-10 shadow-[0_10px_28px_rgba(74,45,26,0.045)] sm:px-8';

  const surfaceClasses = isAdmin
    ? 'bg-[#F9F6F1] text-[#241C17]'
    : 'bg-[radial-gradient(circle_at_top,rgba(255,250,244,0.98)_0%,rgba(247,240,231,0.96)_44%,rgba(239,231,219,0.98)_100%)] text-[#241C17]';

  const glowClasses = isAdmin
    ? 'bg-[radial-gradient(circle,rgba(200,114,44,0.18)_0%,rgba(200,114,44,0.06)_35%,transparent_72%)]'
    : 'bg-[radial-gradient(circle,rgba(200,114,44,0.16)_0%,rgba(200,114,44,0.06)_35%,transparent_72%)]';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={`relative isolate flex items-center justify-center overflow-hidden ${shellClasses} ${surfaceClasses} ${className}`.trim()}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.24)_0%,transparent_54%,rgba(36,28,23,0.02)_100%)]" aria-hidden="true" />
      <div className={`absolute left-1/2 top-1/2 h-[clamp(16rem,40vw,24rem)] w-[clamp(16rem,40vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${glowClasses}`} aria-hidden="true" />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <div className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-[#C9B5A5]/50 motion-reduce:animate-none motion-safe:animate-[spin_5.5s_linear_infinite]" aria-hidden="true" />
          <span className="absolute inset-2 rounded-full border border-[#C8722C]/20 motion-reduce:animate-none motion-safe:animate-[spin_8s_linear_infinite_reverse]" aria-hidden="true" />
          <span className="absolute inset-5 rounded-full bg-[#F7F0E7]/40 blur-xl motion-reduce:animate-none motion-safe:animate-[pastoril-loading-breathe_3.2s_ease-in-out_infinite]" aria-hidden="true" />
          <Image
            src="/brand/pastoril-logo-header.png"
            alt="Pastoril Moda Country"
            width={1536}
            height={1024}
            priority
            sizes="(min-width: 640px) 280px, 220px"
            className="relative z-10 h-auto w-[clamp(200px,26vw,280px)] object-contain motion-reduce:animate-none motion-safe:animate-[pastoril-loading-breathe_3.2s_ease-in-out_infinite]"
          />
        </div>

        <div className="space-y-1">
          <p className={`text-[10px] font-black uppercase tracking-[0.24em] ${isAdmin ? 'text-[#8B7768]' : 'text-[#8B7768]'}`}>Pastoril Moda Country</p>
          <p className={`text-sm ${isAdmin ? 'text-[#6E625A]' : 'text-[#6E625A]'}`}>{message}</p>
        </div>
      </div>
    </div>
  );
}