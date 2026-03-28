'use client';
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Input({
  label,
  error,
  hint,
  type = 'text',
  className = '',
  ...props
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-[var(--text-2)]">{label}</label>
      )}
      <div className="relative">
        <input
          type={inputType}
          className={[
            'w-full h-12 px-4 rounded-xl bg-[var(--card-2)] border text-white text-base',
            'placeholder:text-[var(--text-3)] outline-none transition-colors',
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)]'
              : 'border-[var(--border)] focus:border-[var(--accent)]',
            isPassword ? 'pr-12' : '',
          ].join(' ')}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] p-1"
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-3)]">{hint}</p>}
    </div>
  );
}
