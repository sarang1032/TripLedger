/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trip } from '../types/trip';
import { allocateNextTripKey } from '../utils/tripKeyGenerator';
import { computeInitialExpiresAt, getTripTimerStatus } from '../utils/tripTimer';

const STORAGE_KEY = 'equitrip_trips_v2';
const ACTIVE_TRIP_KEY = 'equitrip_active_trip_id_v2';
const CUSTOM_CATEGORIES_KEY = 'equitrip_custom_categories_v1';
const TRIP_HISTORY_CACHE_KEY = 'tjourney_trip_cache_history_v1';

export interface CustomCategoryItem {
  key: string;
  label: string;
  icon?: string;
}

export interface CachedTripHistoryItem {
  tripKey: string;
  tripId: string;
  tripName: string;
  description?: string;
  baseCurrency: string;
  participantCount: number;
  transactionCount: number;
  totalExpenseCents: number;
  createdAt: string;
  lastSeenAt: string;
  isDeletedLocally: boolean;
  deletedAt?: string;
  cachedTripSnapshot: Trip;
}

export interface StorageExportFormat {
  version: number;
  exportedAt: string;
  app: string;
  trips: Trip[];
}

export class StorageService {
  /**
   * Known sample trip IDs to auto-purge so any cached demo data is wiped
   */
  private static readonly SAMPLE_TRIP_IDS = new Set([
    'trip-goa-villa-2026',
    'trip-manali-kitty-2026',
    'trip-tahoe-ski-2026',
    'trip-kyoto-osaka-2026',
    'sample-trip-goa',
    'sample-trip-manali',
  ]);

  /**
   * Load all trips from local storage
   */
  static loadTrips(): Trip[] {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) {
        return [];
      }
      const parsed = JSON.parse(serialized);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Purge any sample records
        const userTrips = parsed.filter(
          (t: any) =>
            t &&
            t.id &&
            !this.SAMPLE_TRIP_IDS.has(t.id) &&
            t.tripKey !== '148192' &&
            t.tripKey !== '689549'
        );

        if (userTrips.length !== parsed.length) {
          this.saveTrips(userTrips);
        }

        if (userTrips.length === 0) {
          return [];
        }

        // Ensure all loaded trips have a 6-digit unique tripKey and use INR
        const existingKeys: string[] = [];
        let hasChanges = false;

        const inrTrips: Trip[] = [];
        for (const t of userTrips as Trip[]) {
          let tripKey = t.tripKey;
          if (!tripKey || tripKey.length !== 6 || !/^\d{6}$/.test(tripKey)) {
            const { key } = allocateNextTripKey(existingKeys);
            tripKey = key;
            hasChanges = true;
          }
          existingKeys.push(tripKey);

          let expiresAt = t.expiresAt;
          if (!expiresAt) {
            expiresAt = computeInitialExpiresAt(t.createdAt);
            hasChanges = true;
          }

          const timerStatus = getTripTimerStatus({ ...t, expiresAt });
          if (timerStatus.isExpired) {
            // Expired: automatically purged from records
            hasChanges = true;
            this.archiveTripInMongo(t.id).catch(() => {});
            continue;
          }

          inrTrips.push({
            ...t,
            tripKey,
            expiresAt,
            extensionAdded: !!t.extensionAdded,
            extendedAt: t.extendedAt || undefined,
            baseCurrency: 'INR',
            transactions: (t.transactions || []).map((tx) => ({
              ...tx,
              currency: 'INR',
              exchangeRateToBase: 1.0,
            })),
          });
        }

        if (hasChanges) {
          this.saveTrips(inrTrips);
        } else {
          this.syncTripsToHistory(inrTrips);
        }

        return inrTrips;
      }
      return [];
    } catch (err) {
      console.error('Failed to load trips from storage:', err);
      return [];
    }
  }

  /**
   * Persist trips list
   */
  static saveTrips(trips: Trip[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      // Keep local device cache history in sync
      this.syncTripsToHistory(trips);
      // Asynchronously sync with MongoDB if configured
      this.syncToMongo(trips).catch(() => {});
    } catch (err) {
      console.error('Failed to persist trips to localStorage:', err);
    }
  }

  // -------------------------------------------------------------
  // Local Device History & Cache Mechanism
  // Stores trip metadata + snapshot on user's device even if deleted
  // -------------------------------------------------------------

  /**
   * Load local device history cache of all trips known to this device
   */
  static loadCachedHistory(): CachedTripHistoryItem[] {
    try {
      const raw = localStorage.getItem(TRIP_HISTORY_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out sample records
        const filtered = parsed.filter(
          (it: any) =>
            it &&
            !this.SAMPLE_TRIP_IDS.has(it.tripId) &&
            it.tripKey !== '148192' &&
            it.tripKey !== '689549'
        );
        if (filtered.length !== parsed.length) {
          this.saveCachedHistory(filtered);
        }
        // Return sorted by lastSeenAt descending
        return filtered.sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());
      }
      return [];
    } catch (err) {
      console.error('Failed to read device trip history cache:', err);
      return [];
    }
  }

  /**
   * Save local device history cache
   */
  static saveCachedHistory(items: CachedTripHistoryItem[]): void {
    try {
      localStorage.setItem(TRIP_HISTORY_CACHE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to write device trip history cache:', err);
    }
  }

  /**
   * Record or update a trip in the local device history cache
   */
  static recordTripInHistory(trip: Trip, isDeleted = false): void {
    try {
      if (!trip || !trip.id) return;
      const key = trip.tripKey || '';
      const items = this.loadCachedHistory();

      // Calculate total expense cents for summary
      const totalExpenseCents = (trip.transactions || [])
        .filter((tx) => tx.type === 'EXPENSE')
        .reduce((sum, tx) => sum + (tx.totalAmountCents || 0), 0);

      const existingIndex = items.findIndex((it) => it.tripId === trip.id || (key && it.tripKey === key));

      const updatedItem: CachedTripHistoryItem = {
        tripId: trip.id,
        tripKey: key,
        tripName: trip.name || 'Untitled Trip',
        description: trip.description || '',
        baseCurrency: trip.baseCurrency || 'INR',
        participantCount: (trip.participants || []).length,
        transactionCount: (trip.transactions || []).length,
        totalExpenseCents,
        createdAt: trip.createdAt || new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        isDeletedLocally: isDeleted,
        deletedAt: isDeleted ? new Date().toISOString() : undefined,
        cachedTripSnapshot: {
          ...trip,
          isDeleted,
        },
      };

      if (existingIndex >= 0) {
        items[existingIndex] = {
          ...items[existingIndex],
          ...updatedItem,
          // Preserve original createdAt if present
          createdAt: items[existingIndex].createdAt || updatedItem.createdAt,
        };
      } else {
        items.unshift(updatedItem);
      }

      this.saveCachedHistory(items);
    } catch (err) {
      console.error('Failed to record trip in device history cache:', err);
    }
  }

  /**
   * Sync active trips array to the local device cache history
   */
  static syncTripsToHistory(trips: Trip[]): void {
    try {
      for (const trip of trips) {
        this.recordTripInHistory(trip, false);
      }
    } catch (err) {
      console.error('Failed syncing active trips to device history:', err);
    }
  }

  /**
   * Find a cached trip by its 6-digit key
   */
  static getCachedTripByKey(tripKey: string): CachedTripHistoryItem | undefined {
    const items = this.loadCachedHistory();
    const cleanKey = tripKey.trim();
    return items.find((it) => it.tripKey === cleanKey);
  }

  /**
   * Remove single entry from device cache history (if explicitly purged)
   */
  static removeCachedHistoryItem(tripIdOrKey: string): void {
    const items = this.loadCachedHistory();
    const filtered = items.filter((it) => it.tripId !== tripIdOrKey && it.tripKey !== tripIdOrKey);
    this.saveCachedHistory(filtered);
  }

  /**
   * Check MongoDB connection status
   */
  static async checkMongoStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    message: string;
    hint?: string;
    database?: string;
    tripCount?: number;
    counterI?: number;
  }> {
    try {
      const res = await fetch('/api/mongodb/status');
      if (res.ok) {
        return await res.json();
      }
      return { configured: false, connected: false, message: 'Server endpoint returned error' };
    } catch {
      return { configured: false, connected: false, message: 'Unable to reach backend API' };
    }
  }

  /**
   * Sync trips to MongoDB backend in background
   */
  static async syncToMongo(trips: Trip[]): Promise<boolean> {
    try {
      const res = await fetch('/api/mongodb/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trips }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch trips from MongoDB backend
   */
  static async fetchFromMongo(): Promise<{ success: boolean; trips?: Trip[]; error?: string }> {
    try {
      const res = await fetch('/api/mongodb/trips');
      if (!res.ok) return { success: false, error: 'Failed to fetch from MongoDB' };
      const data = await res.json();
      if (data.configured && Array.isArray(data.trips) && data.trips.length > 0) {
        return { success: true, trips: data.trips };
      }
      return { success: false, error: data.message || 'No trips found in MongoDB' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * Fetch a single trip directly from MongoDB using its 6-digit key
   * Returns Trip if found and active, null otherwise
   */
  static async fetchTripByKeyFromDb(tripKey: string): Promise<Trip | null> {
    const cleanKey = (tripKey || '').trim();
    if (!/^\d{6}$/.test(cleanKey)) return null;

    try {
      const res = await fetch(`/api/mongodb/trips/key/${encodeURIComponent(cleanKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.trip) {
          const loadedTrip: Trip = {
            ...data.trip,
            isDeleted: false,
          };
          this.recordTripInHistory(loadedTrip, false);
          return loadedTrip;
        }
      }
    } catch (err) {
      console.warn(`[StorageService] Failed to fetch trip #${cleanKey} from DB:`, err);
    }
    return null;
  }

  /**
   * Sync a single trip to MongoDB backend
   */
  static async syncSingleTripToMongo(trip: Trip): Promise<boolean> {
    try {
      const res = await fetch('/api/mongodb/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trips: [trip] }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Load Trip by 6-Digit Unique Key
   * Checks MongoDB first, and falls back to local device cache if offline or unconfigured
   */
  static async loadTripByKey(
    tripKey: string
  ): Promise<{ success: boolean; trip?: Trip; source?: 'mongodb' | 'cache'; message?: string; error?: string }> {
    const cleanKey = tripKey.trim();
    if (!/^\d{6}$/.test(cleanKey)) {
      return { success: false, error: 'Unique trip key must be exactly 6 digits (100000 - 999999).' };
    }

    // 1. Try to fetch from MongoDB cloud endpoint
    try {
      const res = await fetch(`/api/mongodb/trips/key/${encodeURIComponent(cleanKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.trip) {
          const loadedTrip: Trip = {
            ...data.trip,
            isDeleted: false,
          };
          // Record into local device history cache as active
          this.recordTripInHistory(loadedTrip, false);
          return {
            success: true,
            trip: loadedTrip,
            source: 'mongodb',
            message: `Trip "${loadedTrip.name}" loaded successfully from MongoDB.`,
          };
        }
      } else if (res.status === 404) {
        // Not in MongoDB, proceed to check local cache
      }
    } catch {
      // MongoDB network fetch failed, proceed to local cache check
    }

    // 2. Fall back to local device cache
    const cachedItem = this.getCachedTripByKey(cleanKey);
    if (cachedItem && cachedItem.cachedTripSnapshot) {
      const loadedTrip: Trip = {
        ...cachedItem.cachedTripSnapshot,
        isDeleted: false,
      };
      // Mark active in cache
      this.recordTripInHistory(loadedTrip, false);
      // Attempt to sync back to MongoDB if connected
      this.syncToMongo([loadedTrip]).catch(() => {});
      return {
        success: true,
        trip: loadedTrip,
        source: 'cache',
        message: `Trip "${loadedTrip.name}" loaded successfully from local device cache.`,
      };
    }

    return {
      success: false,
      error: `No trip found matching 6-digit key #${cleanKey} in MongoDB or local device history.`,
    };
  }

  /**
   * Soft Delete / Archive trip in MongoDB (preserves record for key retrieval)
   */
  static async archiveTripInMongo(tripId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/mongodb/trips/${tripId}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Request 1-week extension for an eligible trip (<= 2 days left, only once per trip)
   */
  static async extendTrip(tripId: string): Promise<{ success: boolean; trip?: Trip; error?: string }> {
    try {
      const res = await fetch(`/api/mongodb/trips/${encodeURIComponent(tripId)}/extend`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, trip: data.trip };
      }
      return { success: false, error: data.error || 'Failed to extend trip' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network request failed' };
    }
  }

  /**
   * Legacy alias for backward compatibility
   */
  static async deleteFromMongo(tripId: string): Promise<boolean> {
    return this.archiveTripInMongo(tripId);
  }

  /**
   * Get ID of the currently active trip
   */
  static getActiveTripId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_TRIP_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Set currently active trip ID (or null to clear)
   */
  static setActiveTripId(tripId: string | null): void {
    try {
      if (tripId) {
        localStorage.setItem(ACTIVE_TRIP_KEY, tripId);
      } else {
        localStorage.removeItem(ACTIVE_TRIP_KEY);
      }
    } catch (err) {
      console.error('Failed to save active trip ID:', err);
    }
  }

  /**
   * Load custom categories saved permanently
   */
  static loadCustomCategories(): CustomCategoryItem[] {
    try {
      const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a new custom category permanently
   */
  static saveCustomCategory(category: CustomCategoryItem): CustomCategoryItem[] {
    try {
      const existing = this.loadCustomCategories();
      const filtered = existing.filter(
        (c) =>
          c.key.toLowerCase() !== category.key.toLowerCase() &&
          c.label.toLowerCase() !== category.label.toLowerCase()
      );
      const updated = [...filtered, category];
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(updated));
      return updated;
    } catch (err) {
      console.error('Failed to save custom category:', err);
      return [];
    }
  }

  /**
   * Export all trips as JSON string
   */
  static exportBackup(): string {
    const trips = this.loadTrips();
    const backup: StorageExportFormat = {
      version: 2,
      exportedAt: new Date().toISOString(),
      app: 'TJourney',
      trips,
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import backup JSON with rigorous validation
   */
  static importBackup(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);

      // Support either direct Trip[] array, { trips: Trip[] } export envelope, or individual { trip: Trip }
      let candidateTrips: any[] = [];
      if (Array.isArray(parsed)) {
        candidateTrips = parsed;
      } else if (parsed && Array.isArray(parsed.trips)) {
        candidateTrips = parsed.trips;
      } else if (parsed && parsed.trip && typeof parsed.trip === 'object') {
        candidateTrips = [parsed.trip];
      } else if (parsed && parsed.id && parsed.name) {
        candidateTrips = [parsed];
      } else {
        return { success: false, count: 0, error: 'Invalid file format. Expected a list of trips or a TJourney export backup.' };
      }

      // Basic structural validation
      const validTrips: Trip[] = [];
      for (const t of candidateTrips) {
        if (!t.id || !t.name || !Array.isArray(t.participants) || !Array.isArray(t.transactions)) {
          return { success: false, count: 0, error: `Invalid trip object format for trip "${t.name || 'Untitled'}".` };
        }
        validTrips.push(t as Trip);
      }

      if (validTrips.length === 0) {
        return { success: false, count: 0, error: 'Backup contained no valid trips.' };
      }

      // Merge into existing trips (replace trips with same ID, append new ones)
      const existing = this.loadTrips();
      const existingKeys: string[] = existing.map((t) => t.tripKey).filter(Boolean) as string[];

      for (const t of validTrips) {
        if (!t.tripKey || t.tripKey.length !== 6 || !/^\d{6}$/.test(t.tripKey)) {
          const { key } = allocateNextTripKey(existingKeys);
          t.tripKey = key;
          existingKeys.push(key);
        }
      }

      const existingMap = new Map(existing.map((t) => [t.id, t]));
      validTrips.forEach((t) => existingMap.set(t.id, t));

      const merged = Array.from(existingMap.values());
      this.saveTrips(merged);

      // Set active trip to the first imported trip
      if (validTrips[0]) {
        this.setActiveTripId(validTrips[0].id);
      }

      return { success: true, count: validTrips.length };
    } catch (err: any) {
      return { success: false, count: 0, error: `JSON parsing error: ${err.message}` };
    }
  }

  /**
   * Clear all local trips
   */
  static clearAllTrips(): Trip[] {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_TRIP_KEY);
    return [];
  }
}
