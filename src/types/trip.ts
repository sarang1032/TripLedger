/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SplitMethod = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES' | 'ITEMIZED';

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'lodging'
  | 'activity'
  | 'groceries'
  | 'fuel'
  | 'entertainment'
  | 'shopping'
  | 'general'
  | (string & {});

export type TransactionType =
  | 'EXPENSE'         // Standard expense paid by one or more participants
  | 'KITTY_DEPOSIT'   // A participant contributes cash to the common kitty/fund
  | 'KITTY_EXPENSE'   // An expense paid directly out of the common kitty
  | 'TRANSFER'        // Direct debt repayment between two participants (e.g. Venmo mid-trip)
  | 'KITTY_PAYOUT';   // Leftover cash from kitty returned to participants

export interface Participant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarColor: string;
  joinedDate?: string;
  notes?: string;
  isActive: boolean;
}

export interface PayerContribution {
  participantId: string; // If 'KITTY', represents the common fund
  amountCents: number;   // In base currency
  originalAmount?: number;
}

export interface SplitParticipantShare {
  participantId: string;
  calculatedCents: number; // In base currency
  shareValue?: number;     // e.g. % (25%), shares count (2), or exact value
  notes?: string;
}

export interface ItemizedItem {
  id: string;
  title: string;
  amountCents: number;
  assignedParticipantIds: string[];
}

export interface Transaction {
  id: string;
  tripId: string;
  type: TransactionType;
  title: string;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  notes?: string;
  receiptNote?: string;
  
  // Currency handling
  currency: string;
  exchangeRateToBase: number; // e.g. 1.0 for base, 1.08 for EUR when base is USD
  originalAmount: number;     // in foreign currency
  totalAmountCents: number;   // in base currency (cents)

  // Payers (one or multiple)
  payers: PayerContribution[];

  // Split details
  splitMethod: SplitMethod;
  splitShares: SplitParticipantShare[];
  itemizedItems?: ItemizedItem[];

  createdAt: string;
  updatedAt: string;
}

export interface SettlementTransfer {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: number;
  isSettled: boolean;
  settledAt?: string;
  notes?: string;
}

export interface Trip {
  id: string;
  tripKey?: string; // 6-digit unique number key (100000 - 999999)
  name: string;
  description?: string;
  baseCurrency: string;
  startDate?: string;
  endDate?: string;
  participants: Participant[];
  transactions: Transaction[];
  settlements: SettlementTransfer[];
  isDeleted?: boolean; // Soft-delete flag for MongoDB & local archive
  deletedAt?: string;  // Timestamp of archival
  expiresAt?: string;  // ISO timestamp when trip records will be automatically deleted from database
  extensionAdded?: boolean; // True if one-time +1 week extension was applied
  extendedAt?: string; // ISO timestamp when extension was applied
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantBalance {
  participantId: string;
  totalPaidCents: number;
  totalBenefitCents: number;
  totalTransfersSentCents: number;
  totalTransfersReceivedCents: number;
  kittyDepositsCents: number;
  kittyPayoutsCents: number;
  netBalanceCents: number; // Positive = is owed money; Negative = owes money
}

export interface CalculationExplanation {
  participantId: string;
  paidTransactions: {
    transactionId: string;
    title: string;
    date: string;
    paidCents: number;
    category: ExpenseCategory;
  }[];
  benefitedTransactions: {
    transactionId: string;
    title: string;
    date: string;
    shareCents: number;
    splitMethod: SplitMethod;
    totalExpenseCents: number;
  }[];
  transfersSent: {
    toParticipantId: string;
    amountCents: number;
    title: string;
    date: string;
  }[];
  transfersReceived: {
    fromParticipantId: string;
    amountCents: number;
    title: string;
    date: string;
  }[];
  kittyContributionsCents: number;
  kittyPayoutsCents: number;
  formulaString: string;
  netBalanceCents: number;
}

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  rateToBase: number; // default exchange rate
}
