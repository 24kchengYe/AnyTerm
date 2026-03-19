/**
 * Confirm dialog — modal overlay for destructive actions.
 */
import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title, message, onConfirm, onCancel,
  confirmLabel = 'Close', cancelLabel = 'Cancel',
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on mount, close on Escape
  useEffect(() => {
    cancelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#141414', borderRadius: 10, border: '1px solid #2a2a2a',
          padding: 20, width: 340, maxWidth: '85vw',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={20} color="#ff5555" />
          <h3 style={{ margin: 0, fontSize: 15, color: '#f0f0f0' }}>{title}</h3>
        </div>
        <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, margin: '0 0 18px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: '#2a2a2a', border: '1px solid #444', color: '#ccc',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: '#ff555522', border: '1px solid #ff555566', color: '#ff5555',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
