/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Participant, Transaction } from '../types/trip';
import { toCents } from '../engine/calculator';
import { MIN_DATE_INPUT, MAX_DATE_INPUT, sanitizeDateInput, getTodayLocalDate } from '../utils/date';
import { X, ArrowRight, Calendar, Clock } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transfer: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
  participants: Participant[];
  baseCurrency: string;
  defaultSenderId?: string;
  defaultReceiverId?: string;
  defaultAmountCents?: number;
  tripStartDate?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  baseCurrency,
  defaultSenderId,
  defaultReceiverId,
  defaultAmountCents,
  tripStartDate,
}) => {
  const [fromId, setFromId] = useState(
    defaultSenderId || participants[0]?.id || ''
  );
  const [toId, setToId] = useState(
    defaultReceiverId ||
      participants.find((p) => p.id !== fromId)?.id ||
      participants[1]?.id ||
      ''
  );
  const [amountStr, setAmountStr] = useState(
    defaultAmountCents ? (defaultAmountCents / 100).toFixed(2) : ''
  );
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(tripStartDate || getTodayLocalDate());

  useEffect(() => {
    if (isOpen) {
      setDate(tripStartDate || getTodayLocalDate());
    }
  }, [isOpen, tripStartDate]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromId === toId) {
      setError('Sender and receiver cannot be the same person.');
      return;
    }

    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      setError('Please enter a valid transfer amount.');
      return;
    }

    const totalAmountCents = toCents(amount);
    const sender = participants.find((p) => p.id === fromId)?.name || 'Participant';
    const receiver = participants.find((p) => p.id === toId)?.name || 'Participant';

    onSave({
      tripId: '',
      type: 'TRANSFER',
      title: `${sender} paid ${receiver} (Repayment)`,
      category: 'general',
      date,
      currency: baseCurrency,
      exchangeRateToBase: 1.0,
      originalAmount: amount,
      totalAmountCents,
      payers: [{ participantId: fromId, amountCents: totalAmountCents }],
      splitMethod: 'EXACT',
      splitShares: [{ participantId: toId, calculatedCents: totalAmountCents }],
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-md bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div>
            <h2 className="text-base font-semibold text-[#F8F7F4]">
              Record Direct Payment / Repayment
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">
              Track cash, UPI, or bank transfers sent during the trip
            </p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 pb-safe">
          {/* Transfer Parties */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Sender (Who paid)</label>
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full px-2.5 sm:px-3 py-2 text-xs bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#18181b] text-[#F8F7F4]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-6 text-zinc-500 shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Receiver (Who got it)</label>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full px-2.5 sm:px-3 py-2 text-xs bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#18181b] text-[#F8F7F4]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Amount ({baseCurrency})</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold font-mono text-[#F8F7F4] bg-white/[0.05] border border-white/15 rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Date</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDate(getTodayLocalDate())}
                  className={`text-[11px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    date === getTodayLocalDate()
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium'
                      : 'text-zinc-400 hover:text-indigo-300 hover:bg-white/[0.06]'
                  }`}
                  title="Set to today's date"
                >
                  <Clock className="w-3 h-3" />
                  <span>Today</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  ref={dateInputRef}
                  type="date"
                  min={MIN_DATE_INPUT}
                  max={MAX_DATE_INPUT}
                  required
                  value={date}
                  onChange={(e) => setDate(sanitizeDateInput(e.target.value))}
                  className="w-full pl-3 pr-10 py-2 text-xs sm:text-sm font-mono text-[#F8F7F4] bg-white/[0.05] border border-white/15 rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] cursor-pointer [color-scheme:dark]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (dateInputRef.current) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        try {
                          dateInputRef.current.showPicker();
                        } catch {
                          dateInputRef.current.focus();
                        }
                      } else {
                        dateInputRef.current.focus();
                      }
                    }
                  }}
                  className="absolute right-2 p-1.5 text-zinc-400 hover:text-indigo-400 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  title="Choose exact date from calendar"
                  aria-label="Open calendar picker"
                >
                  <Calendar className="w-4 h-4 text-indigo-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref / GPay for dinner"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs text-[#F8F7F4] bg-white/[0.05] border border-white/15 rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-500/30">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-mono font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 rounded-lg transition-colors min-h-[42px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors min-h-[42px] cursor-pointer"
            >
              Record Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
