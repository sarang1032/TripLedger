/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Participant, Transaction, Trip } from '../types/trip';
import {
  formatMoney,
  generateArithmeticExplanation,
  calculateBalances,
} from '../engine/calculator';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface ArithmeticAuditViewProps {
  trip: Trip;
  participants: Participant[];
  transactions: Transaction[];
}

export const ArithmeticAuditView: React.FC<ArithmeticAuditViewProps> = ({
  trip,
  participants,
  transactions,
}) => {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    participants[0]?.id || ''
  );

  const { isBalanced, totalImbalanceCents } = calculateBalances(
    participants,
    transactions
  );

  const explanation = selectedParticipantId
    ? generateArithmeticExplanation(selectedParticipantId, participants, transactions)
    : null;

  const currentParticipant = participants.find((p) => p.id === selectedParticipantId);

  return (
    <div className="space-y-6">
      {/* Mathematical Integrity Status Banner */}
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isBalanced ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {isBalanced ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-[#F8F7F4]">
                Mathematical Ledger Integrity
              </h3>
              <span
                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                  isBalanced
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {isBalanced ? 'Zero Imbalance (Verified)' : 'Imbalance Detected'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Invariant: ∑ Net Balances − Kitty Balance ≡ 0.00. Current Drift: {totalImbalanceCents}¢.
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-zinc-400 bg-white/[0.02] px-3.5 py-2 rounded-lg border border-white/10 flex items-center gap-3">
          <div>
            <span className="text-zinc-500">Total Tx: </span>
            <span className="font-semibold text-zinc-200">{transactions.length}</span>
          </div>
          <span>·</span>
          <div>
            <span className="text-zinc-500">Members: </span>
            <span className="font-semibold text-zinc-200">{participants.length}</span>
          </div>
        </div>
      </div>

      {/* Participant Selector */}
      <div className="space-y-2">
        <label className="label">
          Select Member for Step-by-Step Arithmetic Proof
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {participants.map((p) => {
            const isSelected = p.id === selectedParticipantId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedParticipantId(p.id)}
                className={`p-3 rounded-lg border text-left transition-colors flex items-center gap-2.5 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-xs'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-zinc-300'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.avatarColor }}
                />
                <span className="text-xs font-medium truncate">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arithmetic Proof Breakdown */}
      {explanation && currentParticipant && (
        <div className="card p-5 sm:p-6 space-y-6">
          {/* Header & Formula Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-medium text-[#F8F7F4]">
                  Calculation Breakdown for {currentParticipant.name}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Every debit, credit, and intermediate transfer audited with zero hidden variables.
                </p>
              </div>
              <div
                className={`text-base font-normal font-mono px-3 py-1 rounded-lg border ${
                  explanation.netBalanceCents > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : explanation.netBalanceCents < 0
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-white/5 text-zinc-300 border-white/10'
                }`}
              >
                Net:{' '}
                {explanation.netBalanceCents >= 0 ? '+' : ''}
                {formatMoney(explanation.netBalanceCents, trip.baseCurrency)}
              </div>
            </div>

            {/* Formula Block */}
            <div className="p-3.5 bg-black/50 border border-white/10 text-zinc-200 rounded-lg text-xs font-mono overflow-x-auto">
              <div className="label mb-1">Formal Net Balance Invariant Formula</div>
              <div className="text-indigo-300">{explanation.formulaString}</div>
            </div>
          </div>

          {/* 4 Quadrants: Expenses Paid vs Benefited, Transfers Sent vs Received */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. What they Paid Out of Pocket */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-medium text-zinc-300">
                  (+) Expenses Paid Out of Pocket
                </span>
                <span className="text-xs font-mono font-normal text-emerald-400">
                  {formatMoney(
                    explanation.paidTransactions.reduce((acc, t) => acc + t.paidCents, 0),
                    trip.baseCurrency
                  )}
                </span>
              </div>

              {explanation.paidTransactions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic font-mono">No direct expenses paid.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {explanation.paidTransactions.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-white/[0.03] p-2 rounded border border-white/5"
                    >
                      <div className="truncate mr-2">
                        <span className="font-medium text-zinc-200">{t.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono ml-1.5">{t.date}</span>
                      </div>
                      <span className="font-mono text-zinc-100 shrink-0">
                        {formatMoney(t.paidCents, trip.baseCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Fair Share Benefited From */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-medium text-zinc-300">
                  (-) Allocated Fair Benefit Share
                </span>
                <span className="text-xs font-mono font-normal text-red-400">
                  {formatMoney(
                    explanation.benefitedTransactions.reduce((acc, t) => acc + t.shareCents, 0),
                    trip.baseCurrency
                  )}
                </span>
              </div>

              {explanation.benefitedTransactions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic font-mono">No shared expenses consumed.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {explanation.benefitedTransactions.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-white/[0.03] p-2 rounded border border-white/5"
                    >
                      <div className="truncate mr-2">
                        <span className="font-medium text-zinc-200">{t.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono ml-1.5">
                          ({t.splitMethod.toLowerCase()})
                        </span>
                      </div>
                      <span className="font-mono text-zinc-100 shrink-0">
                        {formatMoney(t.shareCents, trip.baseCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Interim Transfers Sent */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-medium text-zinc-300">
                  (+) Repayments Sent (UPI / Cash)
                </span>
                <span className="text-xs font-mono font-normal text-emerald-400">
                  {formatMoney(
                    explanation.transfersSent.reduce((acc, t) => acc + t.amountCents, 0),
                    trip.baseCurrency
                  )}
                </span>
              </div>

              {explanation.transfersSent.length === 0 ? (
                <p className="text-xs text-zinc-500 italic font-mono">No interim transfers sent.</p>
              ) : (
                <div className="space-y-1.5">
                  {explanation.transfersSent.map((t, idx) => {
                    const toName =
                      participants.find((p) => p.id === t.toParticipantId)?.name || 'Member';
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white/[0.03] p-2 rounded border border-white/5"
                      >
                        <div className="truncate mr-2">
                          <span className="font-medium text-zinc-200">Sent to {toName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono ml-1.5">{t.date}</span>
                        </div>
                        <span className="font-mono text-zinc-100 shrink-0">
                          {formatMoney(t.amountCents, trip.baseCurrency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Interim Transfers Received */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-medium text-zinc-300">
                  (-) Repayments Received
                </span>
                <span className="text-xs font-mono font-normal text-red-400">
                  {formatMoney(
                    explanation.transfersReceived.reduce((acc, t) => acc + t.amountCents, 0),
                    trip.baseCurrency
                  )}
                </span>
              </div>

              {explanation.transfersReceived.length === 0 ? (
                <p className="text-xs text-zinc-500 italic font-mono">No interim transfers received.</p>
              ) : (
                <div className="space-y-1.5">
                  {explanation.transfersReceived.map((t, idx) => {
                    const fromName =
                      participants.find((p) => p.id === t.fromParticipantId)?.name || 'Member';
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white/[0.03] p-2 rounded border border-white/5"
                      >
                        <div className="truncate mr-2">
                          <span className="font-medium text-zinc-200">Received from {fromName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono ml-1.5">{t.date}</span>
                        </div>
                        <span className="font-mono text-zinc-100 shrink-0">
                          {formatMoney(t.amountCents, trip.baseCurrency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
