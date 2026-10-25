/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trip } from '../types/trip';
import { generateTripPdf } from '../utils/pdfGenerator';
import {
  Download,
  FileText,
  FileCode,
  Printer,
  Check,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

interface TripExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onOpenPrintPreview: () => void;
}

export const TripExportModal: React.FC<TripExportModalProps> = ({
  isOpen,
  onClose,
  trip,
  onOpenPrintPreview,
}) => {
  const [downloadJsonSuccess, setDownloadJsonSuccess] = useState(false);
  const [downloadPdfSuccess, setDownloadPdfSuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  // JSON Export Handler
  const handleDownloadJson = () => {
    try {
      const exportData = JSON.stringify(
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          app: 'TJourney',
          trip,
        },
        null,
        2
      );
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const keyPart = trip.tripKey ? `${trip.tripKey}-` : '';
      const safeName = trip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.download = `trip-${keyPart}${safeName || 'data'}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadJsonSuccess(true);
      setTimeout(() => setDownloadJsonSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export JSON:', err);
    }
  };

  // PDF Export Handler
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateTripPdf(trip);
      setDownloadPdfSuccess(true);
      setTimeout(() => setDownloadPdfSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const transactionCount = (trip.transactions || []).length;
  const participantCount = (trip.participants || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#18181b] text-[#F8F7F4] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Export Trip</span>
                {trip.tripKey && (
                  <span className="text-xs font-mono font-medium text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                    #{trip.tripKey}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">Choose format to download or share</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Options Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Trip Summary Chip */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-400">
            <span className="truncate max-w-[200px] text-zinc-200 font-medium">{trip.name}</span>
            <div className="flex items-center gap-2 text-[11px]">
              <span>{participantCount} members</span>
              <span>·</span>
              <span>{transactionCount} transactions</span>
            </div>
          </div>

          {/* Option 1: PDF Document */}
          <div className="card p-4 hover:border-indigo-500/40 transition-colors space-y-3 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/25">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>PDF Report</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-normal">
                      .PDF
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Formatted document with member net balances, optimal debt settlement plan, and complete transaction ledger.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                {downloadPdfSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPrintPreview();
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/10 transition-colors cursor-pointer"
                title="Open paper print preview"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span>Preview & Print</span>
              </button>
            </div>
          </div>

          {/* Option 2: JSON Backup File */}
          <div className="card p-4 hover:border-indigo-500/40 transition-colors space-y-3 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/25">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>JSON Data File</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                      .JSON
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Complete raw backup of this trip. Can be archived locally or imported back into TJourney anytime.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/15 transition-colors cursor-pointer shadow-xs"
              >
                {downloadJsonSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>JSON Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download JSON Backup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero-Sum Verified Calculation</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
