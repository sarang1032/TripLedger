/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MIN_DATE_INPUT = '1900-01-01';
export const MAX_DATE_INPUT = '9999-12-31';

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's local timezone.
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Constrains a date string's year component to at most 4 digits (YYYY-MM-DD).
 * Prevents browsers from accepting or rendering 5 or 6 digit years.
 */
export function sanitizeDateInput(value: string): string {
  if (!value) return value;
  const parts = value.split('-');
  if (parts[0] && parts[0].length > 4) {
    parts[0] = parts[0].slice(0, 4);
    return parts.join('-');
  }
  return value;
}

