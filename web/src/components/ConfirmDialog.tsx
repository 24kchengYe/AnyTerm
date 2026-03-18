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
          background: '#1f2335', borderRadius: 10, border: '1px solid #292d3e',
          padding: 20, width: 340, maxWidth: '85vw',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={20} color="#f7768e" />
          <h3 style={{ margin: 0, fontSize: 15, color: '#c0caf5' }}>{title}</h3>
        </div>
        <p style={{ fontSize: 13, color: '#a9b1d6', lineHeight: 1.6, margin: '0 0 18px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: '#292d3e', border: '1px solid #3b4261', color: '#a9b1d6',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: '#f7768e22', border: '1px solid #f7768e66', color: '#f7768e',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
