/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Participant } from '../types/trip';
import { AVATAR_PALETTE } from '../utils/constants';
import { MIN_DATE_INPUT, MAX_DATE_INPUT, sanitizeDateInput, getTodayLocalDate } from '../utils/date';
import { X, UserPlus, Check, Calendar, Clock } from 'lucide-react';

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (participant: Participant) => void;
  initialData?: Participant | null;
  tripStartDate?: string;
}

export const ParticipantModal: React.FC<ParticipantModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  tripStartDate,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [avatarColor, setAvatarColor] = useState(
    initialData?.avatarColor ||
      AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)]
  );
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [joinedDate, setJoinedDate] = useState(
    initialData?.joinedDate || tripStartDate || getTodayLocalDate()
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setEmail(initialData?.email || '');
      setPhone(initialData?.phone || '');
      setAvatarColor(
        initialData?.avatarColor ||
          AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)]
      );
      setJoinedDate(initialData?.joinedDate || tripStartDate || getTodayLocalDate());
      setNotes(initialData?.notes || '');
      setError(null);
    }
  }, [isOpen, initialData, tripStartDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the participant.');
      return;
    }

    const participant: Participant = {
      id: initialData?.id || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      avatarColor,
      joinedDate,
      notes: notes.trim() || undefined,
      isActive: true,
    };

    onSave(participant);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-md bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-[#F8F7F4]">
                {initialData ? 'Edit Participant' : 'Add Participant'}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">Trip member details and join date</p>
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
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sarah Connor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
            />
          </div>

          {/* Color Avatar Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Avatar Accent Color</label>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {AVATAR_PALETTE.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative border border-white/20 cursor-pointer"
                  style={{ backgroundColor: color }}
                >
                  {avatarColor === color && (
                    <Check className="w-4 h-4 text-white stroke-[2.5]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Email (Optional)</label>
              <input
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Phone (Optional)</label>
              <input
                type="tel"
                placeholder="+1 555-..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Joined Trip On (Late Joiner Tracking)</span>
              </label>
              <button
                type="button"
                onClick={() => setJoinedDate(getTodayLocalDate())}
                className={`text-[11px] font-mono flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  joinedDate === getTodayLocalDate()
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
                value={joinedDate}
                onChange={(e) => setJoinedDate(sanitizeDateInput(e.target.value))}
                className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] cursor-pointer [color-scheme:dark]"
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

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Driver, booked hotel, vegetarian"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
            />
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
              {initialData ? 'Update Participant' : 'Add to Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
