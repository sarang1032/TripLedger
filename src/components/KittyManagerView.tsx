/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Participant, Transaction, Trip } from '../types/trip';
import { formatMoney, KITTY_ID } from '../engine/calculator';
import {
  PiggyBank,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Receipt,
  Trash2,
} from 'lucide-react';

interface KittyManagerViewProps {
  trip: Trip;
  participants: Participant[];
  transactions: Transaction[];
  kittyBalanceCents: number;
  onOpenKittyModal: () => void;
  onDeleteTransaction: (id: string) => void;
}

export const KittyManagerView: React.FC<KittyManagerViewProps> = ({
  trip,
  participants,
  transactions,
  kittyBalanceCents,
  onOpenKittyModal,
  onDeleteTransaction,
}) => {
  const pMap = new Map(participants.map((p) => [p.id, p]));

  // Filter transactions related to the Common Kitty
  const kittyTxs = transactions.filter(
    (t) =>
      t.type === 'KITTY_DEPOSIT' ||
      t.type === 'KITTY_EXPENSE' ||
      t.type === 'KITTY_PAYOUT' ||
      t.payers.some((p) => p.participantId === KITTY_ID)
  );

  const totalDepositedCents = transactions
    .filter((t) => t.type === 'KITTY_DEPOSIT')
    .reduce((sum, t) => sum + t.totalAmountCents, 0);

  const totalSpentCents = transactions
    .filter((t) => t.type === 'KITTY_EXPENSE' || t.payers.some((p) => p.participantId === KITTY_ID))
    .reduce((sum, t) => sum + t.totalAmountCents, 0);

  const totalPaidOutCents = transactions
    .filter((t) => t.type === 'KITTY_PAYOUT')
    .reduce((sum, t) => sum + t.totalAmountCents, 0);

  return (
    <div className="space-y-6">
      {/* Top Pool Overview Card */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
              <span className="label">
                Common Cash Kitty / Group Reserve
              </span>
            </div>
            <h3 className="text-3xl font-light font-mono text-emerald-400">
              {formatMoney(kittyBalanceCents, trip.baseCurrency)}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl">
              Cash pool held for shared incidental expenses (taxis, road tolls, snacks, drinks). Invariant arithmetic accounts for member prepayments automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenKittyModal}
            className="btn flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record Kitty Action</span>
          </button>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs font-mono">
          <div>
            <div className="label">Deposited</div>
            <div className="font-normal text-sm sm:text-base text-zinc-200 mt-1 truncate">
              {formatMoney(totalDepositedCents, trip.baseCurrency)}
            </div>
          </div>
          <div>
            <div className="label">Spent</div>
            <div className="font-normal text-sm sm:text-base text-zinc-200 mt-1 truncate">
              {formatMoney(totalSpentCents, trip.baseCurrency)}
            </div>
          </div>
          <div>
            <div className="label">Refunded</div>
            <div className="font-normal text-sm sm:text-base text-zinc-200 mt-1 truncate">
              {formatMoney(totalPaidOutCents, trip.baseCurrency)}
            </div>
          </div>
        </div>
      </div>

      {/* Member Contributions Summary */}
      <div className="card p-5 sm:p-6 space-y-3">
        <h4 className="label">
          Cash Put into Kitty per Member
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {participants.map((p) => {
            const deposited = transactions
              .filter(
                (t) =>
                  t.type === 'KITTY_DEPOSIT' &&
                  t.payers.some((payer) => payer.participantId === p.id)
              )
              .reduce((sum, t) => sum + t.totalAmountCents, 0);

            return (
              <div
                key={p.id}
                className="p-3 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate mr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.avatarColor }}
                  />
                  <span className="text-xs font-medium text-zinc-200 truncate">{p.name}</span>
                </div>
                <span className="text-xs font-mono font-medium text-zinc-100 shrink-0">
                  {formatMoney(deposited, trip.baseCurrency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kitty Transaction Ledger */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-[#F8F7F4]">
              Kitty Ledger Audit History ({kittyTxs.length} items)
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Every deposit, common disbursement, and residual refund tracked in sequence.
            </p>
          </div>
        </div>

        {kittyTxs.length === 0 ? (
          <div className="text-center py-10 bg-white/[0.02] rounded-lg border border-dashed border-white/10 space-y-2">
            <Receipt className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-medium text-[#F8F7F4]">No Kitty Activity Yet</p>
            <p className="text-xs text-zinc-500">
              Collect initial pooled cash from members to start paying from the common fund.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {kittyTxs.map((tx) => {
              const isDeposit = tx.type === 'KITTY_DEPOSIT';
              const isPayout = tx.type === 'KITTY_PAYOUT';

              const payerName =
                tx.payers[0]?.participantId === KITTY_ID
                  ? 'Common Kitty'
                  : pMap.get(tx.payers[0]?.participantId)?.name || 'Someone';

              return (
                <div
                  key={tx.id}
                  className="p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/10 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isDeposit
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isPayout
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {isDeposit ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : isPayout ? (
                        <RotateCcw className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium text-zinc-200 truncate">{tx.title}</div>
                      <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5 flex-wrap">
                        <span>{tx.date}</span>
                        <span>·</span>
                        <span>
                          {isDeposit
                            ? `Contributed by ${payerName}`
                            : isPayout
                            ? `Refunded to ${pMap.get(tx.splitShares[0]?.participantId)?.name || 'Member'}`
                            : `Paid from Kitty (${tx.splitShares.length} shares)`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-mono text-sm ${
                        isDeposit ? 'text-emerald-400' : 'text-zinc-200'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {formatMoney(tx.totalAmountCents, trip.baseCurrency)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTransaction(tx.id);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      title="Delete Transaction"
                      aria-label="Delete Transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
