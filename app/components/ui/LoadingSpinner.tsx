'use client';

type LoadingSpinnerProps = {
  className?: string;
  size?: 'sm' | 'md';
};

export default function LoadingSpinner({ className = '', size = 'sm' }: LoadingSpinnerProps) {
  const sizeClasses = size === 'md' ? 'h-4.5 w-4.5' : 'h-4 w-4';

  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full border-[1.5px] border-current border-r-transparent motion-reduce:animate-none motion-safe:animate-spin ${sizeClasses} ${className}`.trim()}
    />
  );
}