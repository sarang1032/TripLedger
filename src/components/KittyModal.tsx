/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ExpenseCategory, Participant, Transaction } from '../types/trip';
import { calculateEqualShares, formatMoney, KITTY_ID, toCents } from '../engine/calculator';
import { CATEGORY_LABELS } from '../utils/constants';
import { MIN_DATE_INPUT, MAX_DATE_INPUT, sanitizeDateInput, getTodayLocalDate } from '../utils/date';
import { X, PiggyBank, ArrowDownRight, ArrowUpRight, RotateCcw, Calendar, Clock } from 'lucide-react';

interface KittyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
  participants: Participant[];
  baseCurrency: string;
  currentKittyBalanceCents: number;
  tripStartDate?: string;
}

export const KittyModal: React.FC<KittyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  baseCurrency,
  currentKittyBalanceCents,
  tripStartDate,
}) => {
  const [mode, setMode] = useState<'DEPOSIT' | 'EXPENSE' | 'PAYOUT'>('DEPOSIT');
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(tripStartDate || getTodayLocalDate());

  useEffect(() => {
    if (isOpen) {
      setDate(tripStartDate || getTodayLocalDate());
    }
  }, [isOpen, tripStartDate]);
  const [depositorId, setDepositorId] = useState(participants[0]?.id || '');
  const [category, setCategory] = useState<ExpenseCategory>('general');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    participants.map((p) => p.id)
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      setError('Please specify a positive dollar amount.');
      return;
    }

    const totalAmountCents = toCents(amount);

    if (mode === 'DEPOSIT') {
      const depositor = participants.find((p) => p.id === depositorId);
      onSave({
        tripId: '',
        type: 'KITTY_DEPOSIT',
        title: title.trim() || `${depositor?.name || 'Member'} cash deposit to Kitty`,
        category: 'general',
        date,
        currency: baseCurrency,
        exchangeRateToBase: 1.0,
        originalAmount: amount,
        totalAmountCents,
        payers: [{ participantId: depositorId, amountCents: totalAmountCents }],
        splitMethod: 'EQUAL',
        splitShares: [],
        notes: notes.trim() || undefined,
      });
    } else if (mode === 'EXPENSE') {
      if (selectedParticipants.length === 0) {
        setError('Please select at least one person who benefited from this Kitty expense.');
        return;
      }
      const shares = calculateEqualShares(totalAmountCents, selectedParticipants);
      onSave({
        tripId: '',
        type: 'KITTY_EXPENSE',
        title: title.trim() || 'Expense paid from Common Kitty',
        category,
        date,
        currency: baseCurrency,
        exchangeRateToBase: 1.0,
        originalAmount: amount,
        totalAmountCents,
        payers: [{ participantId: KITTY_ID, amountCents: totalAmountCents }],
        splitMethod: 'EQUAL',
        splitShares: shares,
        notes: notes.trim() || undefined,
      });
    } else if (mode === 'PAYOUT') {
      // Refund remaining cash in kitty to members
      if (selectedParticipants.length === 0) {
        setError('Please select who receives the payout.');
        return;
      }
      const shares = calculateEqualShares(totalAmountCents, selectedParticipants);
      onSave({
        tripId: '',
        type: 'KITTY_PAYOUT',
        title: title.trim() || 'Kitty Leftover Cash Payout',
        category: 'general',
        date,
        currency: baseCurrency,
        exchangeRateToBase: 1.0,
        originalAmount: amount,
        totalAmountCents,
        payers: [{ participantId: KITTY_ID, amountCents: totalAmountCents }],
        splitMethod: 'EQUAL',
        splitShares: shares,
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-md bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold text-[#F8F7F4]">Common Fund (Kitty)</h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Shared cash pool for group incidental expenses
              </p>
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

        {/* Current Kitty Status Card */}
        <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs">
          <span className="text-emerald-400 font-mono">CURRENT POOL BALANCE:</span>
          <span className="text-base font-bold font-mono text-emerald-300">
            {formatMoney(currentKittyBalanceCents, baseCurrency)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-safe">
          {/* Action Mode Toggle */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] border border-white/10 rounded-lg text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('DEPOSIT');
                setTitle('Cash deposit to Kitty');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 sm:py-1.5 rounded-md transition-colors min-h-[38px] cursor-pointer ${
                mode === 'DEPOSIT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('EXPENSE');
                setTitle('Paid from Kitty');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 sm:py-1.5 rounded-md transition-colors min-h-[38px] cursor-pointer ${
                mode === 'EXPENSE'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Spend</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('PAYOUT');
                setTitle('Refund leftover kitty cash');
                if (currentKittyBalanceCents > 0) {
                  setAmountStr((currentKittyBalanceCents / 100).toFixed(2));
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-2 sm:py-1.5 rounded-md transition-colors min-h-[38px] cursor-pointer ${
                mode === 'PAYOUT'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Payout</span>
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Description</label>
            <input
              type="text"
              required
              placeholder={
                mode === 'DEPOSIT'
                  ? 'e.g. Alice cash contribution'
                  : mode === 'EXPENSE'
                  ? 'e.g. Highway toll, Museum pass'
                  : 'e.g. Return leftover funds'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs text-[#F8F7F4] bg-white/[0.05] border border-white/15 rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
            />
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

          {/* Depositor if DEPOSIT mode */}
          {mode === 'DEPOSIT' && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Contributing Member</label>
              <select
                value={depositorId}
                onChange={(e) => setDepositorId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#18181b] text-[#F8F7F4]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category if EXPENSE mode */}
          {mode === 'EXPENSE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Expense Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-xs bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, item]) => (
                  <option key={k} value={k} className="bg-[#18181b] text-[#F8F7F4]">
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Beneficiaries if EXPENSE or PAYOUT */}
          {(mode === 'EXPENSE' || mode === 'PAYOUT') && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                {mode === 'EXPENSE' ? 'Benefiting Members' : 'Recipients'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {participants.map((p) => {
                  const isChecked = selectedParticipants.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedParticipants(
                            selectedParticipants.filter((id) => id !== p.id)
                          );
                        } else {
                          setSelectedParticipants([...selectedParticipants, p.id]);
                        }
                      }}
                      className={`flex items-center gap-2 p-2 text-xs rounded-lg border transition-colors min-h-[38px] cursor-pointer ${
                        isChecked
                          ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                          : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.avatarColor }}
                      />
                      <span className="truncate font-medium">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Cash in envelope #2"
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
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors min-h-[42px] cursor-pointer"
            >
              Save Kitty Action
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
