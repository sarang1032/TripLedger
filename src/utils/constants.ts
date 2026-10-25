/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CurrencyConfig } from '../types/trip';

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', name: 'Indian Rupee (₹)', symbol: '₹', rateToBase: 1.0 },
];

export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  food: { label: 'Dining & Drinks', icon: 'Utensils' },
  groceries: { label: 'Groceries & Supplies', icon: 'ShoppingCart' },
  lodging: { label: 'Lodging & Accommodation', icon: 'Home' },
  transport: { label: 'Transport & Flights', icon: 'Train' },
  fuel: { label: 'Fuel & Gas', icon: 'Fuel' },
  activity: { label: 'Activities & Tickets', icon: 'Ticket' },
  entertainment: { label: 'Entertainment & Nightlife', icon: 'PartyPopper' },
  shopping: { label: 'Shopping', icon: 'Bag' },
  general: { label: 'General & Sundry', icon: 'DollarSign' },
};

export const AVATAR_PALETTE = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#16a34a', // Green
  '#e11d48', // Rose
];
