/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Trip } from '../types/trip';
import { formatMoney } from '../engine/calculator';
import { StorageService } from '../services/storage';
import {
  Plus,
  Calendar,
  Users,
  ArrowRight,
  Compass,
  Edit2,
  Trash2,
  Search,
  Hash,
  X,
  KeyRound,
} from 'lucide-react';
import { TripTimerWidget } from './TripTimerWidget';

interface DashboardViewProps {
  trips: Trip[];
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: () => void;
  onLoadTrip: () => void;
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string, tripName: string) => void;
  onExtendTrip: (tripId: string) => Promise<void> | void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  trips,
  onSelectTrip,
  onCreateTrip,
  onLoadTrip,
  onEditTrip,
  onDeleteTrip,
  onExtendTrip,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mongoStatus, setMongoStatus] = useState<{
    configured: boolean;
    connected: boolean;
  } | null>(null);

  const checkStatus = () => {
    StorageService.checkMongoStatus()
      .then((status) => {
        setMongoStatus({
          configured: status.configured,
          connected: status.connected,
        });
      })
      .catch(() => {
        setMongoStatus({
          configured: false,
          connected: false,
        });
      });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Compute total spend for a trip
  const getTripTotalExpenseCents = (trip: Trip) => {
    return (trip.transactions || [])
      .filter((tx) => tx.type === 'EXPENSE')
      .reduce((sum, tx) => sum + (tx.totalAmountCents || 0), 0);
  };

  // Filter trips based on search query (name, description, or 6-digit tripKey)
  const filteredTrips = useMemo(() => {
    if (!searchQuery.trim()) return trips;
    const q = searchQuery.toLowerCase().trim();
    return trips.filter((t) => {
      const matchName = t.name.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchKey = t.tripKey?.toLowerCase().includes(q);
      return matchName || matchDesc || matchKey;
    });
  }, [trips, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in duration-200">
      {/* Dashboard Header: Compact & Non-Repetitive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            <span>Trip Expense Manager</span>
            <button
              type="button"
              onClick={checkStatus}
              className="inline-flex items-center cursor-pointer p-0.5 rounded focus:outline-none"
              title={mongoStatus?.connected ? 'Database Connected (click to re-verify)' : 'Database Not Connected (click to re-verify)'}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    mongoStatus?.connected ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-300 ${
                    mongoStatus?.connected
                      ? 'bg-emerald-400 shadow-[0_0_8px_#34d399,0_0_12px_#10b981]'
                      : 'bg-red-500 shadow-[0_0_8px_#f87171,0_0_12px_#ef4444]'
                  }`}
                />
              </span>
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-light text-[#F8F7F4] tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Manage group expenses, member balances, and settlements.
          </p>
        </div>

        {/* Clean Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onLoadTrip}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
            title="Load trip by 6-digit key"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Trip</span>
          </button>
          <button
            type="button"
            onClick={onCreateTrip}
            className="btn flex items-center gap-1.5 px-4 py-2 text-xs font-medium shadow-md hover:shadow-indigo-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Trip</span>
          </button>
        </div>
      </div>

      {/* Trips Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-medium text-[#F8F7F4]">
              Your Trips
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/15">
              {trips.length}
            </span>
          </div>

          {/* Compact Search Bar */}
          {trips.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search trips or #key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs font-mono bg-white/[0.04] border border-white/15 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {trips.length === 0 ? (
          /* Empty state: Short & Non-Repetitive */
          <div className="card p-8 sm:p-12 text-center space-y-4 border border-dashed border-white/20">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-[#F8F7F4]">No trips yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Create or load a trip to start splitting expenses and tracking balances.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
              <button
                type="button"
                onClick={onLoadTrip}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 border border-white/10 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Load Trip</span>
              </button>
              <button
                type="button"
                onClick={onCreateTrip}
                className="btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Trip</span>
              </button>
            </div>
          </div>
        ) : filteredTrips.length === 0 ? (
          /* Search no results */
          <div className="card p-6 text-center space-y-2 border border-white/10">
            <p className="text-xs text-zinc-400">
              No trips match <span className="text-white font-mono">"{searchQuery}"</span>.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          /* Clean Trip Cards Grid without repetitive text */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredTrips.map((trip) => {
              const totalExpensesCents = getTripTotalExpenseCents(trip);
              const txCount = (trip.transactions || []).length;
              const participants = trip.participants || [];

              return (
                <div
                  key={trip.id}
                  onClick={() => onSelectTrip(trip.id)}
                  className="card p-4 sm:p-5 hover:bg-white/[0.05] hover:border-indigo-500/40 transition-all duration-150 cursor-pointer flex flex-col justify-between group space-y-3.5"
                >
                  <div className="space-y-2.5">
                    {/* Header: Key, Name & Actions */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {trip.tripKey && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                              title="6-digit unique trip key"
                            >
                              <Hash className="w-2.5 h-2.5 opacity-60" />
                              {trip.tripKey}
                            </span>
                          )}
                          <h3 className="text-base font-medium text-[#F8F7F4] group-hover:text-indigo-300 transition-colors truncate">
                            {trip.name}
                          </h3>
                        </div>
                        {trip.description && (
                          <p className="text-xs text-zinc-400 line-clamp-1">
                            {trip.description}
                          </p>
                        )}
                      </div>

                      {/* Edit & Delete Action icons */}
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTrip(trip);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                          title="Edit Settings"
                          aria-label="Edit Trip"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTrip(trip.id, trip.name);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                          title="Delete Trip"
                          aria-label="Delete Trip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Expiration Badges */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 flex-wrap">
                      {trip.startDate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.03] border border-white/10">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          <span>
                            {trip.startDate}{trip.endDate ? ` → ${trip.endDate}` : ''}
                          </span>
                        </span>
                      )}

                      {/* Expiration Timer Badge */}
                      <TripTimerWidget trip={trip} onExtendTrip={onExtendTrip} variant="badge" />
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Total
                        </div>
                        <div className="text-sm sm:text-base font-normal text-[#F8F7F4]">
                          {formatMoney(totalExpensesCents, trip.baseCurrency || 'INR')}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Expenses
                        </div>
                        <div className="text-sm font-normal text-zinc-300">
                          {txCount} {txCount === 1 ? 'entry' : 'entries'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Members & Interactive Cue (no repetitive text) */}
                  <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <div className="flex -space-x-1 overflow-hidden">
                        {participants.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className="inline-block w-4 h-4 rounded-full border border-[#111113] shrink-0"
                            style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                            title={p.name}
                          />
                        ))}
                      </div>
                      <span className="truncate text-[11px] text-zinc-400 ml-1">
                        {participants.length} {participants.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
