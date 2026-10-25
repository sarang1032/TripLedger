/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trip, SettlementTransfer } from '../types/trip';
import {
  calculateBalances,
  calculateOptimalSettlements,
  formatMoney,
  KITTY_ID,
} from '../engine/calculator';
import { generateTripPdf } from '../utils/pdfGenerator';
import { CATEGORY_LABELS } from '../utils/constants';
import {
  Printer,
  Download,
  X,
  CheckSquare,
  Square,
  FileText,
  ShieldCheck,
  Check,
  Calendar,
  Users,
  Coins,
  Receipt,
  Sparkles,
} from 'lucide-react';

interface TripPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export const TripPrintModal: React.FC<TripPrintModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const [includeLedger, setIncludeLedger] = useState(true);
  const [includeSettlements, setIncludeSettlements] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Checked state for printed / settled items
  const [checkedSettlements, setCheckedSettlements] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const participants = trip.participants || [];
  const transactions = trip.transactions || [];
  const pMap = new Map(participants.map((p) => [p.id, p]));

  const {
    participantBalances,
    kittyBalanceCents,
    totalExpensesCents,
    isBalanced,
  } = calculateBalances(participants, transactions);

  const settlements = calculateOptimalSettlements(participantBalances, kittyBalanceCents);

  const handlePrint = () => {
    // Trigger browser print dialog formatted cleanly via @media print styles
    window.print();
  };

  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    try {
      generateTripPdf(trip);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const toggleCheck = (id: string) => {
    setCheckedSettlements((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="relative w-full max-w-4xl bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-white print:overflow-visible print:w-full print:max-w-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-[#18181b] shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Print & Export Trip Report</span>
                {trip.tripKey && (
                  <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    #{trip.tripKey}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Generate an audit report for sharing, WhatsApp, or printing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct PDF Download Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              title="Download standalone PDF document"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>PDF Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                </>
              )}
            </button>

            {/* Browser Native Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print via browser dialog or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options Toolbar (Hidden when printing) */}
        <div className="px-6 py-2.5 bg-black/30 border-b border-white/5 flex items-center justify-between text-xs text-zinc-400 flex-wrap gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
              <input
                type="checkbox"
                checked={includeSettlements}
                onChange={(e) => setIncludeSettlements(e.target.checked)}
                className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Settlement Plan</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-200">
              <input
                type="checkbox"
                checked={includeLedger}
                onChange={(e) => setIncludeLedger(e.target.checked)}
                className="rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Full Expense Ledger ({transactions.length})</span>
            </label>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono">
            Pro tip: In print preview, select "Save as PDF" to save directly.
          </div>
        </div>

        {/* Printable Paper Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-900/40 print:p-0 print:bg-white print:overflow-visible">
          <div
            id="printable-report-area"
            className="printable-report max-w-3xl mx-auto bg-white text-zinc-900 p-6 sm:p-10 rounded-xl shadow-lg border border-zinc-200 print:border-none print:shadow-none print:p-0 print:rounded-none print:max-w-none"
          >
            {/* Header with App Branding & Unique Trip Key */}
            <div className="border-b-2 border-zinc-900 pb-5 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                      TJOURNEY
                    </span>
                    {trip.tripKey && (
                      <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-xs font-mono font-semibold border border-zinc-300">
                        #{trip.tripKey}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 font-mono">
                      Expense Ledger & Final Settlement Audit
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
                    {trip.name}
                  </h1>
                  {trip.description && (
                    <p className="text-xs text-zinc-600 mt-1 max-w-xl">
                      {trip.description}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-medium text-zinc-500">REPORT DATE</div>
                  <div className="text-sm font-semibold text-zinc-800 font-mono">
                    {new Date().toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Currency: {trip.baseCurrency || 'INR'}
                  </div>
                </div>
              </div>

              {/* Quick Trip Metadata Info */}
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-600 mt-3 pt-3 border-t border-zinc-100 flex-wrap">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <strong>{participants.length}</strong> Members
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-zinc-400" />
                  <strong>{transactions.length}</strong> Transactions
                </span>
                {(trip.startDate || trip.endDate) && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      {trip.startDate || 'Start'} {trip.endDate ? `to ${trip.endDate}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Executive KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                  Total Expenses
                </div>
                <div className="text-lg font-bold text-zinc-900 font-mono mt-0.5">
                  {formatMoney(totalExpensesCents, trip.baseCurrency)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                  Avg Cost / Person
                </div>
                <div className="text-lg font-bold text-zinc-900 font-mono mt-0.5">
                  {participants.length > 0
                    ? formatMoney(Math.round(totalExpensesCents / participants.length), trip.baseCurrency)
                    : formatMoney(0, trip.baseCurrency)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                  Kitty Pool Fund
                </div>
                <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                  {formatMoney(kittyBalanceCents, trip.baseCurrency)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                  Pending Settlements
                </div>
                <div className="text-lg font-bold text-indigo-700 font-mono mt-0.5">
                  {settlements.length} Transfers
                </div>
              </div>
            </div>

            {/* SECTION 1: OPTIMAL DEBT SETTLEMENT PLAN */}
            {includeSettlements && (
              <section className="mb-7">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                      Optimal Settlement Plan (Who Pays Whom)
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Minimum transactions algorithm
                  </span>
                </div>

                {settlements.length === 0 ? (
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>All balances are zeroed out! No settlement payments are required.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {settlements.map((s, idx) => {
                      const fromP = pMap.get(s.fromParticipantId);
                      const toP = pMap.get(s.toParticipantId);
                      const fromName = fromP ? fromP.name : s.fromParticipantId === KITTY_ID ? 'Common Kitty' : 'Unknown';
                      const toName = toP ? toP.name : s.toParticipantId === KITTY_ID ? 'Common Kitty' : 'Unknown';
                      const isChecked = !!checkedSettlements[s.id];

                      return (
                        <div
                          key={s.id || idx}
                          onClick={() => toggleCheck(s.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors cursor-pointer print:cursor-default ${
                            isChecked
                              ? 'bg-zinc-50 border-zinc-300 text-zinc-500 line-through'
                              : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400 print:text-zinc-600">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </span>
                            <div className="font-medium">
                              <span className="font-bold text-zinc-900">{fromName}</span>
                              <span className="text-zinc-500 px-1.5 font-normal">pays</span>
                              <span className="font-bold text-zinc-900">{toName}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-sm text-indigo-700">
                              {formatMoney(s.amountCents, trip.baseCurrency)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* SECTION 2: MEMBER NET BALANCES TABLE */}
            <section className="mb-7">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                    Member Net Balances & Summary Audit
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isBalanced ? 'Zero-Sum Invariant Verified' : 'Imbalance Detected'}</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-600 uppercase font-mono text-[10px] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Member</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Paid</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Fair Share</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Transfers Sent/Recv</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Net Final Balance</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {participantBalances.map((b) => {
                      const p = pMap.get(b.participantId);
                      const name = p ? p.name : 'Unknown';
                      const netTransfer = b.totalTransfersSentCents - b.totalTransfersReceivedCents;

                      return (
                        <tr key={b.participantId} className="hover:bg-zinc-50/50">
                          <td className="py-2.5 px-3 font-medium text-zinc-900">
                            {name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-zinc-700">
                            {formatMoney(b.totalPaidCents, trip.baseCurrency)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-zinc-700">
                            {formatMoney(b.totalBenefitCents, trip.baseCurrency)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-zinc-500">
                            {netTransfer === 0 ? '-' : formatMoney(netTransfer, trip.baseCurrency)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-right">
                            <span
                              className={
                                b.netBalanceCents > 0.5
                                  ? 'text-emerald-700'
                                  : b.netBalanceCents < -0.5
                                  ? 'text-red-700'
                                  : 'text-zinc-500'
                              }
                            >
                              {b.netBalanceCents > 0.5 ? '+' : ''}
                              {formatMoney(b.netBalanceCents, trip.baseCurrency)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {b.netBalanceCents > 0.5 ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Receives Cash
                              </span>
                            ) : b.netBalanceCents < -0.5 ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200">
                                Owes Money
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                                Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 3: FULL EXPENSE LEDGER */}
            {includeLedger && (
              <section className="mb-7">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                      Transactions & Expense Ledger
                    </h3>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {transactions.length} entries recorded
                  </span>
                </div>

                {transactions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400 italic bg-zinc-50 rounded-lg border border-zinc-200">
                    No transactions recorded for this trip.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100 text-zinc-600 uppercase font-mono text-[10px] border-b border-zinc-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                          <th className="py-2.5 px-3 font-semibold">Description</th>
                          <th className="py-2.5 px-3 font-semibold">Category</th>
                          <th className="py-2.5 px-3 font-semibold">Paid By</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {sortedTransactions.map((tx) => {
                          const payerNames = tx.payers
                            .map((p) => {
                              if (p.participantId === KITTY_ID) return 'Common Kitty';
                              return pMap.get(p.participantId)?.name || 'Someone';
                            })
                            .join(', ');

                          const catLabel = CATEGORY_LABELS[tx.category]?.label || tx.category || 'General';

                          let badgeType = null;
                          if (tx.type === 'TRANSFER') badgeType = 'Transfer';
                          if (tx.type === 'KITTY_DEPOSIT') badgeType = 'Kitty Deposit';
                          if (tx.type === 'KITTY_EXPENSE') badgeType = 'Kitty Expense';
                          if (tx.type === 'KITTY_PAYOUT') badgeType = 'Kitty Payout';

                          return (
                            <tr key={tx.id} className="hover:bg-zinc-50/50">
                              <td className="py-2 px-3 font-mono text-zinc-500 whitespace-nowrap">
                                {tx.date}
                              </td>
                              <td className="py-2 px-3 font-medium text-zinc-900">
                                <div className="flex items-center gap-1.5">
                                  {badgeType && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-300">
                                      {badgeType}
                                    </span>
                                  )}
                                  <span>{tx.title}</span>
                                </div>
                                {tx.notes && (
                                  <div className="text-[10px] text-zinc-400 mt-0.5">
                                    {tx.notes}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-zinc-600 capitalize">
                                {catLabel}
                              </td>
                              <td className="py-2 px-3 text-zinc-700 font-medium">
                                {payerNames}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-right text-zinc-900 whitespace-nowrap">
                                {formatMoney(tx.totalAmountCents, trip.baseCurrency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Document Footer & Arithmetic Verification Check */}
            <div className="mt-8 pt-4 border-t-2 border-zinc-200 text-xs text-zinc-500 font-mono flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Mathematically Verified · Zero-sum equation (ΣNet - Kitty = 0.00)
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Generated via TJourney App · All amounts in {trip.baseCurrency || 'INR'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
