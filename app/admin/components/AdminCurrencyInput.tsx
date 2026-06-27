'use client';

import type { InputHTMLAttributes } from 'react';
import { formatAdminCurrency } from '@/lib/admin-currency';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function AdminCurrencyInput({ value, onValueChange, onBlur, inputMode = 'decimal', ...props }: Props) {
  return (
    <input
      {...props}
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onBlur={(event) => {
        onValueChange(formatAdminCurrency(event.target.value));
        onBlur?.(event);
      }}
    />
  );
}
