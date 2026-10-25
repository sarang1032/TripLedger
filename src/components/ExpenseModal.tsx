/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ExpenseCategory,
  ItemizedItem,
  Participant,
  PayerContribution,
  SplitMethod,
  SplitParticipantShare,
  Transaction,
} from '../types/trip';
import {
  calculateEqualShares,
  calculateItemizedShares,
  calculatePercentShares,
  calculateWeightedShares,
  formatMoney,
  toCents,
  validateExpense,
} from '../engine/calculator';
import { CATEGORY_LABELS, SUPPORTED_CURRENCIES } from '../utils/constants';
import { MIN_DATE_INPUT, MAX_DATE_INPUT, sanitizeDateInput, getTodayLocalDate } from '../utils/date';
import { StorageService, CustomCategoryItem } from '../services/storage';
import { X, Plus, Trash2, AlertCircle, CheckCircle2, Check, Tag, Calendar, Clock } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
  participants: Participant[];
  baseCurrency: string;
  initialData?: Transaction | null;
  tripStartDate?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  baseCurrency,
  initialData,
  tripStartDate,
}) => {
  // Form State
  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'food');

  // Custom Category State
  const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>(() =>
    StorageService.loadCustomCategories()
  );
  const [oneOffCategories, setOneOffCategories] = useState<CustomCategoryItem[]>(() => {
    if (
      initialData?.category &&
      !CATEGORY_LABELS[initialData.category] &&
      !StorageService.loadCustomCategories().some((c) => c.key === initialData.category)
    ) {
      return [{ key: initialData.category, label: initialData.category }];
    }
    return [];
  });
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isPermanentCategory, setIsPermanentCategory] = useState(true);
  const [customCategoryError, setCustomCategoryError] = useState<string | null>(null);

  const handleAddNewCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCustomCategoryError('Please enter a category name');
      return;
    }

    const matchingStandardEntry = Object.entries(CATEGORY_LABELS).find(
      ([k, v]) =>
        k.toLowerCase() === trimmed.toLowerCase() ||
        v.label.toLowerCase() === trimmed.toLowerCase()
    );

    let finalKey = trimmed;
    if (matchingStandardEntry) {
      finalKey = matchingStandardEntry[0];
    } else {
      if (isPermanentCategory) {
        const item: CustomCategoryItem = {
          key: trimmed,
          label: trimmed,
        };
        const updated = StorageService.saveCustomCategory(item);
        setCustomCategories(updated);
      } else {
        const alreadyInOneOff = oneOffCategories.some(
          (c) => c.key.toLowerCase() === trimmed.toLowerCase()
        );
        if (!alreadyInOneOff) {
          setOneOffCategories((prev) => [...prev, { key: trimmed, label: trimmed }]);
        }
      }
    }

    setCategory(finalKey as ExpenseCategory);
    setNewCategoryName('');
    setCustomCategoryError(null);
    setIsAddingCustomCategory(false);
  };

  const dateInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(
    initialData?.date || tripStartDate || getTodayLocalDate()
  );

  useEffect(() => {
    if (isOpen) {
      if (initialData?.date) {
        setDate(initialData.date);
      } else if (tripStartDate) {
        setDate(tripStartDate);
      } else {
        setDate(getTodayLocalDate());
      }
    }
  }, [isOpen, initialData, tripStartDate]);
  const [currency, setCurrency] = useState(initialData?.currency || baseCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(
    initialData?.exchangeRateToBase || 1.0
  );
  const [amountStr, setAmountStr] = useState<string>(
    initialData ? (initialData.originalAmount).toString() : ''
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [receiptNote, setReceiptNote] = useState(initialData?.receiptNote || '');

  // Payer Mode: 'single' | 'multiple'
  const isInitialMultiPayer = (initialData?.payers?.length || 0) > 1;
  const [isMultiPayer, setIsMultiPayer] = useState(isInitialMultiPayer);
  const [singlePayerId, setSinglePayerId] = useState(
    initialData?.payers[0]?.participantId || participants[0]?.id || ''
  );
  const [multiPayerAmounts, setMultiPayerAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialData?.payers) {
      initialData.payers.forEach((p) => {
        map[p.participantId] = (p.amountCents / 100).toString();
      });
    }
    return map;
  });

  // Split Mode
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(
    initialData?.splitMethod || 'EQUAL'
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(() => {
    if (initialData?.splitShares) {
      return initialData.splitShares.map((s) => s.participantId);
    }
    return participants.map((p) => p.id);
  });

  // Values for specific split modes
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialData?.splitMethod === 'EXACT' && initialData.splitShares) {
      initialData.splitShares.forEach((s) => {
        map[s.participantId] = (s.calculatedCents / 100).toString();
      });
    }
    return map;
  });

  const [percentAmounts, setPercentAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialData?.splitMethod === 'PERCENT' && initialData.splitShares) {
      initialData.splitShares.forEach((s) => {
        map[s.participantId] = (s.shareValue || 0).toString();
      });
    } else {
      // Default equal percents
      const count = participants.length;
      if (count > 0) {
        const p = Math.floor(100 / count);
        participants.forEach((part) => (map[part.id] = p.toString()));
      }
    }
    return map;
  });

  const [shareWeights, setShareWeights] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    participants.forEach((p) => {
      const existing = initialData?.splitShares.find((s) => s.participantId === p.id);
      map[p.id] = existing?.shareValue ? existing.shareValue.toString() : '1';
    });
    return map;
  });

  // Itemized split state
  const [itemizedList, setItemizedList] = useState<ItemizedItem[]>(
    initialData?.itemizedItems || [
      {
        id: 'item-1',
        title: 'Item 1',
        amountCents: 0,
        assignedParticipantIds: participants.map((p) => p.id),
      },
    ]
  );

  // Auto-update exchange rate default when currency changes
  const handleCurrencyChange = (newCode: string) => {
    setCurrency(newCode);
    const curr = SUPPORTED_CURRENCIES.find((c) => c.code === newCode);
    if (curr) {
      setExchangeRate(curr.rateToBase);
    } else {
      setExchangeRate(1.0);
    }
  };

  // Compute total in base currency cents
  const rawOriginalAmount = parseFloat(amountStr) || 0;
  const baseCurrencyAmount = rawOriginalAmount * exchangeRate;
  const totalAmountCents = toCents(baseCurrencyAmount);

  // Compute calculated split shares dynamically
  const [computedShares, setComputedShares] = useState<SplitParticipantShare[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (totalAmountCents <= 0) {
      setComputedShares([]);
      return;
    }

    if (splitMethod === 'EQUAL') {
      const shares = calculateEqualShares(totalAmountCents, selectedParticipantIds);
      setComputedShares(shares);
    } else if (splitMethod === 'EXACT') {
      const shares: SplitParticipantShare[] = selectedParticipantIds.map((id) => {
        const val = parseFloat(exactAmounts[id] || '0');
        return {
          participantId: id,
          calculatedCents: toCents(val * exchangeRate),
        };
      });
      setComputedShares(shares);
    } else if (splitMethod === 'PERCENT') {
      const list = selectedParticipantIds.map((id) => ({
        participantId: id,
        percent: parseFloat(percentAmounts[id] || '0'),
      }));
      const { shares } = calculatePercentShares(totalAmountCents, list);
      setComputedShares(shares);
    } else if (splitMethod === 'SHARES') {
      const list = selectedParticipantIds.map((id) => ({
        participantId: id,
        shares: parseFloat(shareWeights[id] || '1'),
      }));
      const shares = calculateWeightedShares(totalAmountCents, list);
      setComputedShares(shares);
    } else if (splitMethod === 'ITEMIZED') {
      const shares = calculateItemizedShares(itemizedList);
      setComputedShares(shares);
    }
  }, [
    splitMethod,
    totalAmountCents,
    selectedParticipantIds,
    exactAmounts,
    percentAmounts,
    shareWeights,
    itemizedList,
    exchangeRate,
  ]);

  // Construct Payers List
  const buildPayersList = (): PayerContribution[] => {
    if (!isMultiPayer) {
      return [{ participantId: singlePayerId, amountCents: totalAmountCents }];
    }
    return Object.entries(multiPayerAmounts)
      .map(([pId, valStr]) => {
        const val = parseFloat(valStr) || 0;
        return {
          participantId: pId,
          amountCents: toCents(val * exchangeRate),
        };
      })
      .filter((p) => p.amountCents > 0);
  };

  // Reconcile / Distribute remainder button for exact amounts
  const handleAutoReconcileExact = () => {
    const currentTotalCents = selectedParticipantIds.reduce((sum, id) => {
      const val = parseFloat(exactAmounts[id] || '0');
      return sum + toCents(val * exchangeRate);
    }, 0);

    const diffCents = totalAmountCents - currentTotalCents;
    if (diffCents === 0 || selectedParticipantIds.length === 0) return;

    // Distribute diff to the first selected participant
    const targetId = selectedParticipantIds[0];
    const currentVal = parseFloat(exactAmounts[targetId] || '0');
    const adjustedVal = currentVal + diffCents / (100 * exchangeRate);
    setExactAmounts((prev) => ({
      ...prev,
      [targetId]: Math.max(0, adjustedVal).toFixed(2),
    }));
  };

  // Handle Save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payers = buildPayersList();
    const validation = validateExpense(totalAmountCents, payers, computedShares);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    onSave({
      tripId: '', // Filled by caller
      type: 'EXPENSE',
      title: title.trim() || 'Untitled Expense',
      category,
      date,
      currency,
      exchangeRateToBase: exchangeRate,
      originalAmount: rawOriginalAmount,
      totalAmountCents,
      payers,
      splitMethod,
      splitShares: computedShares,
      itemizedItems: splitMethod === 'ITEMIZED' ? itemizedList : undefined,
      notes: notes.trim() || undefined,
      receiptNote: receiptNote.trim() || undefined,
    });
    onClose();
  };

  const currentPayersTotalCents = buildPayersList().reduce(
    (sum, p) => sum + p.amountCents,
    0
  );
  const currentSharesTotalCents = computedShares.reduce(
    (sum, s) => sum + s.calculatedCents,
    0
  );
  const payersMismatch = currentPayersTotalCents !== totalAmountCents;
  const sharesMismatch = currentSharesTotalCents !== totalAmountCents;

  const isCustomCategoryActive = !CATEGORY_LABELS[category];
  const isPermanentCustom = customCategories.some((c) => c.key === category);
  const activeCustomCategoryLabel =
    customCategories.find((c) => c.key === category)?.label ||
    oneOffCategories.find((c) => c.key === category)?.label ||
    category;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs overflow-hidden">
      <div className="relative w-full max-w-2xl bg-[#18181b] text-[#F8F7F4] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-white/[0.03]">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-[#F8F7F4]">
              {initialData ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">
              Record who paid and allocate transparent shares across participants
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

        {/* Form wrapping body and footer */}
        <form onSubmit={handleSave} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Expense Title</label>
              <input
                type="text"
                required
                placeholder="e.g., Grocery haul, Ski passes, Dinner"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Category</label>
                {!isAddingCustomCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomCategory(true);
                      setCustomCategoryError(null);
                    }}
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Category</span>
                  </button>
                )}
              </div>

              {!isAddingCustomCategory ? (
                <>
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        setIsAddingCustomCategory(true);
                        setCustomCategoryError(null);
                      } else {
                        setCategory(e.target.value as ExpenseCategory);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
                  >
                    <optgroup label="Standard Categories" className="bg-[#18181b] text-zinc-400">
                      {Object.entries(CATEGORY_LABELS).map(([key, item]) => (
                        <option key={key} value={key} className="bg-[#18181b] text-[#F8F7F4]">
                          {item.label}
                        </option>
                      ))}
                    </optgroup>

                    {customCategories.length > 0 && (
                      <optgroup label="Custom Categories (Permanent)" className="bg-[#18181b] text-zinc-400">
                        {customCategories.map((item) => (
                          <option key={item.key} value={item.key} className="bg-[#18181b] text-[#F8F7F4]">
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {oneOffCategories.length > 0 && (
                      <optgroup label="One-off Categories" className="bg-[#18181b] text-zinc-400">
                        {oneOffCategories.map((item) => (
                          <option key={item.key} value={item.key} className="bg-[#18181b] text-[#F8F7F4]">
                            {item.label} (This expense only)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <option value="__ADD_NEW__" className="bg-[#18181b] text-indigo-400 font-medium">
                      + Add Category...
                    </option>
                  </select>

                  {/* Informative indicator when a custom category is active */}
                  {isCustomCategoryActive && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 pt-0.5">
                      <Tag className="w-3 h-3 text-indigo-400" />
                      <span>Selected: <strong className="text-zinc-200">{activeCustomCategoryLabel}</strong></span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] ${
                          isPermanentCustom
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isPermanentCustom ? 'Permanent' : 'This Expense Only'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3.5 bg-white/[0.04] border border-indigo-500/30 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F8F7F4] flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                      Add New Category
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomCategory(false);
                        setCustomCategoryError(null);
                        setNewCategoryName('');
                      }}
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Category Name
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g., Ski Passes, Museum, Souvenirs"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        if (customCategoryError) setCustomCategoryError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewCategory();
                        }
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/20 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 min-h-[38px]"
                    />
                    {customCategoryError && (
                      <p className="text-[11px] text-red-400 font-mono mt-1">{customCategoryError}</p>
                    )}
                  </div>

                  {/* Toggle Option with clickable box */}
                  <div className="pt-1">
                    <div
                      onClick={() => setIsPermanentCategory(!isPermanentCategory)}
                      className="flex items-center justify-between p-2.5 bg-black/40 hover:bg-black/50 border border-white/10 rounded-lg cursor-pointer transition-colors group select-none"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-medium text-[#F8F7F4] leading-snug group-hover:text-white transition-colors">
                          {isPermanentCategory ? 'Add permanently in Category section' : 'Just for this type of expense'}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-normal">
                          {isPermanentCategory
                            ? 'Available for all trips and future expenses'
                            : 'Applied exclusively to this expense'}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isPermanentCategory}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPermanentCategory(!isPermanentCategory);
                        }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          isPermanentCategory
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                            : 'bg-white/[0.05] border-white/20 text-transparent group-hover:border-white/40'
                        }`}
                        title="Toggle permanent or one-off category"
                      >
                        <Check
                          className={`w-3.5 h-3.5 stroke-[2.5] transition-opacity ${
                            isPermanentCategory ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomCategory(false);
                        setCustomCategoryError(null);
                        setNewCategoryName('');
                      }}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNewCategory()}
                      className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Apply changes</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Amount, Currency & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/[0.03] p-4 rounded-lg border border-white/10">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full px-3 py-2 text-base font-semibold font-mono text-[#F8F7F4] bg-white/[0.05] border border-white/15 rounded-lg focus:outline-none focus:border-indigo-500 min-h-[40px] placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Currency</label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#18181b] text-[#F8F7F4]">
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
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

            {/* Exchange rate helper if currency is different from base */}
            {currency !== baseCurrency && (
              <div className="sm:col-span-3 pt-2 text-xs text-zinc-400 font-mono flex items-center justify-between border-t border-white/10 flex-wrap gap-2">
                <span>
                  Exchange Rate: 1 {currency} =
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                    className="w-24 px-2 py-1 text-xs border border-white/15 rounded bg-white/[0.05] text-[#F8F7F4] font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <span>{baseCurrency} (Total: {formatMoney(totalAmountCents, baseCurrency)})</span>
                </div>
              </div>
            )}
          </div>

          {/* Payers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Who Paid?</label>
              <div className="flex items-center gap-1 p-0.5 bg-white/[0.04] border border-white/10 rounded-lg text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setIsMultiPayer(false)}
                  className={`px-2.5 py-1 rounded transition-colors font-medium cursor-pointer ${
                    !isMultiPayer
                      ? 'bg-white/15 text-white shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Single Payer
                </button>
                <button
                  type="button"
                  onClick={() => setIsMultiPayer(true)}
                  className={`px-2.5 py-1 rounded transition-colors font-medium cursor-pointer ${
                    isMultiPayer
                      ? 'bg-white/15 text-white shadow-xs font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Multiple Payers
                </button>
              </div>
            </div>

            {!isMultiPayer ? (
              <select
                value={singlePayerId}
                onChange={(e) => setSinglePayerId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.05] border border-white/15 text-[#F8F7F4] rounded-lg focus:outline-none focus:border-indigo-500 font-mono min-h-[40px] cursor-pointer"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#18181b] text-[#F8F7F4]">
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 p-3 bg-white/[0.03] rounded-lg border border-white/10">
                <p className="text-xs text-zinc-400 font-mono">
                  Enter exact amounts paid by each contributor ({currency})
                </p>
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-zinc-200 truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-zinc-500">{currency}</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={multiPayerAmounts[p.id] || ''}
                        onChange={(e) =>
                          setMultiPayerAmounts({
                            ...multiPayerAmounts,
                            [p.id]: e.target.value,
                          })
                        }
                        className="w-28 px-2 py-1 text-right text-xs bg-white/[0.05] border border-white/15 rounded text-[#F8F7F4] font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}

                {payersMismatch && totalAmountCents > 0 && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20 flex items-center justify-between font-mono">
                    <span>
                      Total Paid: {formatMoney(currentPayersTotalCents, baseCurrency)} / Target: {formatMoney(totalAmountCents, baseCurrency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Put remaining onto first participant
                        const firstId = participants[0]?.id;
                        if (!firstId) return;
                        const otherTotal = Object.entries(multiPayerAmounts).reduce((sum, [id, val]) => {
                          if (id === firstId) return sum;
                          return sum + (parseFloat(val) || 0);
                        }, 0);
                        const remainder = Math.max(0, rawOriginalAmount - otherTotal);
                        setMultiPayerAmounts({
                          ...multiPayerAmounts,
                          [firstId]: remainder.toFixed(2),
                        });
                      }}
                      className="underline font-medium hover:text-amber-300 cursor-pointer"
                    >
                      Fill Remaining
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Split Mode & Allocation */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Split Method</label>
              <div className="flex items-center gap-1 p-0.5 bg-white/[0.04] border border-white/10 rounded-lg text-xs font-mono overflow-x-auto">
                {(['EQUAL', 'EXACT', 'PERCENT', 'SHARES', 'ITEMIZED'] as SplitMethod[]).map(
                  (method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSplitMethod(method)}
                      className={`px-2.5 py-1 rounded-md transition-colors font-medium whitespace-nowrap cursor-pointer ${
                        splitMethod === method
                          ? 'bg-white/15 text-white shadow-xs font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {method === 'EQUAL' && 'Equal'}
                      {method === 'EXACT' && 'Exact ₹'}
                      {method === 'PERCENT' && 'Percent %'}
                      {method === 'SHARES' && 'Shares'}
                      {method === 'ITEMIZED' && 'Itemized'}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Sub-group Participant Selector (Late joiners / subset) */}
            {splitMethod !== 'ITEMIZED' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                  <span>Who was involved in this expense?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedParticipantIds(participants.map((p) => p.id))}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedParticipantIds([])}
                      className="text-indigo-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {participants.map((p) => {
                    const isSelected = selectedParticipantIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedParticipantIds(
                              selectedParticipantIds.filter((id) => id !== p.id)
                            );
                          } else {
                            setSelectedParticipantIds([...selectedParticipantIds, p.id]);
                          }
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          isSelected
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

            {/* Split Method Specific Inputs */}
            {splitMethod === 'EQUAL' && (
              <div className="p-3 bg-white/[0.03] rounded-lg text-xs space-y-1.5 border border-white/10 font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Participants: {selectedParticipantIds.length}</span>
                  <span className="font-semibold text-zinc-200">
                    {selectedParticipantIds.length > 0
                      ? formatMoney(
                          Math.floor(totalAmountCents / selectedParticipantIds.length),
                          baseCurrency
                        ) + '/person'
                      : '₹0.00'}
                  </span>
                </div>
                {totalAmountCents % (selectedParticipantIds.length || 1) !== 0 && (
                  <p className="text-zinc-500 text-[11px]">
                    Automatic penny reconciliation: remainder (
                    {totalAmountCents % selectedParticipantIds.length}¢) distributed across first{' '}
                    {totalAmountCents % selectedParticipantIds.length} participant(s).
                  </p>
                )}
              </div>
            )}

            {splitMethod === 'EXACT' && (
              <div className="p-3 bg-white/[0.03] rounded-lg space-y-2 border border-white/10">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Specify exact amounts per person:</span>
                  <button
                    type="button"
                    onClick={handleAutoReconcileExact}
                    className="text-indigo-400 hover:underline font-medium text-[11px] cursor-pointer"
                  >
                    Auto-reconcile remaining
                  </button>
                </div>
                {selectedParticipantIds.map((pId) => {
                  const p = participants.find((part) => part.id === pId);
                  if (!p) return null;
                  return (
                    <div key={pId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-200">{p.name}</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-zinc-500">{baseCurrency}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={exactAmounts[pId] || ''}
                          onChange={(e) =>
                            setExactAmounts({
                              ...exactAmounts,
                              [pId]: e.target.value,
                            })
                          }
                          className="w-24 px-2 py-1 text-right text-xs bg-white/[0.05] border border-white/15 rounded text-[#F8F7F4] font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {splitMethod === 'PERCENT' && (
              <div className="p-3 bg-white/[0.03] rounded-lg space-y-2 border border-white/10">
                <p className="text-xs text-zinc-400 font-mono">Enter percentage allocation (must sum to 100%):</p>
                {selectedParticipantIds.map((pId) => {
                  const p = participants.find((part) => part.id === pId);
                  if (!p) return null;
                  return (
                    <div key={pId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-200">{p.name}</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={percentAmounts[pId] || ''}
                          onChange={(e) =>
                            setPercentAmounts({
                              ...percentAmounts,
                              [pId]: e.target.value,
                            })
                          }
                          className="w-20 px-2 py-1 text-right text-xs bg-white/[0.05] border border-white/15 rounded text-[#F8F7F4] font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-zinc-500">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {splitMethod === 'SHARES' && (
              <div className="p-3 bg-white/[0.03] rounded-lg space-y-2 border border-white/10">
                <p className="text-xs text-zinc-400 font-mono">
                  Assign weight units (e.g., 2 shares for couples, 1 for singles, 0.5 for kids):
                </p>
                {selectedParticipantIds.map((pId) => {
                  const p = participants.find((part) => part.id === pId);
                  if (!p) return null;
                  return (
                    <div key={pId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-200">{p.name}</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="1"
                          value={shareWeights[pId] || '1'}
                          onChange={(e) =>
                            setShareWeights({
                              ...shareWeights,
                              [pId]: e.target.value,
                            })
                          }
                          className="w-20 px-2 py-1 text-right text-xs bg-white/[0.05] border border-white/15 rounded text-[#F8F7F4] font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-zinc-500">share(s)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {splitMethod === 'ITEMIZED' && (
              <div className="p-3 bg-white/[0.03] rounded-lg space-y-3 border border-white/10">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-medium text-zinc-300">Receipt Line Items</span>
                  <button
                    type="button"
                    onClick={() => {
                      setItemizedList([
                        ...itemizedList,
                        {
                          id: `item-${Date.now()}`,
                          title: `Item ${itemizedList.length + 1}`,
                          amountCents: 0,
                          assignedParticipantIds: participants.map((p) => p.id),
                        },
                      ]);
                    }}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {itemizedList.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-white/[0.04] rounded-lg border border-white/10 text-xs space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={item.title}
                          onChange={(e) => {
                            const updated = [...itemizedList];
                            updated[index].title = e.target.value;
                            setItemizedList(updated);
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-white/[0.05] border border-white/15 rounded text-[#F8F7F4] focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500"
                        />
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-zinc-500">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={(item.amountCents / 100) || ''}
                            onChange={(e) => {
                              const updated = [...itemizedList];
                              updated[index].amountCents = toCents(
                                parseFloat(e.target.value) || 0
                              );
                              setItemizedList(updated);
                            }}
                            className="w-20 px-2 py-1 text-right text-xs bg-white/[0.05] border border-white/15 rounded text-[#F8F7F4] font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {itemizedList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setItemizedList(itemizedList.filter((_, i) => i !== index));
                            }}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Who shared this item */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {participants.map((p) => {
                          const isAssigned = item.assignedParticipantIds.includes(p.id);
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => {
                                const updated = [...itemizedList];
                                if (isAssigned) {
                                  updated[index].assignedParticipantIds = updated[
                                    index
                                  ].assignedParticipantIds.filter((id) => id !== p.id);
                                } else {
                                  updated[index].assignedParticipantIds.push(p.id);
                                }
                                setItemizedList(updated);
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                                isAssigned
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:border-white/20'
                              }`}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes & Receipt memo */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Notes & Receipt Info</label>
            <input
              type="text"
              placeholder="e.g. Receipt #4829, tip included, paid with Chase Sapphire"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/[0.05] border border-white/15 rounded-lg text-[#F8F7F4] focus:outline-none focus:border-indigo-500 placeholder:text-zinc-500 min-h-[40px]"
            />
          </div>

          {/* Validation Warnings */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Please correct the following:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          </div>

          {/* Sticky Responsive Footer Controls */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/10 bg-white/[0.02] pb-safe">
            <div className="text-xs text-zinc-400 flex items-center justify-between sm:justify-start gap-1.5 font-mono">
              <span>Allocated:</span>
              <span
                className={`font-semibold ${
                  sharesMismatch ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {formatMoney(currentSharesTotalCents, baseCurrency)}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-200">
                {formatMoney(totalAmountCents, baseCurrency)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-mono font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 rounded-lg transition-colors min-h-[38px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSave}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors min-h-[38px] cursor-pointer"
              >
                {initialData ? 'Save Changes' : 'Record Expense'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
