/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trip } from '../types/trip';
import { getTripTimerStatus, TripTimerStatus } from '../utils/tripTimer';
import {
  Clock,
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface TripTimerWidgetProps {
  trip: Trip;
  onExtendTrip: (tripId: string) => Promise<void> | void;
  variant?: 'banner' | 'badge' | 'full';
  className?: string;
}

export const TripTimerWidget: React.FC<TripTimerWidgetProps> = ({
  trip,
  onExtendTrip,
  variant = 'badge',
  className = '',
}) => {
  // Live ticking status
  const [status, setStatus] = useState<TripTimerStatus>(() => getTripTimerStatus(trip));
  const [isExtending, setIsExtending] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    // Tick every 10 seconds to update countdown
    const timer = setInterval(() => {
      setStatus(getTripTimerStatus(trip));
    }, 10000);
    return () => clearInterval(timer);
  }, [trip]);

  // Update immediately when trip prop changes
  useEffect(() => {
    setStatus(getTripTimerStatus(trip));
  }, [trip]);

  const handleExtend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!status.isEligibleForExtension || isExtending) return;
    setIsExtending(true);
    try {
      await onExtendTrip(trip.id);
    } finally {
      setIsExtending(false);
    }
  };

  // --- VARIANT: BADGE (Compact pill for trip cards or header) ---
  if (variant === 'badge') {
    if (status.isExpired) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-500/15 border border-red-500/30 text-red-300 ${className}`}
          title="This trip has reached its 1-month retention limit and will be auto-deleted from the database."
        >
          <Clock className="w-3 h-3 text-red-400" />
          <span>Expired</span>
        </span>
      );
    }

    if (status.isEligibleForExtension) {
      return (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300 animate-pulse"
            title="Auto-deletion in under 2 days. 1-week extension available!"
          >
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            <span>{status.formattedTimeLeft}</span>
          </span>
          <button
            type="button"
            onClick={handleExtend}
            disabled={isExtending}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Extend deletion timer by 1 week (Allowed once per trip)"
          >
            <CalendarPlus className="w-3 h-3" />
            <span>{isExtending ? 'Extending...' : '+1 Week'}</span>
          </button>
        </div>
      );
    }

    if (status.extensionAdded) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 ${className}`}
          title="1-week extension already applied to this trip"
        >
          <CheckCircle2 className="w-3 h-3 text-indigo-400" />
          <span>{status.formattedTimeLeft} (+7d extended)</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-white/[0.04] border border-white/10 text-zinc-400 ${className}`}
        title={`Auto-deletion scheduled for ${new Date(status.expiresAt).toLocaleDateString()}. (1-month database retention policy)`}
      >
        <Clock className="w-3 h-3 text-zinc-500" />
        <span>{status.formattedTimeLeft}</span>
      </span>
    );
  }

  // --- VARIANT: BANNER (Prominent warning banner in active trip view) ---
  if (variant === 'banner') {
    // If <= 2 days left (Critical/Actionable), show high-priority banner with "+1 Week" button
    if (status.isEligibleForExtension) {
      return (
        <div className={`p-4 rounded-xl bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-zinc-900 border border-rose-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-zinc-200 ${className}`}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
                  Database Auto-Deletion Warning
                </span>
                <span className="text-xs font-mono font-semibold text-rose-200 bg-rose-500/20 px-2 py-0.2 rounded border border-rose-500/30">
                  ⏱️ {status.formattedTimeLeft}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Trips are automatically deleted from the database 1 month after creation. You have fewer than 2 days left before all records are purged. You can extend this trip by <strong>1 week</strong> (only once per trip).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExtend}
              disabled={isExtending}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md hover:shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>{isExtending ? 'Extending...' : 'Extend by 1 Week (+7 Days)'}</span>
            </button>
          </div>
        </div>
      );
    }

    // If already extended and < 2 days left
    if (status.extensionAdded && status.msRemaining <= 2 * 24 * 60 * 60 * 1000 && !status.isExpired) {
      return (
        <div className={`p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-200 ${className}`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Final Notice:</strong> Auto-deleting in <strong>{status.formattedTimeLeft}</strong>. The 1-week extension was already applied and cannot be extended again.
            </span>
          </div>
        </div>
      );
    }

    // Default subtle header indicator when more than 2 days remain
    return (
      <div className={`flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-xs text-zinc-400 font-mono flex-wrap gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            Database Retention Timer: <strong className="text-zinc-200">{status.formattedTimeLeft}</strong>
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-[11px] text-zinc-500">
            Auto-deletes on {new Date(status.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {status.extensionAdded ? (
            <span className="text-indigo-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-indigo-400" />
              <span>+1 Week Extension Applied</span>
            </span>
          ) : (
            <span className="text-zinc-500 italic">
              (+1 Week extension unlocks when ≤ 2 days left)
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
};
