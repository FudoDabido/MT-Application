'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-[var(--accent)] text-black font-semibold active:opacity-80',
  secondary: 'bg-[var(--card-2)] text-white border border-[var(--border)] active:opacity-70',
  ghost: 'bg-transparent text-[var(--text-2)] active:bg-[var(--card)]',
  danger: 'bg-[var(--danger)] text-white font-semibold active:opacity-80',
};

const sizes = {
  sm: 'h-9 px-4 text-sm rounded-xl',
  md: 'h-12 px-5 text-base rounded-xl',
  lg: 'h-14 px-6 text-lg rounded-2xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 transition-all select-none',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        disabled || loading ? 'opacity-40 cursor-not-allowed' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
