/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  KeyRound,
  Search,
  RotateCcw,
  Clock,
  Users,
  Receipt,
  Copy,
  Check,
  AlertCircle,
  Database,
  HardDrive,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Trip } from '../types/trip';
import { StorageService, CachedTripHistoryItem } from '../services/storage';
import { formatMoney } from '../engine/calculator';

interface LoadTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripLoaded: (trip: Trip, source: 'mongodb' | 'cache') => void;
  activeTripKeys: string[];
}

export const LoadTripModal: React.FC<LoadTripModalProps> = ({
  isOpen,
  onClose,
  onTripLoaded,
  activeTripKeys,
}) => {
  const [tripKeyInput, setTripKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string; source: string; key: string } | null>(null);

  // Cached device history
  const [historyItems, setHistoryItems] = useState<CachedTripHistoryItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ENTER_KEY' | 'HISTORY'>('ENTER_KEY');

  // Load device history on modal open
  useEffect(() => {
    if (isOpen) {
      const items = StorageService.loadCachedHistory();
      setHistoryItems(items);
      setTripKeyInput('');
      setErrorMessage(null);
      setSuccessInfo(null);
    }
  }, [isOpen]);

  // Filter cached trips based on search input
  const filteredHistory = useMemo(() => {
    if (!searchFilter.trim()) return historyItems;
    const q = searchFilter.toLowerCase().trim();
    return historyItems.filter((item) => {
      const matchName = item.tripName.toLowerCase().includes(q);
      const matchKey = item.tripKey.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      return matchName || matchKey || matchDesc;
    });
  }, [historyItems, searchFilter]);

  if (!isOpen) return null;

  const handleCopyKey = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFetchByKey = async (keyToFetch: string) => {
    const cleanKey = keyToFetch.trim();
    if (!cleanKey) {
      setErrorMessage('Please enter a 6-digit trip key.');
      return;
    }

    if (!/^\d{6}$/.test(cleanKey)) {
      setErrorMessage('Trip key must be exactly 6 digits (e.g. 541357).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const result = await StorageService.loadTripByKey(cleanKey);
      if (result.success && result.trip) {
        setSuccessInfo({
          name: result.trip.name,
          source: result.source === 'mongodb' ? 'MongoDB Atlas' : 'Local Device Cache',
          key: cleanKey,
        });
        setTimeout(() => {
          onTripLoaded(result.trip!, result.source || 'cache');
          onClose();
        }, 600);
      } else {
        setErrorMessage(
          result.error || `No trip found matching 6-digit key #${cleanKey} in MongoDB or device cache.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch trip. Please check your network or database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFetchByKey(tripKeyInput);
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/\b\d{6}\b/);
      if (match) {
        setTripKeyInput(match[0]);
        setErrorMessage(null);
      } else {
        setTripKeyInput(text.replace(/\D/g, '').slice(0, 6));
      }
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="load-trip-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-2xl bg-[#18181B] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#1c1c20]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="load-trip-title" className="text-lg font-medium text-[#F8F7F4]">
                Load a Trip
              </h2>
              <p className="text-xs text-zinc-400">
                Retrieve a trip from MongoDB or device history cache using its 6-digit key
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-white/10 flex items-center gap-2 bg-[#141416] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ENTER_KEY')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'ENTER_KEY'
                ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter 6-Digit Key</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Device History & Cache</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/10 text-zinc-300">
              {historyItems.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'ENTER_KEY' ? (
            <div className="space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="trip-key-input" className="block text-xs font-medium text-zinc-300">
                    6-Digit Unique Trip Key
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 font-mono text-zinc-500 text-lg select-none">
                      #
                    </span>
                    <input
                      id="trip-key-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      placeholder="e.g. 541357"
                      value={tripKeyInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setTripKeyInput(val);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      className="w-full pl-9 pr-24 py-3.5 bg-black/40 border border-white/15 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xl sm:text-2xl font-mono tracking-widest text-[#F8F7F4] placeholder:text-zinc-600 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={handlePasteKey}
                      className="absolute right-3 px-2.5 py-1 text-xs font-mono bg-white/10 hover:bg-white/15 text-zinc-300 rounded-md transition-colors cursor-pointer"
                    >
                      Paste
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Each trip is assigned a guaranteed unique 6-digit number key (100000 - 999999). Deleting a trip does not purge it from MongoDB, allowing instant recovery here.
                  </p>
                </div>

                {/* Feedback State */}
                {errorMessage && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Trip not found</p>
                      <p className="text-red-400/90 mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {successInfo && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs animate-in fade-in">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Trip "{successInfo.name}" loaded!</p>
                      <p className="text-emerald-400/90 mt-0.5">
                        Retrieved from {successInfo.source}. Opening trip editor...
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || tripKeyInput.length !== 6}
                    className="btn flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Fetching Trip...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5" />
                        <span>Load & Edit Trip</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Informational banner about non-permanent deletion */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                  <span>How Trip Recovery Works</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  When you delete any trip record, it is never permanently removed from MongoDB Compass/Atlas. It is safely archived in the cloud database and cached in your browser's local device storage. You or anyone with the 6-digit key can reload it at any time.
                </p>
              </div>

              {/* Quick Suggestions from Device History if available */}
              {historyItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Recent trips on this device</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('HISTORY')}
                      className="text-indigo-400 hover:text-indigo-300 text-[11px] cursor-pointer"
                    >
                      View all ({historyItems.length}) →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {historyItems.slice(0, 4).map((it) => (
                      <button
                        key={it.tripKey || it.tripId}
                        type="button"
                        onClick={() => {
                          setTripKeyInput(it.tripKey);
                          handleFetchByKey(it.tripKey);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-indigo-500/30 text-left transition-all cursor-pointer group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-zinc-200 group-hover:text-indigo-300 truncate">
                            {it.tripName}
                          </p>
                          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                            Key: #{it.tripKey}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400 group-hover:text-white">
                          Load
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-4">
              {/* Search Filter */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter cached trips by name or 6-digit key..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* History Items List */}
              {filteredHistory.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Clock className="w-8 h-8 text-zinc-600 mx-auto stroke-1" />
                  <p className="text-xs text-zinc-400">
                    {searchFilter ? 'No cached trips match your search.' : 'No trips cached on this device yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredHistory.map((item) => {
                    const isActiveInWorkspace = activeTripKeys.includes(item.tripKey);
                    return (
                      <div
                        key={item.tripKey || item.tripId}
                        className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-[#F8F7F4] group-hover:text-indigo-300 transition-colors">
                              {item.tripName}
                            </span>
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                #{item.tripKey}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyKey(e, item.tripKey)}
                                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                title="Copy 6-digit key"
                              >
                                {copiedKey === item.tripKey ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {item.isDeletedLocally ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                                Archived / Deleted
                              </span>
                            ) : isActiveInWorkspace ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                In Dashboard
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3 text-zinc-500" />
                              {item.participantCount} members
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Receipt className="w-3 h-3 text-zinc-500" />
                              {item.transactionCount} expenses
                            </span>
                            {item.totalExpenseCents > 0 && (
                              <span className="font-mono text-zinc-300">
                                {formatMoney(item.totalExpenseCents, item.baseCurrency || 'INR')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setTripKeyInput(item.tripKey);
                              handleFetchByKey(item.tripKey);
                            }}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition-all cursor-pointer"
                          >
                            <span>Load & Edit</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
