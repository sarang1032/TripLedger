/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Trip } from '../types/trip';
import { SUPPORTED_CURRENCIES } from '../utils/constants';
import { MIN_DATE_INPUT, MAX_DATE_INPUT, sanitizeDateInput, getTodayLocalDate } from '../utils/date';
import { getTripTimerStatus } from '../utils/tripTimer';
import { X, MapPin, Clock, Calendar } from 'lucide-react';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tripData: { name: string; description?: string; baseCurrency: string; startDate?: string; endDate?: string }) => void;
  initialData?: Trip | null;
}

export const TripModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [baseCurrency, setBaseCurrency] = useState(initialData?.baseCurrency || 'INR');
  // Pre-fill current (today) date when creating or editing a new trip
  const [startDate, setStartDate] = useState(initialData?.startDate || getTodayLocalDate());
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [error, setError] = useState<string | null>(null);

  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setBaseCurrency(initialData?.baseCurrency || 'INR');
      // Current (today) date pre-filled when creating new trip or if trip has no date set
      setStartDate(initialData?.startDate || getTodayLocalDate());
      setEndDate(initialData?.endDate || '');
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Trip name is required.');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      baseCurrency,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-md bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-[#F8F7F4]">
                {initialData ? 'Trip Settings' : 'Create New Trip'}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">Trip title, base currency, and dates</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-safe">
          {initialData?.tripKey ? (
            <div className="flex items-center justify-between px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs font-mono">
              <span className="text-zinc-400">Unique Trip Key:</span>
              <span className="text-indigo-300 font-bold font-mono text-sm">#{initialData.tripKey}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-[11px] font-mono text-zinc-400">
              <span className="text-indigo-400">Key:</span>
              <span>A unique 6-digit number (100000–999999) will be assigned automatically.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Trip Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Goa Beach Trip, Manali Road Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Base Currency</label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#18181b] text-[#F8F7F4]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Start Date</span>
                </label>
                <button
                  type="button"
                  onClick={() => setStartDate(getTodayLocalDate())}
                  className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="Set start date to today"
                >
                  <Clock className="w-3 h-3" />
                  <span>Today</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  ref={startDateInputRef}
                  type="date"
                  min={MIN_DATE_INPUT}
                  max={MAX_DATE_INPUT}
                  value={startDate}
                  onChange={(e) => setStartDate(sanitizeDateInput(e.target.value))}
                  className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] cursor-pointer [color-scheme:dark]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (startDateInputRef.current) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        try {
                          startDateInputRef.current.showPicker();
                        } catch {
                          startDateInputRef.current.focus();
                        }
                      } else {
                        startDateInputRef.current.focus();
                      }
                    }
                  }}
                  className="absolute right-2 p-1.5 text-zinc-400 hover:text-indigo-400 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  title="Choose exact start date from calendar"
                  aria-label="Open start date calendar"
                >
                  <Calendar className="w-4 h-4 text-indigo-400" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>End Date</span>
                </label>
                <button
                  type="button"
                  onClick={() => setEndDate(getTodayLocalDate())}
                  className="text-[11px] font-mono text-zinc-400 hover:text-indigo-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="Set end date to today"
                >
                  <Clock className="w-3 h-3" />
                  <span>Today</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  ref={endDateInputRef}
                  type="date"
                  min={startDate || MIN_DATE_INPUT}
                  max={MAX_DATE_INPUT}
                  value={endDate}
                  onChange={(e) => setEndDate(sanitizeDateInput(e.target.value))}
                  className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] cursor-pointer [color-scheme:dark]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (endDateInputRef.current) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        try {
                          endDateInputRef.current.showPicker();
                        } catch {
                          endDateInputRef.current.focus();
                        }
                      } else {
                        endDateInputRef.current.focus();
                      }
                    }
                  }}
                  className="absolute right-2 p-1.5 text-zinc-400 hover:text-indigo-400 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  title="Choose exact end date from calendar"
                  aria-label="Open end date calendar"
                >
                  <Calendar className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Description / Destination</label>
            <textarea
              rows={2}
              placeholder="e.g. 4-day group trip with shared villa and scooties."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500"
            />
          </div>

          {/* Retention Timer Policy Information */}
          <div className="p-3 bg-white/[0.02] border border-white/10 rounded-lg text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>1-Month Retention Policy</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
              Trips are automatically deleted from the database 1 month from creation. A 1-week extension can be added (only once per trip) when 2 days remain.
            </p>
            {initialData && (
              <div className="pt-1.5 border-t border-white/5 text-[10px] text-zinc-400 space-y-0.5">
                <div>Created: {new Date(initialData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div>Status: <span className="text-indigo-300">{getTripTimerStatus(initialData).formattedTimeLeft}</span></div>
                {initialData.extensionAdded && (
                  <div className="text-emerald-400">+1 Week Extension Used</div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/30 font-mono">
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
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-mono font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors min-h-[42px] cursor-pointer"
            >
              {initialData ? 'Save Settings' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
