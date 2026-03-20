import React from 'react';

export default function Modal({ children, onClose, closeable = true }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4 relative">
        {closeable && onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
        )}
        {children}
      </div>
    </div>
  );
}
