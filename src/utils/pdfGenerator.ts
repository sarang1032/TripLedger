/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Participant, SettlementTransfer, Transaction, Trip } from '../types/trip';
import { calculateBalances, calculateOptimalSettlements } from '../engine/calculator';
import { CATEGORY_LABELS } from './constants';

export function formatPdfMoney(cents: number, currency = 'INR'): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents) / 100;
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = currency === 'INR' ? 'Rs. ' : `${currency} `;
  return `${isNegative ? '-' : ''}${prefix}${formatted}`;
}

export function generateTripPdf(trip: Trip): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let currentY = 16;

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

  let pageNumber = 1;

  const printHeaderAndFooter = (pageNum: number) => {
    // Header line on subsequent pages
    if (pageNum > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text('TJourney · Trip Settlement & Expense Audit Report', marginX, 10);
      const rightText = trip.tripKey ? `${trip.name} (#${trip.tripKey})` : trip.name;
      doc.text(rightText, pageWidth - marginX, 10, { align: 'right' });
      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.2);
      doc.line(marginX, 12, pageWidth - marginX, 12);
    }

    // Footer on all pages
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(`Generated on ${dateStr} · TJourney App`, marginX, pageHeight - 10);
    doc.text(`Page ${pageNum}`, pageWidth - marginX, pageHeight - 10, { align: 'right' });
    doc.setDrawColor(225, 225, 230);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
  };

  const checkPageBreak = (neededHeight: number): void => {
    if (currentY + neededHeight > pageHeight - 18) {
      printHeaderAndFooter(pageNumber);
      doc.addPage();
      pageNumber++;
      currentY = 20;
    }
  };

  // --- COVER / HEADER SECTION ---
  // Brand Pill / Tag
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(marginX, currentY, 24, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('TJOURNEY', marginX + 12, currentY + 4.2, { align: 'center' });

  if (trip.tripKey) {
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX + 26, currentY, 24, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text(`#${trip.tripKey}`, marginX + 38, currentY + 4.2, { align: 'center' });
  }

  currentY += 11;

  // Trip Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39); // Gray 900
  doc.text(trip.name, marginX, currentY);
  currentY += 6;

  // Metadata line (Dates, currency, participants)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // Gray 500
  const dates = [trip.startDate, trip.endDate].filter(Boolean).join(' to ');
  const metaParts = [
    dates ? `Duration: ${dates}` : null,
    `Base Currency: ${trip.baseCurrency || 'INR'}`,
    `Active Members: ${participants.length}`,
    `Total Transactions: ${transactions.length}`,
  ].filter(Boolean);
  doc.text(metaParts.join('   |   '), marginX, currentY);
  currentY += 4;

  if (trip.description) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);
    doc.text(trip.description, marginX, currentY);
    currentY += 4;
  }

  currentY += 4;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 7;

  // --- EXECUTIVE SUMMARY METRICS (4 CARDS) ---
  const cardW = (contentWidth - 9) / 4;
  const cardH = 18;
  const metrics = [
    { label: 'TOTAL EXPENSES', val: formatPdfMoney(totalExpensesCents, trip.baseCurrency) },
    { label: 'PARTICIPANTS', val: `${participants.length} Active` },
    { label: 'KITTY FUND', val: formatPdfMoney(kittyBalanceCents, trip.baseCurrency) },
    { label: 'SETTLEMENTS', val: `${settlements.length} Needed` },
  ];

  metrics.forEach((m, i) => {
    const x = marginX + i * (cardW + 3);
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, currentY, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(107, 114, 128);
    doc.text(m.label, x + 3.5, currentY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text(m.val, x + 3.5, currentY + 12.5);
  });

  currentY += cardH + 7;

  // --- SECTION 1: OPTIMAL DEBT SETTLEMENT PLAN ---
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('1. Optimal Settlement Plan', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Calculated using greedy min-cash-flow algorithm for minimum transactions', marginX + 54, currentY);
  currentY += 5;

  if (settlements.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(marginX, currentY, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('All debts are completely settled! No further payments are required.', marginX + 5, currentY + 7.5);
    currentY += 17;
  } else {
    settlements.forEach((s) => {
      checkPageBreak(9);
      const fromP = pMap.get(s.fromParticipantId);
      const toP = pMap.get(s.toParticipantId);
      const fromName = fromP ? fromP.name : s.fromParticipantId === 'COMMON_KITTY_FUND' ? 'Common Kitty' : 'Unknown';
      const toName = toP ? toP.name : s.toParticipantId === 'COMMON_KITTY_FUND' ? 'Common Kitty' : 'Unknown';

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'FD');

      // Checkbox square
      doc.setDrawColor(156, 163, 175);
      doc.rect(marginX + 3.5, currentY + 2, 4, 4);

      // Payment text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.text(`${fromName}`, marginX + 11, currentY + 5.2);

      const fromW = doc.getTextWidth(`${fromName}`);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('pays', marginX + 13 + fromW, currentY + 5.2);

      const paysW = doc.getTextWidth('pays');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(`${toName}:`, marginX + 15 + fromW + paysW, currentY + 5.2);

      // Amount right-aligned
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(79, 70, 229);
      doc.text(formatPdfMoney(s.amountCents, trip.baseCurrency), pageWidth - marginX - 4, currentY + 5.2, { align: 'right' });

      currentY += 9.5;
    });
    currentY += 3;
  }

  // --- SECTION 2: MEMBER NET BALANCES TABLE ---
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('2. Member Net Balances & Cost Share', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(isBalanced ? 34 : 220, isBalanced ? 139 : 38, isBalanced ? 34 : 38);
  doc.text(isBalanced ? 'Audit Verified: Sum of Net Balances = Zero' : 'Audit Imbalance Detected', marginX + 75, currentY);
  currentY += 5;

  // Table Header
  const colW = {
    name: 44,
    paid: 32,
    share: 32,
    transfers: 34,
    net: 40,
  };

  const printBalanceHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);

    let xCursor = marginX + 3;
    doc.text('MEMBER', xCursor, currentY + 4.8);
    xCursor += colW.name;

    doc.text('TOTAL PAID', xCursor + colW.paid - 3, currentY + 4.8, { align: 'right' });
    xCursor += colW.paid;

    doc.text('FAIR SHARE', xCursor + colW.share - 3, currentY + 4.8, { align: 'right' });
    xCursor += colW.share;

    doc.text('NET TRANSFERS', xCursor + colW.transfers - 3, currentY + 4.8, { align: 'right' });
    xCursor += colW.transfers;

    doc.text('FINAL NET BALANCE', xCursor + colW.net - 3, currentY + 4.8, { align: 'right' });

    currentY += 7;
  };

  printBalanceHeader();

  participantBalances.forEach((b, index) => {
    checkPageBreak(8);
    const p = pMap.get(b.participantId);
    const name = p ? p.name : 'Unknown';

    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(marginX, currentY, contentWidth, 7, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);

    let xCursor = marginX + 3;
    doc.text(name, xCursor, currentY + 4.8);
    xCursor += colW.name;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(formatPdfMoney(b.totalPaidCents, trip.baseCurrency), xCursor + colW.paid - 3, currentY + 4.8, { align: 'right' });
    xCursor += colW.paid;

    doc.text(formatPdfMoney(b.totalBenefitCents, trip.baseCurrency), xCursor + colW.share - 3, currentY + 4.8, { align: 'right' });
    xCursor += colW.share;

    const netTransferCents = b.totalTransfersSentCents - b.totalTransfersReceivedCents;
    const transferStr = netTransferCents === 0 ? '-' : formatPdfMoney(netTransferCents, trip.baseCurrency);
    doc.text(transferStr, xCursor + colW.transfers - 3, currentY + 4.8, { align: 'right' });
    xCursor += colW.transfers;

    // Net balance
    doc.setFont('helvetica', 'bold');
    if (b.netBalanceCents > 0.5) {
      doc.setTextColor(22, 101, 52); // Green
      doc.text(`+${formatPdfMoney(b.netBalanceCents, trip.baseCurrency)} (Gets)`, xCursor + colW.net - 3, currentY + 4.8, { align: 'right' });
    } else if (b.netBalanceCents < -0.5) {
      doc.setTextColor(185, 28, 28); // Red
      doc.text(`${formatPdfMoney(b.netBalanceCents, trip.baseCurrency)} (Owes)`, xCursor + colW.net - 3, currentY + 4.8, { align: 'right' });
    } else {
      doc.setTextColor(107, 114, 128); // Gray
      doc.text('Rs. 0.00 (Settled)', xCursor + colW.net - 3, currentY + 4.8, { align: 'right' });
    }

    currentY += 7;
  });

  currentY += 7;

  // --- SECTION 3: COMPLETE EXPENSE LEDGER ---
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('3. Complete Transactions Ledger', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`${transactions.length} total recorded items`, marginX + 66, currentY);
  currentY += 5;

  const txColW = {
    date: 22,
    title: 60,
    category: 28,
    paidBy: 40,
    amount: 32,
  };

  const printTxHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);

    let xCursor = marginX + 3;
    doc.text('DATE', xCursor, currentY + 4.8);
    xCursor += txColW.date;

    doc.text('DESCRIPTION', xCursor, currentY + 4.8);
    xCursor += txColW.title;

    doc.text('CATEGORY', xCursor, currentY + 4.8);
    xCursor += txColW.category;

    doc.text('PAID BY', xCursor, currentY + 4.8);
    xCursor += txColW.paidBy;

    doc.text('AMOUNT', xCursor + txColW.amount - 3, currentY + 4.8, { align: 'right' });

    currentY += 7;
  };

  printTxHeader();

  if (transactions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(156, 163, 175);
    doc.text('No transactions recorded for this trip yet.', marginX + 3, currentY + 6);
    currentY += 12;
  } else {
    // Sort transactions by date descending
    const sortedTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

    sortedTx.forEach((tx, index) => {
      checkPageBreak(8);

      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginX, currentY, contentWidth, 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(75, 85, 99);

      let xCursor = marginX + 3;
      doc.text(tx.date, xCursor, currentY + 4.8);
      xCursor += txColW.date;

      // Title truncated if too long
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      let title = tx.title;
      if (tx.type === 'TRANSFER') title = `[Transfer] ${tx.title}`;
      if (tx.type === 'KITTY_DEPOSIT') title = `[Kitty Deposit] ${tx.title}`;
      if (tx.type === 'KITTY_EXPENSE') title = `[Kitty Expense] ${tx.title}`;
      if (tx.type === 'KITTY_PAYOUT') title = `[Kitty Payout] ${tx.title}`;

      if (title.length > 34) {
        title = title.substring(0, 32) + '...';
      }
      doc.text(title, xCursor, currentY + 4.8);
      xCursor += txColW.title;

      // Category
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      const catLabel = CATEGORY_LABELS[tx.category]?.label || tx.category || 'General';
      doc.text(catLabel, xCursor, currentY + 4.8);
      xCursor += txColW.category;

      // Payer(s)
      const payerNames = tx.payers
        .map((p) => {
          if (p.participantId === 'COMMON_KITTY_FUND') return 'Common Kitty';
          return pMap.get(p.participantId)?.name || 'Someone';
        })
        .join(', ');
      let payerText = payerNames;
      if (payerText.length > 22) {
        payerText = payerText.substring(0, 20) + '...';
      }
      doc.text(payerText, xCursor, currentY + 4.8);
      xCursor += txColW.paidBy;

      // Amount
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(formatPdfMoney(tx.totalAmountCents, trip.baseCurrency), xCursor + txColW.amount - 3, currentY + 4.8, { align: 'right' });

      currentY += 7;
    });
  }

  // Final page footer print for last page
  printHeaderAndFooter(pageNumber);

  // Trigger browser download
  const safeTitle = trip.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const keyPart = trip.tripKey ? `_${trip.tripKey}` : '';
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `TJourney_${safeTitle}${keyPart}_Report_${dateStamp}.pdf`;

  doc.save(filename);
}
