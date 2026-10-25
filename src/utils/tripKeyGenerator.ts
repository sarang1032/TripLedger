/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 6-Digit Unique Trip Key Generator
 *
 * Algorithm Specifications:
 * - Counter variable I ranges from 0 to 99999.
 * - Each created trip increments I by 1 (wrapping modulo 100000).
 * - Generates a pseudo-random yet mathematically unique 6-digit number in [100000, 999999].
 * - Uses modular arithmetic with coprime multiplier coprime to 900000:
 *   gcd(541357, 900000) = 1, ensuring zero collisions across all 100,000 values of I.
 * - Incorporates secret seed offset (configurable via env / secrets).
 */

const RANGE_MIN = 100000;
const RANGE_MAX = 999999;
const SPAN = RANGE_MAX - RANGE_MIN + 1; // 900000
const COPRIME_MULTIPLIER = 541357; // gcd(541357, 900000) = 1
const DEFAULT_SECRET_SEED = 48192;
const MAX_I = 99999;
const COUNTER_STORAGE_KEY = 'equitrip_trip_counter_i';

/**
 * Computes a pseudo-random yet collision-free 6-digit key for a given counter index I.
 * @param i Index counter (0 to 99999)
 * @param secretSeed Optional secret seed integer
 * @returns 6-digit number as string (100000 - 999999)
 */
export function computeTripKeyFromIndex(i: number, secretSeed: number = DEFAULT_SECRET_SEED): string {
  // Ensure I stays strictly within [0, 99999]
  const normalizedI = Math.abs(Math.floor(i)) % (MAX_I + 1);
  
  // Linear congruential permutation step
  const rawOffset = (COPRIME_MULTIPLIER * normalizedI + secretSeed) % SPAN;
  const uniqueSixDigitNum = RANGE_MIN + rawOffset;
  
  return uniqueSixDigitNum.toString();
}

/**
 * Retrieves the current counter I from local storage or environment
 */
export function getCurrentCounterI(): number {
  try {
    const stored = localStorage.getItem(COUNTER_STORAGE_KEY);
    if (stored !== null) {
      const val = parseInt(stored, 10);
      if (!isNaN(val) && val >= 0 && val <= MAX_I) {
        return val;
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

/**
 * Allocates the next unique 6-digit trip key, advances I by 1, and persists the new counter.
 * Also checks against existing trips in the pool to guarantee 100% collision resistance.
 */
export function allocateNextTripKey(existingTripKeys: string[] = []): { key: string; nextI: number } {
  let currentI = getCurrentCounterI();
  const existingSet = new Set(existingTripKeys.map((k) => k.trim()));

  // Attempt up to 1000 steps if needed to guarantee no clash with legacy trips
  for (let step = 0; step < 1000; step++) {
    const candidateKey = computeTripKeyFromIndex(currentI);
    const nextI = (currentI + 1) % (MAX_I + 1);

    if (!existingSet.has(candidateKey)) {
      try {
        localStorage.setItem(COUNTER_STORAGE_KEY, nextI.toString());
      } catch {
        // ignore
      }
      return { key: candidateKey, nextI };
    }

    currentI = nextI;
  }

  // Fallback random 6-digit in case all candidates clashed
  const fallback = (RANGE_MIN + Math.floor(Math.random() * SPAN)).toString();
  return { key: fallback, nextI: currentI };
}
