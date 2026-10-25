/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trip } from '../types/trip';

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const TWO_DAYS_MS = 2 * ONE_DAY_MS; // 48 hours
export const ONE_WEEK_MS = 7 * ONE_DAY_MS; // 7 days

/**
 * Computes the default expiration date (1 month from date of trip creation).
 */
export function computeInitialExpiresAt(createdAtIso?: string): string {
  const base = createdAtIso ? new Date(createdAtIso) : new Date();
  if (isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + 1);
    return fallback.toISOString();
  }
  const exp = new Date(base.getTime());
  exp.setMonth(exp.getMonth() + 1);
  return exp.toISOString();
}

/**
 * Adds exactly 1 week (7 days) to an existing expiration timestamp.
 */
export function computeExtendedExpiresAt(currentExpiresAtIso?: string): string {
  const base = currentExpiresAtIso ? new Date(currentExpiresAtIso) : new Date();
  const current = isNaN(base.getTime()) ? new Date() : base;
  return new Date(current.getTime() + ONE_WEEK_MS).toISOString();
}

export interface TripTimerStatus {
  expiresAt: string;
  msRemaining: number;
  isExpired: boolean;
  isEligibleForExtension: boolean; // only when <= 2 days left and not already extended
  extensionAdded: boolean;
  extendedAt?: string;
  formattedTimeLeft: string;
  urgencyLevel: 'normal' | 'warning' | 'critical' | 'expired';
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  secondsLeft: number;
}

/**
 * Evaluates the live expiration timer status for any given trip.
 */
export function getTripTimerStatus(trip: Trip, now: Date = new Date()): TripTimerStatus {
  // If no expiresAt is recorded on the trip, compute it from createdAt (1 month default)
  const expiresAt = trip.expiresAt || computeInitialExpiresAt(trip.createdAt);
  const expDate = new Date(expiresAt);
  const nowMs = now.getTime();
  const expMs = isNaN(expDate.getTime()) ? nowMs + 30 * ONE_DAY_MS : expDate.getTime();
  const msRemaining = expMs - nowMs;

  const isExpired = msRemaining <= 0;
  const extensionAdded = !!trip.extensionAdded;

  // Eligible only when:
  // 1. Not already extended (once per trip)
  // 2. Only 2 days or fewer left (<= 48 hours)
  // 3. Not already expired
  const isEligibleForExtension = !extensionAdded && !isExpired && msRemaining <= TWO_DAYS_MS;

  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const daysLeft = Math.floor(totalSeconds / 86400);
  const hoursLeft = Math.floor((totalSeconds % 86400) / 3600);
  const minutesLeft = Math.floor((totalSeconds % 3600) / 60);
  const secondsLeft = totalSeconds % 60;

  let urgencyLevel: TripTimerStatus['urgencyLevel'] = 'normal';
  if (isExpired) {
    urgencyLevel = 'expired';
  } else if (msRemaining <= TWO_DAYS_MS) {
    urgencyLevel = 'critical'; // <= 2 days (eligible for +1 week extension)
  } else if (msRemaining <= 5 * ONE_DAY_MS) {
    urgencyLevel = 'warning';
  }

  let formattedTimeLeft = '';
  if (isExpired) {
    formattedTimeLeft = 'Expired (Pending Deletion)';
  } else if (daysLeft > 2) {
    formattedTimeLeft = `${daysLeft} days left`;
  } else if (daysLeft >= 1) {
    formattedTimeLeft = `${daysLeft}d ${hoursLeft}h ${minutesLeft}m left`;
  } else if (hoursLeft >= 1) {
    formattedTimeLeft = `${hoursLeft}h ${minutesLeft}m ${secondsLeft}s left`;
  } else {
    formattedTimeLeft = `${minutesLeft}m ${secondsLeft}s left`;
  }

  return {
    expiresAt,
    msRemaining,
    isExpired,
    isEligibleForExtension,
    extensionAdded,
    extendedAt: trip.extendedAt,
    formattedTimeLeft,
    urgencyLevel,
    daysLeft,
    hoursLeft,
    minutesLeft,
    secondsLeft,
  };
}
