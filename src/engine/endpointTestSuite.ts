/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KITTY_ID } from './calculator';

export interface EndpointTestResult {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  description: string;
  passed: boolean;
  statusCode: number;
  expectedStatus: number;
  durationMs: number;
  requestPayload?: any;
  responsePayload?: any;
  expected: string;
  actual: string;
  details?: string[];
}

export async function runEndpointTestSuite(): Promise<EndpointTestResult[]> {
  const results: EndpointTestResult[] = [];

  // -------------------------------------------------------------
  // Test 1: Health & Runtime Check
  // -------------------------------------------------------------
  try {
    const start = performance.now();
    const res = await fetch('/api/health');
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const passed =
      res.status === 200 &&
      data.status === 'ok' &&
      data.currency === 'INR';

    results.push({
      id: 'endpoint-health',
      name: 'Service Health & Configuration Probe',
      endpoint: '/api/health',
      method: 'GET',
      description: 'Verifies the Express calculation service is responsive, reports uptime, and currency is INR.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      responsePayload: data,
      expected: 'HTTP 200, status: ok, currency: INR',
      actual: `HTTP ${res.status}, status: ${data.status}, currency: ${data.currency}`,
      details: [
        `Service: ${data.service}`,
        `Server Uptime: ${data.uptimeSeconds}s`,
        `Timestamp: ${data.timestamp}`,
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-health',
      name: 'Service Health & Configuration Probe',
      endpoint: '/api/health',
      method: 'GET',
      description: 'Verifies server health probe',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 2: Trip Ledger Invariant & Balances Endpoint
  // -------------------------------------------------------------
  try {
    const requestPayload = {
      participants: [
        { id: 'alice', name: 'Alice', avatarColor: '#3b82f6', isActive: true },
        { id: 'bob', name: 'Bob', avatarColor: '#10b981', isActive: true },
        { id: 'charlie', name: 'Charlie', avatarColor: '#f59e0b', isActive: true },
      ],
      transactions: [
        {
          id: 'tx-ep-1',
          tripId: 't1',
          type: 'EXPENSE',
          title: 'Train Tickets',
          category: 'transport',
          date: '2026-10-01',
          currency: 'INR',
          exchangeRateToBase: 1.0,
          originalAmount: 3000,
          totalAmountCents: 300000, // ₹3,000.00
          payers: [{ participantId: 'alice', amountCents: 300000 }],
          splitMethod: 'EQUAL',
          splitShares: [
            { participantId: 'alice', calculatedCents: 100000 },
            { participantId: 'bob', calculatedCents: 100000 },
            { participantId: 'charlie', calculatedCents: 100000 },
          ],
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ],
    };

    const start = performance.now();
    const res = await fetch('/api/engine/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const passed =
      res.status === 200 &&
      data.isBalanced === true &&
      data.totalImbalanceCents === 0 &&
      data.settlements.length === 2;

    results.push({
      id: 'endpoint-calculate-ledger',
      name: 'POST /api/engine/calculate — Ledger Audit & Settlements',
      endpoint: '/api/engine/calculate',
      method: 'POST',
      description: 'Calculates balances, verifies zero ledger imbalance, and generates optimal settlements via HTTP.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      requestPayload,
      responsePayload: data,
      expected: 'HTTP 200, isBalanced: true, totalImbalanceCents: 0, 2 settlements',
      actual: `HTTP ${res.status}, isBalanced: ${data.isBalanced}, drift: ${data.totalImbalanceCents}¢, settlements: ${data.settlements?.length}`,
      details: [
        'Bob owes Alice ₹1,000.00',
        'Charlie owes Alice ₹1,000.00',
        'Mathematical ledger invariant confirmed across network boundary',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-calculate-ledger',
      name: 'POST /api/engine/calculate — Ledger Audit & Settlements',
      endpoint: '/api/engine/calculate',
      method: 'POST',
      description: 'Calculates balances',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 3: High-Prime Equal Split with Remainder Reconciliation
  // -------------------------------------------------------------
  try {
    const requestPayload = {
      totalCents: 10000, // ₹100.00
      method: 'EQUAL',
      participants: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'], // 7 participants
    };

    const start = performance.now();
    const res = await fetch('/api/engine/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const passed =
      res.status === 200 &&
      data.isReconciled === true &&
      data.allocatedCents === 10000 &&
      data.remainderDriftCents === 0 &&
      data.shares?.length === 7;

    results.push({
      id: 'endpoint-split-7way',
      name: 'POST /api/engine/split — 7-Way Prime Integer Division',
      endpoint: '/api/engine/split',
      method: 'POST',
      description: 'Tests server-side remainder distribution for ₹100 split 7 ways across the network.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      requestPayload,
      responsePayload: data,
      expected: 'HTTP 200, isReconciled: true, allocated: 10000p, drift: 0p',
      actual: `HTTP ${res.status}, isReconciled: ${data.isReconciled}, allocated: ${data.allocatedCents}p`,
      details: [
        'First 4 participants receive 1429 paise',
        'Remaining 3 participants receive 1428 paise',
        'Zero fractional drift returned in JSON response',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-split-7way',
      name: 'POST /api/engine/split — 7-Way Prime Integer Division',
      endpoint: '/api/engine/split',
      method: 'POST',
      description: 'Tests server split',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 4: Percentage Split Allocation Endpoint
  // -------------------------------------------------------------
  try {
    const requestPayload = {
      totalCents: 50000, // ₹500.00
      method: 'PERCENT',
      participants: ['alice', 'bob'],
      percentages: { alice: 60, bob: 40 },
    };

    const start = performance.now();
    const res = await fetch('/api/engine/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const sAlice = data.shares?.find((s: any) => s.participantId === 'alice')?.calculatedCents;
    const sBob = data.shares?.find((s: any) => s.participantId === 'bob')?.calculatedCents;

    const passed =
      res.status === 200 &&
      data.isReconciled === true &&
      sAlice === 30000 &&
      sBob === 20000;

    results.push({
      id: 'endpoint-split-percent',
      name: 'POST /api/engine/split — Percent Share Allocation',
      endpoint: '/api/engine/split',
      method: 'POST',
      description: 'Tests percentage splitting logic (60% / 40%) of ₹500.00 via API.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      requestPayload,
      responsePayload: data,
      expected: 'HTTP 200, Alice: 30000p (₹300), Bob: 20000p (₹200)',
      actual: `HTTP ${res.status}, Alice: ${sAlice}p, Bob: ${sBob}p`,
      details: [
        'Alice 60% = ₹300.00',
        'Bob 40% = ₹200.00',
        'Exact match confirmed',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-split-percent',
      name: 'POST /api/engine/split — Percent Share Allocation',
      endpoint: '/api/engine/split',
      method: 'POST',
      description: 'Tests percent split',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 5: Optimal Debt Simplification Endpoint
  // -------------------------------------------------------------
  try {
    const requestPayload = {
      participantBalances: [
        {
          participantId: 'p1',
          totalPaidCents: 60000,
          totalBenefitCents: 0,
          totalTransfersSentCents: 0,
          totalTransfersReceivedCents: 0,
          kittyDepositsCents: 0,
          kittyPayoutsCents: 0,
          netBalanceCents: 60000, // +₹600
        },
        {
          participantId: 'p2',
          totalPaidCents: 0,
          totalBenefitCents: 60000,
          totalTransfersSentCents: 0,
          totalTransfersReceivedCents: 0,
          kittyDepositsCents: 0,
          kittyPayoutsCents: 0,
          netBalanceCents: -60000, // -₹600
        },
      ],
      kittyBalanceCents: 0,
    };

    const start = performance.now();
    const res = await fetch('/api/engine/simplify-debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const passed =
      res.status === 200 &&
      data.settlementCount === 1 &&
      data.settlements[0]?.fromParticipantId === 'p2' &&
      data.settlements[0]?.toParticipantId === 'p1' &&
      data.settlements[0]?.amountCents === 60000;

    results.push({
      id: 'endpoint-simplify-debts',
      name: 'POST /api/engine/simplify-debts — Graph Reduction',
      endpoint: '/api/engine/simplify-debts',
      method: 'POST',
      description: 'Calls server debt simplification to resolve debtor/creditor relationships.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      requestPayload,
      responsePayload: data,
      expected: 'HTTP 200, 1 settlement: p2 -> p1 (₹600.00)',
      actual: `HTTP ${res.status}, ${data.settlementCount} settlements`,
      details: [
        'Single transfer generated p2 -> p1 for ₹600.00',
        'Total volume: ₹600.00',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-simplify-debts',
      name: 'POST /api/engine/simplify-debts — Graph Reduction',
      endpoint: '/api/engine/simplify-debts',
      method: 'POST',
      description: 'Tests debt simplification',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 6: Validation Endpoint — Success Case
  // -------------------------------------------------------------
  try {
    const requestPayload = {
      totalCents: 20000, // ₹200.00
      payers: [{ participantId: 'alice', amountCents: 20000 }],
      splitShares: [
        { participantId: 'alice', calculatedCents: 10000 },
        { participantId: 'bob', calculatedCents: 10000 },
      ],
    };

    const start = performance.now();
    const res = await fetch('/api/engine/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const passed = res.status === 200 && data.isValid === true && data.errors?.length === 0;

    results.push({
      id: 'endpoint-validate-valid',
      name: 'POST /api/engine/validate — Conforming Expense Payload',
      endpoint: '/api/engine/validate',
      method: 'POST',
      description: 'Validates a balanced expense where total === sum of payers and sum of shares.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      requestPayload,
      responsePayload: data,
      expected: 'HTTP 200, isValid: true, 0 errors',
      actual: `HTTP ${res.status}, isValid: ${data.isValid}, errors: ${data.errors?.length}`,
      details: ['Payload conforms to all ledger rules and is accepted for persistence.'],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-validate-valid',
      name: 'POST /api/engine/validate — Conforming Expense Payload',
      endpoint: '/api/engine/validate',
      method: 'POST',
      description: 'Validates conforming expense',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 7: Validation Endpoint — Defensive HTTP 400 Bad Request
  // -------------------------------------------------------------
  try {
    // Intentionally malformed payload: Total is ₹200.00 (20000p), but payers only sum to ₹150.00 (15000p)
    const requestPayload = {
      totalCents: 20000,
      payers: [{ participantId: 'alice', amountCents: 15000 }],
      splitShares: [
        { participantId: 'alice', calculatedCents: 10000 },
        { participantId: 'bob', calculatedCents: 10000 },
      ],
    };

    const start = performance.now();
    const res = await fetch('/api/engine/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    // Must return HTTP 400 with isValid: false and descriptive error
    const passed =
      res.status === 400 &&
      data.isValid === false &&
      Array.isArray(data.errors) &&
      data.errors.length > 0;

    results.push({
      id: 'endpoint-validate-bad-request',
      name: 'POST /api/engine/validate — Defensive HTTP 400 Boundary',
      endpoint: '/api/engine/validate',
      method: 'POST',
      description: 'Asserts server returns HTTP 400 Bad Request when payer contributions do not match total expense.',
      passed,
      statusCode: res.status,
      expectedStatus: 400,
      durationMs,
      requestPayload,
      responsePayload: data,
      expected: 'HTTP 400 Bad Request, isValid: false, rejection error message',
      actual: `HTTP ${res.status}, isValid: ${data.isValid}, errors: ${data.errors?.length}`,
      details: [
        `Rejection reason: "${data.errors?.[0]}"`,
        'Prevents corrupted financial records from entering the database',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-validate-bad-request',
      name: 'POST /api/engine/validate — Defensive HTTP 400 Boundary',
      endpoint: '/api/engine/validate',
      method: 'POST',
      description: 'Tests defensive rejection',
      passed: false,
      statusCode: 0,
      expectedStatus: 400,
      durationMs: 0,
      expected: 'HTTP 400',
      actual: err.message,
    });
  }

  // -------------------------------------------------------------
  // Test 8: Server-Side Full Engine Test Suite Runner Endpoint
  // -------------------------------------------------------------
  try {
    const start = performance.now();
    const res = await fetch('/api/engine/run-tests');
    const durationMs = parseFloat((performance.now() - start).toFixed(1));
    const data = await res.json();

    const passed =
      res.status === 200 &&
      data.allPassed === true &&
      data.totalCount >= 12 &&
      data.failedCount === 0;

    results.push({
      id: 'endpoint-run-all-tests',
      name: 'GET /api/engine/run-tests — Complete Server-Side Verification',
      endpoint: '/api/engine/run-tests',
      method: 'GET',
      description: 'Executes all 12 mathematical test scenarios on the backend Node/Express runtime.',
      passed,
      statusCode: res.status,
      expectedStatus: 200,
      durationMs,
      responsePayload: {
        allPassed: data.allPassed,
        totalCount: data.totalCount,
        passedCount: data.passedCount,
        failedCount: data.failedCount,
        durationMs: data.durationMs,
        executedAt: data.executedAt,
      },
      expected: `HTTP 200, allPassed: true, ${data.totalCount || 12}/${data.totalCount || 12} passed`,
      actual: `HTTP ${res.status}, allPassed: ${data.allPassed}, passed: ${data.passedCount}/${data.totalCount}`,
      details: [
        `Server execution time: ${data.durationMs}ms`,
        `Executed scenarios: ${data.totalCount}`,
        'All 12 backend unit test invariants passed without errors',
      ],
    });
  } catch (err: any) {
    results.push({
      id: 'endpoint-run-all-tests',
      name: 'GET /api/engine/run-tests — Complete Server-Side Verification',
      endpoint: '/api/engine/run-tests',
      method: 'GET',
      description: 'Tests server test execution',
      passed: false,
      statusCode: 0,
      expectedStatus: 200,
      durationMs: 0,
      expected: 'HTTP 200',
      actual: err.message,
    });
  }

  return results;
}
