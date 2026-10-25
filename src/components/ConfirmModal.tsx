import React from 'react';
import { AlertTriangle, Trash2, AlertCircle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isAlertOnly?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  isAlertOnly = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md bg-[#18181b] text-[#F8F7F4] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              variant === 'danger'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : variant === 'warning'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}
          >
            {variant === 'danger' ? (
              <Trash2 className="w-5 h-5" />
            ) : variant === 'warning' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-semibold text-[#F8F7F4] leading-tight">
              {title}
            </h3>
            <div className="text-sm text-zinc-300 mt-2 leading-relaxed">
              {message}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors -mr-2 -mt-2 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
          {!isAlertOnly && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors shadow-sm cursor-pointer ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isAlertOnly ? 'Understood' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
