import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import { X, Upload, FileJson, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [importText, setImportText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      setStatusMessage(null);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = () => {
    if (!importText.trim()) {
      setStatusMessage({ type: 'error', text: 'Please select a JSON file or paste JSON data to import.' });
      return;
    }

    const res = StorageService.importBackup(importText);
    if (res.success) {
      setStatusMessage({ type: 'success', text: `Successfully imported ${res.count} trip(s)!` });
      onDataChanged();
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Import failed. Invalid JSON structure.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-lg bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-[#F8F7F4]">Import JSON Backup</h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">Restore trips and expense records from a JSON file</p>
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
          {/* File Upload Box */}
          <div className="p-5 border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-xl text-center transition-colors bg-white/[0.02]">
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
              id="import-backup-file-upload"
            />
            <label
              htmlFor="import-backup-file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileJson className="w-8 h-8 text-indigo-400" />
              <span className="text-xs font-medium text-zinc-200">
                {fileName ? `Selected: ${fileName}` : 'Click to select JSON backup file'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Supports TJourney JSON exports
              </span>
            </label>
          </div>

          {/* Paste JSON */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Or Paste JSON Data</label>
            <textarea
              rows={4}
              placeholder='{"version": 2, "trips": [...]}'
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                if (statusMessage) setStatusMessage(null);
              }}
              className="w-full p-2.5 font-mono text-xs bg-white/[0.05] border border-white/15 rounded-lg text-[#F8F7F4] focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500"
            />
          </div>

          <button
            type="button"
            onClick={handleProcessImport}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-mono font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Verify & Import Backup</span>
          </button>

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
