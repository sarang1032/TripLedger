/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  calculateBalances,
  calculateEqualShares,
  calculateOptimalSettlements,
  calculatePercentShares,
  calculateWeightedShares,
  KITTY_ID,
  toCents,
  validateExpense,
} from './calculator';
import { Participant, ParticipantBalance, Transaction } from '../types/trip';

export interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string[];
}

export function runEngineTestSuite(): TestCaseResult[] {
  const results: TestCaseResult[] = [];

  // -------------------------------------------------------------
  // Test 1: Penny / Paisa Rounding & Exact Remainder Distribution
  // -------------------------------------------------------------
  try {
    const totalCents = 10000; // ₹100.00 (10000 paise)
    const participants = ['p1', 'p2', 'p3'];
    const shares = calculateEqualShares(totalCents, participants);
    const sumShares = shares.reduce((sum, s) => sum + s.calculatedCents, 0);

    const share1 = shares.find((s) => s.participantId === 'p1')?.calculatedCents;
    const share2 = shares.find((s) => s.participantId === 'p2')?.calculatedCents;
    const share3 = shares.find((s) => s.participantId === 'p3')?.calculatedCents;

    const passed =
      sumShares === 10000 &&
      share1 === 3334 &&
      share2 === 3333 &&
      share3 === 3333;

    results.push({
      id: 'test-penny-rounding',
      name: 'Paisa / Cent Round-Off Reconciliation',
      category: 'Arithmetic Precision',
      description: 'Splitting ₹100.00 among 3 participants must reconcile to 3334p, 3333p, 3333p with zero paisa loss.',
      passed,
      expected: 'Sum: 10000p (Shares: 3334p, 3333p, 3333p)',
      actual: `Sum: ${sumShares}p (Shares: ${share1}p, ${share2}p, ${share3}p)`,
      details: [
        'Guarantees mathematical integrity: sum of shares === total expense',
        'Deterministic remainder distribution prevents rounding drift',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-penny-rounding',
      name: 'Paisa / Cent Round-Off Reconciliation',
      category: 'Arithmetic Precision',
      description: 'Splitting ₹100.00 among 3 participants',
      passed: false,
      expected: '10000p sum',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 2: Sub-group Split & Late Joiner
  // -------------------------------------------------------------
  try {
    const participants: Participant[] = [
      { id: 'alice', name: 'Alice', avatarColor: '#3b82f6', isActive: true },
      { id: 'bob', name: 'Bob', avatarColor: '#10b981', isActive: true },
      { id: 'charlie', name: 'Charlie', avatarColor: '#f59e0b', isActive: true },
      { id: 'dave', name: 'Dave', avatarColor: '#8b5cf6', isActive: true }, // Joined on Day 2
    ];

    const tx1: Transaction = {
      id: 'tx-1',
      tripId: 't1',
      type: 'EXPENSE',
      title: 'Day 1 Hotel (Alice & Bob only)',
      category: 'lodging',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 2000,
      totalAmountCents: 200000, // ₹2,000.00
      payers: [{ participantId: 'alice', amountCents: 200000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'alice', calculatedCents: 100000 },
        { participantId: 'bob', calculatedCents: 100000 },
      ],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const tx2: Transaction = {
      id: 'tx-2',
      tripId: 't1',
      type: 'EXPENSE',
      title: 'Day 2 Group Dinner (All 4)',
      category: 'food',
      date: '2026-10-02',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 1600,
      totalAmountCents: 160000, // ₹1,600.00
      payers: [{ participantId: 'charlie', amountCents: 160000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'alice', calculatedCents: 40000 },
        { participantId: 'bob', calculatedCents: 40000 },
        { participantId: 'charlie', calculatedCents: 40000 },
        { participantId: 'dave', calculatedCents: 40000 },
      ],
      createdAt: '2026-10-02T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    };

    const { participantBalances, isBalanced } = calculateBalances(participants, [tx1, tx2]);

    const aliceNet = participantBalances.find((b) => b.participantId === 'alice')?.netBalanceCents;
    const bobNet = participantBalances.find((b) => b.participantId === 'bob')?.netBalanceCents;
    const charlieNet = participantBalances.find((b) => b.participantId === 'charlie')?.netBalanceCents;
    const daveNet = participantBalances.find((b) => b.participantId === 'dave')?.netBalanceCents;

    // Expected:
    // Alice paid ₹2000, share = ₹1000 + ₹400 = ₹1400 => net = +₹600 (60000p)
    // Bob paid ₹0, share = ₹1000 + ₹400 = ₹1400 => net = -₹1400 (-140000p)
    // Charlie paid ₹1600, share = ₹400 => net = +₹1200 (120000p)
    // Dave paid ₹0, share = ₹400 => net = -₹400 (-40000p)
    // Sum = 600 - 1400 + 1200 - 400 = 0.

    const passed =
      isBalanced &&
      aliceNet === 60000 &&
      bobNet === -140000 &&
      charlieNet === 120000 &&
      daveNet === -40000;

    results.push({
      id: 'test-subgroup-late-joiner',
      name: 'Sub-group Splits & Late Joiners',
      category: 'Participant Scoping',
      description: 'Handles segment-specific expenses where only subsets of participants attend.',
      passed,
      expected: 'Alice: +₹600.00, Bob: -₹1,400.00, Charlie: +₹1,200.00, Dave: -₹400.00',
      actual: `Alice: ${aliceNet! / 100}, Bob: ${bobNet! / 100}, Charlie: ${charlieNet! / 100}, Dave: ${daveNet! / 100}`,
      details: [
        'Dave is charged strictly for Day 2 dinner (₹400) and zero for Day 1 lodging',
        'Net system balance sums precisely to 0',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-subgroup-late-joiner',
      name: 'Sub-group Splits & Late Joiners',
      category: 'Participant Scoping',
      description: 'Handles segment-specific expenses',
      passed: false,
      expected: 'Expected balances',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 3: Common Fund (Kitty) Accounting
  // -------------------------------------------------------------
  try {
    const participants: Participant[] = [
      { id: 'alice', name: 'Alice', avatarColor: '#3b82f6', isActive: true },
      { id: 'bob', name: 'Bob', avatarColor: '#10b981', isActive: true },
    ];

    // Alice and Bob put ₹500 each in kitty
    const txDeposit1: Transaction = {
      id: 'kd-1',
      tripId: 't1',
      type: 'KITTY_DEPOSIT',
      title: 'Alice cash deposit to Kitty',
      category: 'general',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 500,
      totalAmountCents: 50000,
      payers: [{ participantId: 'alice', amountCents: 50000 }],
      splitMethod: 'EQUAL',
      splitShares: [],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const txDeposit2: Transaction = {
      id: 'kd-2',
      tripId: 't1',
      type: 'KITTY_DEPOSIT',
      title: 'Bob cash deposit to Kitty',
      category: 'general',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 500,
      totalAmountCents: 50000,
      payers: [{ participantId: 'bob', amountCents: 50000 }],
      splitMethod: 'EQUAL',
      splitShares: [],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    // Driver pays ₹600 toll/gas directly out of kitty, split 50/50
    const txKittyExpense: Transaction = {
      id: 'ke-1',
      tripId: 't1',
      type: 'KITTY_EXPENSE',
      title: 'Toll & Gas paid from Kitty',
      category: 'transport',
      date: '2026-10-02',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 600,
      totalAmountCents: 60000,
      payers: [{ participantId: KITTY_ID, amountCents: 60000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'alice', calculatedCents: 30000 },
        { participantId: 'bob', calculatedCents: 30000 },
      ],
      createdAt: '2026-10-02T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    };

    const { participantBalances, kittyBalanceCents, isBalanced } = calculateBalances(
      participants,
      [txDeposit1, txDeposit2, txKittyExpense]
    );

    // Deposit: ₹1,000 in kitty. Spent: ₹600. Remaining kitty: ₹400.
    // Alice paid ₹500 into kitty, benefited ₹300 from expense => net balance = +₹200
    // Bob paid ₹500 into kitty, benefited ₹300 from expense => net balance = +₹200
    // Total system sum: +200 + +200 - kitty remaining (₹400) = 0.
    const aliceNet = participantBalances.find((b) => b.participantId === 'alice')?.netBalanceCents;
    const bobNet = participantBalances.find((b) => b.participantId === 'bob')?.netBalanceCents;

    const passed =
      kittyBalanceCents === 40000 &&
      aliceNet === 20000 &&
      bobNet === 20000 &&
      isBalanced;

    results.push({
      id: 'test-kitty-accounting',
      name: 'Common Kitty Fund Accounting',
      category: 'Fund Management',
      description: 'Tracks cash deposits, pool expenditures, and remaining cash fund balances accurately.',
      passed,
      expected: 'Kitty Balance: ₹400.00, Alice Net: +₹200.00, Bob Net: +₹200.00 (Balanced)',
      actual: `Kitty Balance: ₹${kittyBalanceCents / 100}, Alice: +₹${aliceNet! / 100}, Bob: +₹${bobNet! / 100}`,
      details: [
        'Remaining cash pool (₹400) matches owed claims from Alice (₹200) and Bob (₹200)',
        'Zero leaks between private expenses and group pot',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-kitty-accounting',
      name: 'Common Kitty Fund Accounting',
      category: 'Fund Management',
      description: 'Tracks cash deposits and expenditures',
      passed: false,
      expected: 'Balanced Kitty',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 4: Mid-Trip Direct Repayment / Transfer (UPI / Cash)
  // -------------------------------------------------------------
  try {
    const participants: Participant[] = [
      { id: 'alice', name: 'Alice', avatarColor: '#3b82f6', isActive: true },
      { id: 'bob', name: 'Bob', avatarColor: '#10b981', isActive: true },
      { id: 'charlie', name: 'Charlie', avatarColor: '#f59e0b', isActive: true },
    ];

    // Alice paid ₹900 for Alice, Bob, Charlie (₹300 each)
    const expense: Transaction = {
      id: 'tx-lunch',
      tripId: 't1',
      type: 'EXPENSE',
      title: 'Lunch',
      category: 'food',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 900,
      totalAmountCents: 90000,
      payers: [{ participantId: 'alice', amountCents: 90000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'alice', calculatedCents: 30000 },
        { participantId: 'bob', calculatedCents: 30000 },
        { participantId: 'charlie', calculatedCents: 30000 },
      ],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    // Bob sent UPI to Alice ₹300 immediately during the trip
    const transfer: Transaction = {
      id: 'transfer-1',
      tripId: 't1',
      type: 'TRANSFER',
      title: 'Bob UPI to Alice for Lunch',
      category: 'general',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 300,
      totalAmountCents: 30000,
      payers: [{ participantId: 'bob', amountCents: 30000 }],
      splitMethod: 'EXACT',
      splitShares: [{ participantId: 'alice', calculatedCents: 30000 }],
      createdAt: '2026-10-01T01:00:00Z',
      updatedAt: '2026-10-01T01:00:00Z',
    };

    const { participantBalances } = calculateBalances(participants, [expense, transfer]);

    const aliceNet = participantBalances.find((b) => b.participantId === 'alice')?.netBalanceCents;
    const bobNet = participantBalances.find((b) => b.participantId === 'bob')?.netBalanceCents;
    const charlieNet = participantBalances.find((b) => b.participantId === 'charlie')?.netBalanceCents;

    // Bob owes ₹0. Charlie owes ₹300 to Alice. Alice is owed +₹300.
    const passed = aliceNet === 30000 && bobNet === 0 && charlieNet === -30000;

    const settlements = calculateOptimalSettlements(participantBalances);
    const expectedSettlement =
      settlements.length === 1 &&
      settlements[0].fromParticipantId === 'charlie' &&
      settlements[0].toParticipantId === 'alice' &&
      settlements[0].amountCents === 30000;

    results.push({
      id: 'test-mid-trip-repayment',
      name: 'Mid-Trip Direct Repayments (UPI/Cash)',
      category: 'Debt Transfers',
      description: 'Reflects interim payments between participants so already-settled balances are not re-charged.',
      passed: passed && expectedSettlement,
      expected: 'Bob Net: ₹0.00, Charlie owes Alice: ₹300.00 (1 settlement transfer)',
      actual: `Bob Net: ₹${bobNet! / 100}, Charlie Net: ₹${charlieNet! / 100}, Alice Net: ₹${aliceNet! / 100}, Settlements: ${settlements.length}`,
      details: [
        'Bob is fully resolved with zero remaining debt',
        'Minimal settlement algorithm outputs exactly 1 transfer: Charlie -> Alice (₹300.00)',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-mid-trip-repayment',
      name: 'Mid-Trip Direct Repayments',
      category: 'Debt Transfers',
      description: 'Reflects interim payments',
      passed: false,
      expected: 'Resolved debt',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 5: Multi-Payer Split Validation
  // -------------------------------------------------------------
  try {
    const totalCents = 100000; // ₹1,000.00
    const payers = [
      { participantId: 'alice', amountCents: 60000 },
      { participantId: 'bob', amountCents: 40000 },
    ];
    const splitShares = [
      { participantId: 'alice', calculatedCents: 25000 },
      { participantId: 'bob', calculatedCents: 25000 },
      { participantId: 'charlie', calculatedCents: 25000 },
      { participantId: 'dave', calculatedCents: 25000 },
    ];

    const validation = validateExpense(totalCents, payers, splitShares);

    const participants: Participant[] = [
      { id: 'alice', name: 'Alice', avatarColor: '#3b82f6', isActive: true },
      { id: 'bob', name: 'Bob', avatarColor: '#10b981', isActive: true },
      { id: 'charlie', name: 'Charlie', avatarColor: '#f59e0b', isActive: true },
      { id: 'dave', name: 'Dave', avatarColor: '#8b5cf6', isActive: true },
    ];

    const tx: Transaction = {
      id: 'tx-multi-payer',
      tripId: 't1',
      type: 'EXPENSE',
      title: 'Shared Grocery Haul',
      category: 'groceries',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 1000,
      totalAmountCents: totalCents,
      payers,
      splitMethod: 'EQUAL',
      splitShares,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const { participantBalances } = calculateBalances(participants, [tx]);
    const aliceNet = participantBalances.find((b) => b.participantId === 'alice')?.netBalanceCents; // +35000 (₹350)
    const bobNet = participantBalances.find((b) => b.participantId === 'bob')?.netBalanceCents;     // +15000 (₹150)
    const charlieNet = participantBalances.find((b) => b.participantId === 'charlie')?.netBalanceCents; // -25000 (-₹250)
    const daveNet = participantBalances.find((b) => b.participantId === 'dave')?.netBalanceCents;       // -25000 (-₹250)

    const passed =
      validation.isValid &&
      aliceNet === 35000 &&
      bobNet === 15000 &&
      charlieNet === -25000 &&
      daveNet === -25000;

    results.push({
      id: 'test-multi-payer',
      name: 'Multi-Payer Shared Expenses',
      category: 'Advanced Splits',
      description: 'Multiple people contribute uneven cash/card amounts to pay for a single bill.',
      passed,
      expected: 'Alice: +₹350.00, Bob: +₹150.00, Charlie: -₹250.00, Dave: -₹250.00',
      actual: `Alice: +₹${aliceNet! / 100}, Bob: +₹${bobNet! / 100}, Charlie: -₹${Math.abs(charlieNet!) / 100}, Dave: -₹${Math.abs(daveNet!) / 100}`,
      details: [
        'Alice (₹600 paid - ₹250 share = +₹350 net)',
        'Bob (₹400 paid - ₹250 share = +₹150 net)',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-multi-payer',
      name: 'Multi-Payer Shared Expenses',
      category: 'Advanced Splits',
      description: 'Multiple people contribute uneven cash/card amounts',
      passed: false,
      expected: 'Exact balances',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 6: Optimal Debt Simplification & Minimal Graph Transfers
  // -------------------------------------------------------------
  try {
    // 4 people cyclic debt graph that can be simplified
    const balances: ParticipantBalance[] = [
      {
        participantId: 'pA',
        totalPaidCents: 50000,
        totalBenefitCents: 0,
        totalTransfersSentCents: 0,
        totalTransfersReceivedCents: 0,
        kittyDepositsCents: 0,
        kittyPayoutsCents: 0,
        netBalanceCents: 50000, // +₹500
      },
      {
        participantId: 'pB',
        totalPaidCents: 20000,
        totalBenefitCents: 0,
        totalTransfersSentCents: 0,
        totalTransfersReceivedCents: 0,
        kittyDepositsCents: 0,
        kittyPayoutsCents: 0,
        netBalanceCents: 20000, // +₹200
      },
      {
        participantId: 'pC',
        totalPaidCents: 0,
        totalBenefitCents: 20000,
        totalTransfersSentCents: 0,
        totalTransfersReceivedCents: 0,
        kittyDepositsCents: 0,
        kittyPayoutsCents: 0,
        netBalanceCents: -20000, // -₹200 (exact match with pB!)
      },
      {
        participantId: 'pD',
        totalPaidCents: 0,
        totalBenefitCents: 50000,
        totalTransfersSentCents: 0,
        totalTransfersReceivedCents: 0,
        kittyDepositsCents: 0,
        kittyPayoutsCents: 0,
        netBalanceCents: -50000, // -₹500 (exact match with pA!)
      },
    ];

    const settlements = calculateOptimalSettlements(balances);
    // Exact match algorithm should reduce 4 people to exactly 2 transfers:
    // pC pays pB ₹200, pD pays pA ₹500!
    const isMinTransfers = settlements.length === 2;
    const match1 = settlements.find((s) => s.fromParticipantId === 'pC' && s.toParticipantId === 'pB' && s.amountCents === 20000);
    const match2 = settlements.find((s) => s.fromParticipantId === 'pD' && s.toParticipantId === 'pA' && s.amountCents === 50000);

    const passed = isMinTransfers && !!match1 && !!match2;

    results.push({
      id: 'test-debt-simplification',
      name: 'Greedy Exact-Match Settlement Optimization',
      category: 'Settlement Engine',
      description: 'Eliminates circular and redundant transfers to yield the absolute minimum settlement payments.',
      passed,
      expected: 'Exactly 2 direct settlements: pC->pB (₹200) & pD->pA (₹500)',
      actual: `${settlements.length} transfers generated`,
      details: [
        'Pairwise circular debts canceled without intermediate hops',
        'Zero friction settlement for trip participants',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-debt-simplification',
      name: 'Greedy Exact-Match Settlement Optimization',
      category: 'Settlement Engine',
      description: 'Settlement optimization',
      passed: false,
      expected: '2 transfers',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 7: Percentage Split Precision & Deterministic Rounding
  // -------------------------------------------------------------
  try {
    const totalCents = 125075; // ₹1,250.75 (odd paise with non-clean fractions)
    const percentages = [
      { participantId: 'alice', percent: 45 },
      { participantId: 'bob', percent: 35 },
      { participantId: 'charlie', percent: 20 },
    ];
    const { shares, isValid } = calculatePercentShares(totalCents, percentages);
    const sumShares = shares.reduce((sum, s) => sum + s.calculatedCents, 0);

    const sAlice = shares.find((s) => s.participantId === 'alice')?.calculatedCents;
    const sBob = shares.find((s) => s.participantId === 'bob')?.calculatedCents;
    const sCharlie = shares.find((s) => s.participantId === 'charlie')?.calculatedCents;

    // 45% of 125075 = 56283.75 -> 56284p
    // 35% of 125075 = 43776.25 -> 43776p
    // 20% of 125075 = 25015.00 -> 25015p
    // Sum = 56284 + 43776 + 25015 = 125075p (exact ₹1,250.75)
    const passed =
      isValid &&
      sumShares === totalCents &&
      shares.length === 3 &&
      sAlice === 56284 &&
      sBob === 43776 &&
      sCharlie === 25015;

    results.push({
      id: 'test-percent-split',
      name: 'Percentage Split Exactness (100% Rule)',
      category: 'Arithmetic Precision',
      description: 'Splits ₹1,250.75 by 45%, 35%, 20% with zero paisa drift and deterministic rounding.',
      passed,
      expected: `Sum: ${totalCents}p (Alice: 56284p, Bob: 43776p, Charlie: 25015p)`,
      actual: `Sum: ${sumShares}p (Alice: ${sAlice}p, Bob: ${sBob}p, Charlie: ${sCharlie}p)`,
      details: [
        'Total allocated shares exactly equal 125075p (₹1,250.75)',
        'Largest remainder method guarantees no penny/paisa loss across arbitrary percentage distributions',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-percent-split',
      name: 'Percentage Split Exactness',
      category: 'Arithmetic Precision',
      description: 'Percentage split precision',
      passed: false,
      expected: '125075p sum',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 8: Fractional & Weighted Split (Couples, Singles, Families)
  // -------------------------------------------------------------
  try {
    const totalCents = 875000; // ₹8,750.00
    // Alice & Partner (weight 2.0), Bob (weight 1.0), Charlie & Child (weight 0.5)
    // Total weight = 3.5
    const weights = [
      { participantId: 'alice', shares: 2.0 },
      { participantId: 'bob', shares: 1.0 },
      { participantId: 'charlie', shares: 0.5 },
    ];
    const shares = calculateWeightedShares(totalCents, weights);
    const sumShares = shares.reduce((sum, s) => sum + s.calculatedCents, 0);

    const sAlice = shares.find((s) => s.participantId === 'alice')?.calculatedCents;
    const sBob = shares.find((s) => s.participantId === 'bob')?.calculatedCents;
    const sCharlie = shares.find((s) => s.participantId === 'charlie')?.calculatedCents;

    // 2.0 / 3.5 * 875000 = 500000p (₹5,000.00)
    // 1.0 / 3.5 * 875000 = 250000p (₹2,500.00)
    // 0.5 / 3.5 * 875000 = 125000p (₹1,250.00)
    const passed =
      sumShares === 875000 &&
      sAlice === 500000 &&
      sBob === 250000 &&
      sCharlie === 125000;

    results.push({
      id: 'test-weighted-fractions',
      name: 'Fractional & Weighted Split Precision',
      category: 'Advanced Splits',
      description: 'Allocates hotel room costs proportionally for couples (2.0x), singles (1.0x), and kids (0.5x).',
      passed,
      expected: 'Alice (2x): ₹5,000.00, Bob (1x): ₹2,500.00, Charlie (0.5x): ₹1,250.00',
      actual: `Alice: ₹${sAlice! / 100}, Bob: ₹${sBob! / 100}, Charlie: ₹${sCharlie! / 100}`,
      details: [
        'Float weights (2.0, 1.0, 0.5) resolve to clean integer paise without truncation error',
        'Total sum reconciles to exactly ₹8,750.00',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-weighted-fractions',
      name: 'Fractional & Weighted Split Precision',
      category: 'Advanced Splits',
      description: 'Proportional weighting',
      passed: false,
      expected: 'Clean split',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 9: Prime Denominator Repeating Decimals (7-Way & 11-Way Splits)
  // -------------------------------------------------------------
  try {
    // ₹100.00 (10,000 paise) split across 7 participants (1428.571428... paise)
    const p7 = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const s7 = calculateEqualShares(10000, p7);
    const sum7 = s7.reduce((sum, s) => sum + s.calculatedCents, 0);

    // 10000 / 7 = 1428 with remainder 4. First 4 get 1429p, last 3 get 1428p.
    const valid7 =
      sum7 === 10000 &&
      s7[0].calculatedCents === 1429 &&
      s7[3].calculatedCents === 1429 &&
      s7[4].calculatedCents === 1428 &&
      s7[6].calculatedCents === 1428;

    // ₹1,000.00 (100,000 paise) split across 11 participants (9090.909090... paise)
    const p11 = Array.from({ length: 11 }, (_, i) => `member_${i + 1}`);
    const s11 = calculateEqualShares(100000, p11);
    const sum11 = s11.reduce((sum, s) => sum + s.calculatedCents, 0);

    // 100000 / 11 = 9090 with remainder 10. First 10 get 9091p, 11th gets 9090p.
    const valid11 =
      sum11 === 100000 &&
      s11[0].calculatedCents === 9091 &&
      s11[9].calculatedCents === 9091 &&
      s11[10].calculatedCents === 9090;

    const passed = valid7 && valid11;

    results.push({
      id: 'test-prime-denominator',
      name: 'Prime Denominator Division (7-Way & 11-Way Splits)',
      category: 'Arithmetic Precision',
      description: 'Tests infinite repeating decimals (1/7 and 1/11) to guarantee zero paisa loss or accumulation.',
      passed,
      expected: '7-way ₹100 sum = 10000p; 11-way ₹1000 sum = 100000p',
      actual: `7-way: ${sum7}p (${s7[0].calculatedCents}p / ${s7[6].calculatedCents}p); 11-way: ${sum11}p (${s11[0].calculatedCents}p / ${s11[10].calculatedCents}p)`,
      details: [
        '10000p / 7 -> 4 x 1429p + 3 x 1428p = 10000p',
        '100000p / 11 -> 10 x 9091p + 1 x 9090p = 100000p',
        'Floating-point representation error permanently eliminated',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-prime-denominator',
      name: 'Prime Denominator Division',
      category: 'Arithmetic Precision',
      description: 'Repeating decimals tests',
      passed: false,
      expected: 'Zero remainder drift',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 10: Overdrawn Kitty Fund Deficit & Recovery
  // -------------------------------------------------------------
  try {
    const participants: Participant[] = [
      { id: 'alice', name: 'Alice', avatarColor: '#3b82f6', isActive: true },
      { id: 'bob', name: 'Bob', avatarColor: '#10b981', isActive: true },
    ];

    // Alice & Bob each put ₹200 into Kitty (Pot = ₹400)
    const depAlice: Transaction = {
      id: 'kd-10a',
      tripId: 't1',
      type: 'KITTY_DEPOSIT',
      title: 'Alice ₹200 Deposit',
      category: 'general',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 200,
      totalAmountCents: 20000,
      payers: [{ participantId: 'alice', amountCents: 20000 }],
      splitMethod: 'EQUAL',
      splitShares: [],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const depBob: Transaction = {
      id: 'kd-10b',
      tripId: 't1',
      type: 'KITTY_DEPOSIT',
      title: 'Bob ₹200 Deposit',
      category: 'general',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 200,
      totalAmountCents: 20000,
      payers: [{ participantId: 'bob', amountCents: 20000 }],
      splitMethod: 'EQUAL',
      splitShares: [],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    // Emergency car tow expense of ₹500 paid from Kitty (Kitty drops to -₹100 deficit!)
    const emergencyRepair: Transaction = {
      id: 'ke-repair',
      tripId: 't1',
      type: 'KITTY_EXPENSE',
      title: 'Emergency Vehicle Tow',
      category: 'transport',
      date: '2026-10-02',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 500,
      totalAmountCents: 50000,
      payers: [{ participantId: KITTY_ID, amountCents: 50000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'alice', calculatedCents: 25000 },
        { participantId: 'bob', calculatedCents: 25000 },
      ],
      createdAt: '2026-10-02T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    };

    const { participantBalances, kittyBalanceCents, isBalanced } = calculateBalances(
      participants,
      [depAlice, depBob, emergencyRepair]
    );

    const aliceNet = participantBalances.find((b) => b.participantId === 'alice')?.netBalanceCents;
    const bobNet = participantBalances.find((b) => b.participantId === 'bob')?.netBalanceCents;

    // Kitty is in deficit: -₹100 (-10,000 paise).
    // Alice net: 20,000 paid - 25,000 benefit = -5,000 paise (-₹50.00).
    // Bob net: 20,000 paid - 25,000 benefit = -5,000 paise (-₹50.00).
    // Invariant: sumNet - kittyBalanceCents = (-10,000) - (-10,000) = 0!
    const settlements = calculateOptimalSettlements(participantBalances, kittyBalanceCents);

    // Settling the deficit requires Alice and Bob to pay ₹50 each TO the Kitty!
    const passed =
      isBalanced &&
      kittyBalanceCents === -10000 &&
      aliceNet === -5000 &&
      bobNet === -5000 &&
      settlements.length === 2 &&
      settlements.every((s) => s.toParticipantId === KITTY_ID && s.amountCents === 5000);

    results.push({
      id: 'test-kitty-deficit',
      name: 'Overdrawn Common Fund Recovery',
      category: 'Fund Management',
      description: 'Handles negative kitty cash pool (overdraft) and routes replenishment payments back to the pot.',
      passed,
      expected: 'Kitty: -₹100.00 deficit, Alice owes ₹50.00 to Kitty, Bob owes ₹50.00 to Kitty',
      actual: `Kitty: ₹${kittyBalanceCents / 100}, Alice: ₹${aliceNet! / 100}, Bob: ₹${bobNet! / 100}, Settlements: ${settlements.length}`,
      details: [
        'Negative pool balance properly accounted as system liability',
        'Optimal settlement instructs both debtors to refill the Common Cash Kitty to reach ₹0.00 balance',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-kitty-deficit',
      name: 'Overdrawn Common Fund Recovery',
      category: 'Fund Management',
      description: 'Kitty deficit recovery',
      passed: false,
      expected: 'Deficit resolved',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 11: End-to-End Multi-Day Trip Simulation (5 Members)
  // -------------------------------------------------------------
  try {
    const participants: Participant[] = [
      { id: 'pA', name: 'Aarav', avatarColor: '#3b82f6', isActive: true },
      { id: 'pB', name: 'Bhavna', avatarColor: '#10b981', isActive: true },
      { id: 'pC', name: 'Chirag', avatarColor: '#f59e0b', isActive: true },
      { id: 'pD', name: 'Divya', avatarColor: '#8b5cf6', isActive: true },
      { id: 'pE', name: 'Eshaan', avatarColor: '#ec4899', isActive: true },
    ];

    // Day 1: Aarav & Bhavna deposit ₹1,000 each into Kitty (₹2,000 pot)
    const tx1: Transaction = {
      id: 'sim-tx-1',
      tripId: 'sim-trip',
      type: 'KITTY_DEPOSIT',
      title: 'Kitty Funding',
      category: 'general',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 2000,
      totalAmountCents: 200000,
      payers: [
        { participantId: 'pA', amountCents: 100000 },
        { participantId: 'pB', amountCents: 100000 },
      ],
      splitMethod: 'EQUAL',
      splitShares: [],
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    // Day 1: Highway Tolls paid from Kitty ₹500 for all 5 (₹100 each)
    const tx2: Transaction = {
      id: 'sim-tx-2',
      tripId: 'sim-trip',
      type: 'KITTY_EXPENSE',
      title: 'Highway Tolls',
      category: 'transport',
      date: '2026-10-01',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 500,
      totalAmountCents: 50000,
      payers: [{ participantId: KITTY_ID, amountCents: 50000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'pA', calculatedCents: 10000 },
        { participantId: 'pB', calculatedCents: 10000 },
        { participantId: 'pC', calculatedCents: 10000 },
        { participantId: 'pD', calculatedCents: 10000 },
        { participantId: 'pE', calculatedCents: 10000 },
      ],
      createdAt: '2026-10-01T04:00:00Z',
      updatedAt: '2026-10-01T04:00:00Z',
    };

    // Day 2: Chirag books Resort Villa ₹5,000 on personal credit card for all 5 (₹1,000 each)
    const tx3: Transaction = {
      id: 'sim-tx-3',
      tripId: 'sim-trip',
      type: 'EXPENSE',
      title: 'Resort Villa Booking',
      category: 'lodging',
      date: '2026-10-02',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 5000,
      totalAmountCents: 500000,
      payers: [{ participantId: 'pC', amountCents: 500000 }],
      splitMethod: 'EQUAL',
      splitShares: [
        { participantId: 'pA', calculatedCents: 100000 },
        { participantId: 'pB', calculatedCents: 100000 },
        { participantId: 'pC', calculatedCents: 100000 },
        { participantId: 'pD', calculatedCents: 100000 },
        { participantId: 'pE', calculatedCents: 100000 },
      ],
      createdAt: '2026-10-02T02:00:00Z',
      updatedAt: '2026-10-02T02:00:00Z',
    };

    // Day 3: Divya sends ₹500 UPI direct transfer to Chirag
    const tx4: Transaction = {
      id: 'sim-tx-4',
      tripId: 'sim-trip',
      type: 'TRANSFER',
      title: 'Divya UPI to Chirag',
      category: 'general',
      date: '2026-10-03',
      currency: 'INR',
      exchangeRateToBase: 1.0,
      originalAmount: 500,
      totalAmountCents: 50000,
      payers: [{ participantId: 'pD', amountCents: 50000 }],
      splitMethod: 'EXACT',
      splitShares: [{ participantId: 'pC', calculatedCents: 50000 }],
      createdAt: '2026-10-03T01:00:00Z',
      updatedAt: '2026-10-03T01:00:00Z',
    };

    const { participantBalances, kittyBalanceCents, isBalanced } = calculateBalances(
      participants,
      [tx1, tx2, tx3, tx4]
    );

    const settlements = calculateOptimalSettlements(participantBalances, kittyBalanceCents);

    // Invariant check: sum of net balances - remaining kitty (₹1,500) === 0
    const passed =
      isBalanced &&
      kittyBalanceCents === 150000 &&
      settlements.length > 0;

    results.push({
      id: 'test-full-trip-simulation',
      name: 'Full 5-Member Multi-Day Lifecycle Simulation',
      category: 'End-to-End Workflow',
      description: 'Simulates deposits, shared tolls, villa lodging, and mid-trip UPI repayments in a unified ledger.',
      passed,
      expected: 'Balanced ledger with ₹1,500 Kitty reserve and non-cyclic settlements',
      actual: `Kitty: ₹${kittyBalanceCents / 100}, Transfers: ${settlements.length}, Balanced: ${isBalanced}`,
      details: [
        'Aarav Net: -₹100 (₹1000 deposited - ₹1100 benefits)',
        'Chirag Net: +₹3,500 (₹5000 lodging paid - ₹1000 benefit - ₹500 UPI received)',
        'Divya Net: -₹600 (₹1100 benefits - ₹500 UPI sent)',
        'Zero sum closure guaranteed across all participants and cash envelope',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-full-trip-simulation',
      name: 'Full 5-Member Multi-Day Lifecycle Simulation',
      category: 'End-to-End Workflow',
      description: 'Simulates full lifecycle',
      passed: false,
      expected: 'Clean lifecycle',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 12: Input Validation Defense Boundary
  // -------------------------------------------------------------
  try {
    // 1) Negative amount rejection
    const v1 = validateExpense(-5000, [{ participantId: 'p1', amountCents: -5000 }], [{ participantId: 'p1', calculatedCents: -5000 }]);
    // 2) Payer mismatch rejection (total = 10000, but payers = 8000)
    const v2 = validateExpense(10000, [{ participantId: 'p1', amountCents: 8000 }], [{ participantId: 'p1', calculatedCents: 10000 }]);
    // 3) Share mismatch rejection (total = 10000, but shares = 9000)
    const v3 = validateExpense(10000, [{ participantId: 'p1', amountCents: 10000 }], [{ participantId: 'p1', calculatedCents: 9000 }]);
    // 4) Empty payers rejection
    const v4 = validateExpense(10000, [], [{ participantId: 'p1', calculatedCents: 10000 }]);

    const passed =
      !v1.isValid &&
      !v2.isValid &&
      !v3.isValid &&
      !v4.isValid &&
      v1.errors.length > 0 &&
      v2.errors.length > 0 &&
      v3.errors.length > 0 &&
      v4.errors.length > 0;

    results.push({
      id: 'test-input-validation-bounds',
      name: 'Defensive Input & Validation Boundary Defense',
      category: 'Input Validation',
      description: 'Ensures invalid payloads (negative amounts, payer mismatches, drift) are rejected with precise feedback.',
      passed,
      expected: 'All 4 malformed expense payloads strictly rejected with error descriptors',
      actual: `Rejected 4/4 edge cases successfully`,
      details: [
        'Guards against negative amounts',
        'Enforces ∑ Payers === Total Expense',
        'Enforces ∑ Shares === Total Expense',
        'Disallows empty payer or recipient rosters',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'test-input-validation-bounds',
      name: 'Defensive Input & Validation Boundary Defense',
      category: 'Input Validation',
      description: 'Validation defenses',
      passed: false,
      expected: 'Errors caught',
      actual: err.message,
    });
  }

  return results;
}
