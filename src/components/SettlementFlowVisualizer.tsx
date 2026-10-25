/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Participant, ParticipantBalance, SettlementTransfer, Trip } from '../types/trip';
import { formatMoney, KITTY_ID } from '../engine/calculator';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Printer,
} from 'lucide-react';

interface SettlementFlowVisualizerProps {
  trip: Trip;
  participants: Participant[];
  balances: ParticipantBalance[];
  settlements: SettlementTransfer[];
  kittyBalanceCents: number;
  onRecordSettlement: (settlement: SettlementTransfer) => void;
  onUndoSettlement?: (settlementId: string) => void;
  onOpenPrintModal?: () => void;
}

export const SettlementFlowVisualizer: React.FC<SettlementFlowVisualizerProps> = ({
  trip,
  participants,
  balances,
  settlements,
  kittyBalanceCents,
  onRecordSettlement,
  onOpenPrintModal,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const pMap = new Map(participants.map((p) => [p.id, p]));
  const getName = (id: string) => {
    if (id === KITTY_ID) return 'Common Cash Kitty';
    return pMap.get(id)?.name || 'Unknown';
  };
  const getAvatarColor = (id: string) => {
    if (id === KITTY_ID) return '#10b981';
    return pMap.get(id)?.avatarColor || '#64748b';
  };

  // Generate WhatsApp / text formatted group settlement summary
  const generateGroupSummaryText = (): string => {
    let text = `✈️ ${trip.name} — Settlement Summary\n`;
    text += `Base Currency: ${trip.baseCurrency}\n`;
    text += `------------------------------------\n\n`;

    text += `📊 NET BALANCES:\n`;
    balances.forEach((b) => {
      const name = getName(b.participantId);
      const isOwed = b.netBalanceCents > 0;
      const isEven = Math.abs(b.netBalanceCents) <= 0.1;
      if (isEven) {
        text += `• ${name}: Settled up (₹0.00)\n`;
      } else if (isOwed) {
        text += `• ${name}: Gets back ${formatMoney(b.netBalanceCents, trip.baseCurrency)}\n`;
      } else {
        text += `• ${name}: Owes ${formatMoney(Math.abs(b.netBalanceCents), trip.baseCurrency)}\n`;
      }
    });

    if (kittyBalanceCents !== 0) {
      text += `• Common Kitty Fund remaining: ${formatMoney(kittyBalanceCents, trip.baseCurrency)}\n`;
    }

    text += `\n🎯 MINIMUM SETTLEMENT PAYMENTS (${settlements.length} transfers):\n`;
    if (settlements.length === 0) {
      text += `All balances are settled! No payments needed 🎉\n`;
    } else {
      settlements.forEach((s, idx) => {
        const from = getName(s.fromParticipantId);
        const to = getName(s.toParticipantId);
        const amt = formatMoney(s.amountCents, trip.baseCurrency);
        const status = s.isSettled ? ' [DONE ✅]' : '';
        text += `${idx + 1}. ${from} ➡️ send ${amt} to ${to}${status}\n`;
      });
    }

    text += `\nCalculated mathematically with zero rounding loss via TJourney.`;
    return text;
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(generateGroupSummaryText());
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopySingleTransfer = (s: SettlementTransfer) => {
    const from = getName(s.fromParticipantId);
    const to = getName(s.toParticipantId);
    const amt = formatMoney(s.amountCents, trip.baseCurrency);
    const text = `Hey ${from}! For our trip "${trip.name}", please send ${amt} to ${to}.`;
    navigator.clipboard.writeText(text);
    setCopiedRowId(s.id);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-[#F8F7F4]">
              Optimal Debt Settlement Plan
            </h3>
            <span className="text-[10px] font-mono uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              Greedy Bipartite Reduction
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Calculates the minimum set of transfers required so everyone is square to the exact cent.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenPrintModal && (
            <button
              type="button"
              onClick={onOpenPrintModal}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-mono font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Print to PDF or generate document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print to PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-mono font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            {copiedSummary ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>{copiedSummary ? 'Copied Summary!' : 'Copy Chat Summary'}</span>
          </button>
        </div>
      </div>

      {/* Participants Net Balance Cards */}
      <div className="space-y-2">
        <h4 className="label">
          Individual Net Balances
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {balances.map((b) => {
            const p = pMap.get(b.participantId);
            const isOwed = b.netBalanceCents > 0.1;
            const owes = b.netBalanceCents < -0.1;

            return (
              <div
                key={b.participantId}
                className="card p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p?.avatarColor || '#64748b' }}
                    />
                    <span className="font-medium text-xs text-[#F8F7F4] truncate">
                      {p?.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      isOwed
                        ? 'text-emerald-400'
                        : owes
                        ? 'text-red-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {isOwed ? 'Gets back' : owes ? 'Owes' : 'Settled'}
                  </span>
                </div>

                <div className="mt-3">
                  <div
                    className={`text-xl font-normal font-mono ${
                      isOwed
                        ? 'text-emerald-400'
                        : owes
                        ? 'text-red-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {isOwed ? '+' : owes ? '-' : ''}
                    {formatMoney(Math.abs(b.netBalanceCents), trip.baseCurrency)}
                  </div>

                  <div className="mt-2 text-[11px] font-mono text-zinc-400 space-y-0.5 border-t border-white/10 pt-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Paid:</span>
                      <span className="text-zinc-300">
                        {formatMoney(b.totalPaidCents, trip.baseCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Share:</span>
                      <span className="text-zinc-300">
                        {formatMoney(b.totalBenefitCents, trip.baseCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Settlement Transfers List */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-[#F8F7F4]">
              Transfer Checklist ({settlements.length} payments)
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Follow these exact transfers to eliminate all outstanding debts.
            </p>
          </div>
        </div>

        {settlements.length === 0 ? (
          <div className="text-center py-10 bg-white/[0.02] rounded-lg border border-dashed border-white/10 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-[#F8F7F4]">Trip is Fully Settled</p>
            <p className="text-xs text-zinc-500">
              All participant balances are zero and no payments are outstanding.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {settlements.map((s, idx) => {
              const fromName = getName(s.fromParticipantId);
              const toName = getName(s.toParticipantId);
              const fromColor = getAvatarColor(s.fromParticipantId);
              const toColor = getAvatarColor(s.toParticipantId);
              const isDone = s.isSettled;

              return (
                <div
                  key={s.id || idx}
                  className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isDone
                      ? 'bg-white/[0.01] border-white/5 opacity-50'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Parties & Amount */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-500 w-5">
                      #{idx + 1}
                    </span>

                    {/* From Person */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: fromColor }}
                      />
                      <span className="text-xs font-medium text-zinc-200">{fromName}</span>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />

                    {/* To Person */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: toColor }}
                      />
                      <span className="text-xs font-medium text-zinc-200">{toName}</span>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <span className="text-sm font-mono font-normal text-[#F8F7F4]">
                      {formatMoney(s.amountCents, trip.baseCurrency)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopySingleTransfer(s)}
                        title="Copy payment message"
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors text-xs flex items-center gap-1 font-mono"
                      >
                        {copiedRowId === s.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px]">Copy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRecordSettlement(s)}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'btn'
                        }`}
                      >
                        {isDone ? 'Settled' : 'Record Paid'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Debt Flow Routing */}
      <div className="card p-5 space-y-3">
        <h4 className="label">
          Debt Flow Routing
        </h4>
        <div className="p-3 sm:p-4 bg-white/[0.02] rounded-lg border border-white/10 space-y-3">
          <div className="hidden sm:flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>Debtors (Who Pays)</span>
            <span>Settlement Vector</span>
            <span>Creditors (Who Receives)</span>
          </div>

          <div className="space-y-2">
            {settlements.map((s, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-black/40 p-3 rounded-lg border border-white/5"
              >
                <div className="flex items-center justify-between sm:justify-start gap-1.5 font-medium text-red-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getAvatarColor(s.fromParticipantId) }}
                    />
                    <span className="truncate">{getName(s.fromParticipantId)}</span>
                  </div>
                  <span className="sm:hidden text-[10px] text-zinc-500 font-mono">pays</span>
                </div>

                <div className="flex items-center justify-center gap-2 my-0.5 sm:my-0 sm:flex-1 sm:mx-4">
                  <div className="hidden sm:block h-[1px] flex-1 bg-white/10 border-t border-dashed border-white/20" />
                  <span className="font-mono text-zinc-100 bg-white/10 px-2.5 py-1 rounded text-xs border border-white/10">
                    {formatMoney(s.amountCents, trip.baseCurrency)}
                  </span>
                  <div className="hidden sm:block h-[1px] flex-1 bg-white/10 border-t border-dashed border-white/20" />
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-1.5 font-medium text-emerald-400">
                  <span className="sm:hidden text-[10px] text-zinc-500 font-mono">to</span>
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: getAvatarColor(s.toParticipantId) }}
                    />
                    <span className="truncate">{getName(s.toParticipantId)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
