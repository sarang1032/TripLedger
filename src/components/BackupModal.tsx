/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { X, Download, Copy, Check, FileJson, AlertCircle } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [statusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const exportData = StorageService.exportBackup();

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tjourney-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-lg bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-[#F8F7F4]">Backup & Data Export</h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">Offline JSON persistence of your trips</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-safe">
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed font-mono">
              Export all your manual entries, participants, transactions, kitty funds, and
              settlement records into an offline JSON backup file.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadExport}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-mono font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .json Backup</span>
              </button>
              <button
                type="button"
                onClick={handleCopyExport}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-mono font-medium text-zinc-300 hover:text-white bg-white/[0.05] border border-white/15 hover:bg-white/[0.1] rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>

            <textarea
              readOnly
              value={exportData}
              rows={8}
              className="w-full p-2.5 font-mono text-[11px] bg-white/[0.04] border border-white/15 rounded-lg text-zinc-300 select-all focus:outline-none"
            />
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 border font-mono ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
