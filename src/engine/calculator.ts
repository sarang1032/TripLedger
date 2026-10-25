/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CalculationExplanation,
  ItemizedItem,
  Participant,
  ParticipantBalance,
  PayerContribution,
  SettlementTransfer,
  SplitMethod,
  SplitParticipantShare,
  Transaction,
} from '../types/trip';

export const KITTY_ID = 'COMMON_KITTY_FUND';

/**
 * Currency utilities: converts dollars / units to exact integer cents
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatMoney(cents: number, currency = 'INR'): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents) / 100;
  
  // Format with Indian Rupee numbering system
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sym = currency === 'INR' ? '₹' : (currency ? `${currency} ` : '₹');
  return `${isNegative ? '-' : ''}${sym}${formatted}`;
}

/**
 * Distribute remainder cents deterministically.
 * When splitting e.g. $100.00 among 3 participants:
 * Base share = 3333 cents * 3 = 9999 cents.
 * Remainder = 1 cent.
 * We add 1 cent to the first 'remainder' participants so sum === totalAmountCents.
 */
export function distributeRemainderCents(
  baseCents: number,
  remainderCents: number,
  count: number
): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(baseCents + (i < remainderCents ? 1 : 0));
  }
  return result;
}

/**
 * Calculate Equal Split among specified participants
 */
export function calculateEqualShares(
  totalCents: number,
  participantIds: string[]
): SplitParticipantShare[] {
  if (participantIds.length === 0) return [];
  const count = participantIds.length;
  const baseShare = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return participantIds.map((id, index) => ({
    participantId: id,
    calculatedCents: baseShare + (index < remainder ? 1 : 0),
    shareValue: 1,
  }));
}

/**
 * Calculate Shares / Weights Split (e.g. couples = 2 shares, kids = 0.5 shares)
 */
export function calculateWeightedShares(
  totalCents: number,
  participantsWithShares: { participantId: string; shares: number }[]
): SplitParticipantShare[] {
  const active = participantsWithShares.filter((p) => p.shares > 0);
  if (active.length === 0) return [];

  const totalShares = active.reduce((sum, p) => sum + p.shares, 0);
  if (totalShares <= 0) return [];

  let allocated = 0;
  const initial = active.map((p) => {
    // Floor calculation
    const exact = (totalCents * p.shares) / totalShares;
    const rounded = Math.floor(exact);
    allocated += rounded;
    return {
      participantId: p.participantId,
      calculatedCents: rounded,
      shareValue: p.shares,
      fractionalPart: exact - rounded,
    };
  });

  // Distribute remaining cents by highest fractional part
  let remainder = totalCents - allocated;
  initial.sort((a, b) => b.fractionalPart - a.fractionalPart);

  for (let i = 0; i < remainder; i++) {
    initial[i % initial.length].calculatedCents += 1;
  }

  return initial.map((item) => ({
    participantId: item.participantId,
    calculatedCents: item.calculatedCents,
    shareValue: item.shareValue,
  }));
}

/**
 * Calculate Percentage Split
 */
export function calculatePercentShares(
  totalCents: number,
  participantsWithPercents: { participantId: string; percent: number }[]
): { shares: SplitParticipantShare[]; isValid: boolean; sumPercent: number } {
  const active = participantsWithPercents.filter((p) => p.percent > 0);
  const sumPercent = participantsWithPercents.reduce((sum, p) => sum + p.percent, 0);
  const isValid = Math.abs(sumPercent - 100) < 0.01;

  if (active.length === 0) {
    return { shares: [], isValid: false, sumPercent };
  }

  let allocated = 0;
  const initial = active.map((p) => {
    const exact = (totalCents * p.percent) / 100;
    const rounded = Math.floor(exact);
    allocated += rounded;
    return {
      participantId: p.participantId,
      calculatedCents: rounded,
      shareValue: p.percent,
      fractionalPart: exact - rounded,
    };
  });

  let remainder = totalCents - allocated;
  initial.sort((a, b) => b.fractionalPart - a.fractionalPart);

  for (let i = 0; i < remainder && i < initial.length; i++) {
    initial[i].calculatedCents += 1;
  }

  return {
    shares: initial.map((item) => ({
      participantId: item.participantId,
      calculatedCents: item.calculatedCents,
      shareValue: item.shareValue,
    })),
    isValid,
    sumPercent,
  };
}

/**
 * Calculate Itemized Split
 */
export function calculateItemizedShares(
  items: ItemizedItem[]
): SplitParticipantShare[] {
  const shareMap: Record<string, number> = {};

  for (const item of items) {
    if (item.assignedParticipantIds.length === 0 || item.amountCents <= 0) continue;
    const count = item.assignedParticipantIds.length;
    const base = Math.floor(item.amountCents / count);
    const rem = item.amountCents % count;

    item.assignedParticipantIds.forEach((pId, idx) => {
      const share = base + (idx < rem ? 1 : 0);
      shareMap[pId] = (shareMap[pId] || 0) + share;
    });
  }

  return Object.entries(shareMap).map(([participantId, calculatedCents]) => ({
    participantId,
    calculatedCents,
  }));
}

/**
 * Validate an Expense before committing
 */
export function validateExpense(
  totalCents: number,
  payers: PayerContribution[],
  splitShares: SplitParticipantShare[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (totalCents <= 0) {
    errors.push('Total expense amount must be greater than zero.');
  }

  const totalPaid = payers.reduce((sum, p) => sum + p.amountCents, 0);
  if (totalPaid !== totalCents) {
    const diff = (totalCents - totalPaid) / 100;
    errors.push(
      `Payer contributions (₹${(totalPaid / 100).toFixed(2)}) do not match total expense (₹${(totalCents / 100).toFixed(2)}). Difference: ₹${diff.toFixed(2)}`
    );
  }

  const totalShares = splitShares.reduce((sum, s) => sum + s.calculatedCents, 0);
  if (totalShares !== totalCents) {
    const diff = (totalCents - totalShares) / 100;
    errors.push(
      `Participant split shares (₹${(totalShares / 100).toFixed(2)}) do not equal total expense (₹${(totalCents / 100).toFixed(2)}). Difference: ₹${diff.toFixed(2)}`
    );
  }

  if (payers.length === 0) {
    errors.push('At least one payer must be specified.');
  }

  if (splitShares.length === 0) {
    errors.push('At least one person must share in the expense.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate Net Balances for each participant and the Common Kitty
 */
export function calculateBalances(
  participants: Participant[],
  transactions: Transaction[]
): {
  participantBalances: ParticipantBalance[];
  kittyBalanceCents: number;
  totalExpensesCents: number;
  isBalanced: boolean;
  totalImbalanceCents: number;
} {
  const balances: Record<string, ParticipantBalance> = {};

  participants.forEach((p) => {
    balances[p.id] = {
      participantId: p.id,
      totalPaidCents: 0,
      totalBenefitCents: 0,
      totalTransfersSentCents: 0,
      totalTransfersReceivedCents: 0,
      kittyDepositsCents: 0,
      kittyPayoutsCents: 0,
      netBalanceCents: 0,
    };
  });

  let kittyBalanceCents = 0;
  let totalExpensesCents = 0;

  for (const tx of transactions) {
    // Convert to base currency cents
    const baseCents = tx.totalAmountCents;

    switch (tx.type) {
      case 'EXPENSE': {
        totalExpensesCents += baseCents;

        // Credit payers
        for (const payer of tx.payers) {
          if (payer.participantId === KITTY_ID) {
            kittyBalanceCents -= payer.amountCents;
          } else if (balances[payer.participantId]) {
            balances[payer.participantId].totalPaidCents += payer.amountCents;
          }
        }

        // Debit beneficiaries
        for (const share of tx.splitShares) {
          if (balances[share.participantId]) {
            balances[share.participantId].totalBenefitCents += share.calculatedCents;
          }
        }
        break;
      }

      case 'KITTY_DEPOSIT': {
        // Participant puts cash into kitty
        for (const payer of tx.payers) {
          if (balances[payer.participantId]) {
            balances[payer.participantId].kittyDepositsCents += payer.amountCents;
            balances[payer.participantId].totalPaidCents += payer.amountCents;
          }
          kittyBalanceCents += payer.amountCents;
        }
        break;
      }

      case 'KITTY_EXPENSE': {
        totalExpensesCents += baseCents;
        kittyBalanceCents -= baseCents;

        // Debit beneficiaries who benefited from kitty expense
        for (const share of tx.splitShares) {
          if (balances[share.participantId]) {
            balances[share.participantId].totalBenefitCents += share.calculatedCents;
          }
        }
        break;
      }

      case 'TRANSFER': {
        // Direct mid-trip repayment between two people
        // payers[0] paid, splitShares[0] received
        const sender = tx.payers[0];
        const receiver = tx.splitShares[0];

        if (sender && receiver) {
          if (balances[sender.participantId]) {
            balances[sender.participantId].totalTransfersSentCents += baseCents;
          }
          if (balances[receiver.participantId]) {
            balances[receiver.participantId].totalTransfersReceivedCents += baseCents;
          }
        }
        break;
      }

      case 'KITTY_PAYOUT': {
        // Leftover kitty cash given back to participants
        kittyBalanceCents -= baseCents;
        for (const share of tx.splitShares) {
          if (balances[share.participantId]) {
            balances[share.participantId].kittyPayoutsCents += share.calculatedCents;
            balances[share.participantId].totalBenefitCents += share.calculatedCents;
          }
        }
        break;
      }
    }
  }

  // Compute final net balance for each person
  // Net Balance = (Total Paid + Transfers Sent) - (Total Benefit + Transfers Received)
  // Positive = person paid MORE than their fair share, so other people owe them (+).
  // Negative = person paid LESS than their fair share, so they owe money (-).
  const participantBalances: ParticipantBalance[] = Object.values(balances).map((b) => {
    const net =
      b.totalPaidCents +
      b.totalTransfersSentCents -
      (b.totalBenefitCents + b.totalTransfersReceivedCents);

    return {
      ...b,
      netBalanceCents: net,
    };
  });

  // Verification check: sum of all net balances minus remaining kitty balance should equal exactly 0!
  // Invariant: Total net owed to participants (sumNet) equals physical cash remaining in kitty (kittyBalanceCents)
  const sumNet = participantBalances.reduce((sum, b) => sum + b.netBalanceCents, 0);
  const totalImbalanceCents = sumNet - kittyBalanceCents;
  const isBalanced = Math.abs(totalImbalanceCents) === 0;

  return {
    participantBalances,
    kittyBalanceCents,
    totalExpensesCents,
    isBalanced,
    totalImbalanceCents,
  };
}

/**
 * Optimal Debt Simplification (Greedy Min-Cash-Flow algorithm with Exact-Match heuristic)
 * Finds the minimum number of settlements required so all balances are zeroed out.
 */
export function calculateOptimalSettlements(
  participantBalances: ParticipantBalance[],
  kittyBalanceCents = 0
): SettlementTransfer[] {
  // Deep clone to avoid mutating input
  // Debtor: netBalance < 0 (owes money / sends funds)
  // Creditor: netBalance > 0 (is owed money / receives funds)
  interface Account {
    id: string;
    balance: number; // positive = creditor, negative = debtor
  }

  const debtors: Account[] = [];
  const creditors: Account[] = [];

  for (const b of participantBalances) {
    if (b.netBalanceCents < -0.1) {
      debtors.push({ id: b.participantId, balance: Math.abs(b.netBalanceCents) });
    } else if (b.netBalanceCents > 0.1) {
      creditors.push({ id: b.participantId, balance: b.netBalanceCents });
    }
  }

  // If there is leftover kitty cash (positive), kitty holds cash to PAY OUT to creditors (acts as fund debtor/payer)
  if (kittyBalanceCents > 0) {
    debtors.push({ id: KITTY_ID, balance: kittyBalanceCents });
  } else if (kittyBalanceCents < 0) {
    // If kitty was overdrawn, kitty needs to RECEIVE funds (acts as creditor)
    creditors.push({ id: KITTY_ID, balance: Math.abs(kittyBalanceCents) });
  }

  const settlements: SettlementTransfer[] = [];

  // Pass 1: Exact matches (1-to-1 matching) - minimizes transactions
  for (let i = debtors.length - 1; i >= 0; i--) {
    const d = debtors[i];
    const matchIdx = creditors.findIndex((c) => c.balance === d.balance);
    if (matchIdx !== -1) {
      const c = creditors[matchIdx];
      settlements.push({
        id: `settle-${d.id}-${c.id}-${d.balance}`,
        fromParticipantId: d.id,
        toParticipantId: c.id,
        amountCents: d.balance,
        isSettled: false,
      });
      debtors.splice(i, 1);
      creditors.splice(matchIdx, 1);
    }
  }

  // Pass 2: Greedy matching of largest debtor to largest creditor
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const largestDebtor = debtors[0];
    const largestCreditor = creditors[0];

    const transferAmount = Math.min(largestDebtor.balance, largestCreditor.balance);

    settlements.push({
      id: `settle-${largestDebtor.id}-${largestCreditor.id}-${transferAmount}-${settlements.length}`,
      fromParticipantId: largestDebtor.id,
      toParticipantId: largestCreditor.id,
      amountCents: transferAmount,
      isSettled: false,
    });

    largestDebtor.balance -= transferAmount;
    largestCreditor.balance -= transferAmount;

    if (largestDebtor.balance <= 0) {
      debtors.shift();
    }
    if (largestCreditor.balance <= 0) {
      creditors.shift();
    }
  }

  return settlements;
}

/**
 * Generate transparent step-by-step arithmetic explanation for a specific participant
 */
export function generateArithmeticExplanation(
  participantId: string,
  participants: Participant[],
  transactions: Transaction[]
): CalculationExplanation {
  const pMap = new Map(participants.map((p) => [p.id, p.name]));
  const pName = pMap.get(participantId) || 'Participant';

  const paidTransactions: CalculationExplanation['paidTransactions'] = [];
  const benefitedTransactions: CalculationExplanation['benefitedTransactions'] = [];
  const transfersSent: CalculationExplanation['transfersSent'] = [];
  const transfersReceived: CalculationExplanation['transfersReceived'] = [];
  let kittyContributionsCents = 0;
  let kittyPayoutsCents = 0;

  for (const tx of transactions) {
    if (tx.type === 'EXPENSE') {
      const payerEntry = tx.payers.find((p) => p.participantId === participantId);
      if (payerEntry && payerEntry.amountCents > 0) {
        paidTransactions.push({
          transactionId: tx.id,
          title: tx.title,
          date: tx.date,
          paidCents: payerEntry.amountCents,
          category: tx.category,
        });
      }

      const shareEntry = tx.splitShares.find((s) => s.participantId === participantId);
      if (shareEntry && shareEntry.calculatedCents > 0) {
        benefitedTransactions.push({
          transactionId: tx.id,
          title: tx.title,
          date: tx.date,
          shareCents: shareEntry.calculatedCents,
          splitMethod: tx.splitMethod,
          totalExpenseCents: tx.totalAmountCents,
        });
      }
    } else if (tx.type === 'KITTY_DEPOSIT') {
      const payerEntry = tx.payers.find((p) => p.participantId === participantId);
      if (payerEntry && payerEntry.amountCents > 0) {
        kittyContributionsCents += payerEntry.amountCents;
      }
    } else if (tx.type === 'KITTY_EXPENSE') {
      const shareEntry = tx.splitShares.find((s) => s.participantId === participantId);
      if (shareEntry && shareEntry.calculatedCents > 0) {
        benefitedTransactions.push({
          transactionId: tx.id,
          title: `[Kitty] ${tx.title}`,
          date: tx.date,
          shareCents: shareEntry.calculatedCents,
          splitMethod: tx.splitMethod,
          totalExpenseCents: tx.totalAmountCents,
        });
      }
    } else if (tx.type === 'TRANSFER') {
      const sender = tx.payers[0];
      const receiver = tx.splitShares[0];

      if (sender?.participantId === participantId && receiver) {
        transfersSent.push({
          toParticipantId: receiver.participantId,
          amountCents: tx.totalAmountCents,
          title: tx.title,
          date: tx.date,
        });
      } else if (receiver?.participantId === participantId && sender) {
        transfersReceived.push({
          fromParticipantId: sender.participantId,
          amountCents: tx.totalAmountCents,
          title: tx.title,
          date: tx.date,
        });
      }
    } else if (tx.type === 'KITTY_PAYOUT') {
      const shareEntry = tx.splitShares.find((s) => s.participantId === participantId);
      if (shareEntry && shareEntry.calculatedCents > 0) {
        kittyPayoutsCents += shareEntry.calculatedCents;
      }
    }
  }

  const totalPaid = paidTransactions.reduce((acc, t) => acc + t.paidCents, 0) + kittyContributionsCents;
  const totalBenefited = benefitedTransactions.reduce((acc, t) => acc + t.shareCents, 0) + kittyPayoutsCents;
  const totalSent = transfersSent.reduce((acc, t) => acc + t.amountCents, 0);
  const totalReceived = transfersReceived.reduce((acc, t) => acc + t.amountCents, 0);

  const netBalanceCents = totalPaid + totalSent - (totalBenefited + totalReceived);

  const formulaString = `Net Balance = (Paid: ${formatMoney(totalPaid)} + Sent: ${formatMoney(totalSent)}) - (Fair Share: ${formatMoney(totalBenefited)} + Received: ${formatMoney(totalReceived)}) = ${formatMoney(netBalanceCents)}`;

  return {
    participantId,
    paidTransactions,
    benefitedTransactions,
    transfersSent,
    transfersReceived,
    kittyContributionsCents,
    kittyPayoutsCents,
    formulaString,
    netBalanceCents,
  };
}
