'use client';

type WishlistButtonProps = {
  className?: string;
  isFavorite: boolean;
  onToggle: () => void;
  productName: string;
};

export function WishlistButton({ className = '', isFavorite, onToggle, productName }: WishlistButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={`flex items-center justify-center rounded-full border border-[var(--pastoril-border)] bg-[var(--pastoril-card)]/95 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pastoril-caramel)] ${
        isFavorite ? 'text-[var(--pastoril-caramel)]' : 'text-[var(--pastoril-brown)]'
      } ${className}`}
      aria-label={isFavorite ? `Remover ${productName} dos favoritos` : `Adicionar ${productName} aos favoritos`}
      aria-pressed={isFavorite}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      </svg>
    </button>
  );
}
