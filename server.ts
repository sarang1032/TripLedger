/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import "dotenv/config";
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { MongoClient } from 'mongodb';
import {
  calculateBalances,
  calculateEqualShares,
  calculateItemizedShares,
  calculateOptimalSettlements,
  calculatePercentShares,
  calculateWeightedShares,
  validateExpense,
} from './src/engine/calculator';
import { runEngineTestSuite } from './src/engine/testSuite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // AI Studio Dev Server runtime requirement: must listen on port 3000
  const PORT = 3000;

  // JSON Body Parser with reasonable limit
  app.use(express.json({ limit: '10mb' }));

  // Request logger for API calls
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
      });
    }
    next();
  });

  // -------------------------------------------------------------
  // MongoDB Compass / Atlas Database Client Setup
  // -------------------------------------------------------------
  const MONGODB_URI = process.env.MONGODB_URI || '';
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'equitrip';
  let mongoClient: MongoClient | null = null;

  async function getMongoDatabase() {
    if (!MONGODB_URI) return null;
    if (!mongoClient) {
      const client = new MongoClient(MONGODB_URI, {
        connectTimeoutMS: 8000,
        serverSelectionTimeoutMS: 8000,
      });
      try {
        await client.connect();
        mongoClient = client;
        console.log(`[MongoDB] Connected successfully to database: "${MONGODB_DB_NAME}"`);

        // Ensure TTL index so MongoDB automatically purges expired records
        try {
          await client.db(MONGODB_DB_NAME).collection('trips').createIndex(
            { expiresAtDate: 1 },
            { expireAfterSeconds: 0, name: 'trip_auto_delete_ttl' }
          );
        } catch {
          // Index might already exist or ignore
        }
      } catch (err) {
        mongoClient = null;
        try {
          await client.close();
        } catch {}
        throw err;
      }
    }
    return mongoClient.db(MONGODB_DB_NAME);
  }

  /**
   * Automatically deletes expired trip records directly from the database.
   * Runs periodically and on query triggers.
   */
  async function purgeExpiredTripsFromDb(): Promise<number> {
    try {
      const db = await getMongoDatabase();
      if (!db) return 0;
      const nowIso = new Date().toISOString();
      const nowDate = new Date();

      const result = await db.collection('trips').deleteMany({
        $or: [
          { expiresAt: { $exists: true, $type: 'string', $lte: nowIso } },
          { expiresAtDate: { $exists: true, $type: 'date', $lte: nowDate } },
        ],
      });

      if (result.deletedCount > 0) {
        console.log(`[Auto-Purge] Automatically deleted ${result.deletedCount} expired trip(s) from database.`);
      }
      return result.deletedCount;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------
  // 6-digit Unique Key Generator State & Invariant Algorithm
  // Counter I ranges from 0 to 99999, output ranges from 100000 to 999999
  // -------------------------------------------------------------
  const COPRIME_MULTIPLIER = 541357; // gcd(541357, 900000) = 1 (bijective on 900000)
  const RANGE_MIN = 100000;
  const SPAN = 900000;
  const MAX_I = 99999;
  let serverCounterI = parseInt(process.env.TRIP_INDEX_I || '0', 10);
  if (isNaN(serverCounterI) || serverCounterI < 0 || serverCounterI > MAX_I) {
    serverCounterI = 0;
  }
  const secretSeed = parseInt(process.env.TRIP_COUNTER_SECRET || '48192', 10) || 48192;

  function computeServerTripKey(i: number): string {
    const normI = Math.abs(Math.floor(i)) % (MAX_I + 1);
    const rawOffset = (COPRIME_MULTIPLIER * normI + secretSeed) % SPAN;
    return (RANGE_MIN + rawOffset).toString();
  }

  // -------------------------------------------------------------
  // REST API Endpoints for Expense Splitting & Settlement Engine
  // -------------------------------------------------------------

  /**
   * Health Check & MongoDB Status Endpoint
   * GET /api/health
   */
  app.get('/api/health', async (req: Request, res: Response) => {
    let mongoConnected = false;
    let mongoError: string | null = null;
    let tripCountInDb = 0;

    if (MONGODB_URI) {
      try {
        const db = await getMongoDatabase();
        if (db) {
          await db.command({ ping: 1 });
          mongoConnected = true;
          tripCountInDb = await db.collection('trips').countDocuments();
        }
      } catch (err: any) {
        mongoError = err?.message || String(err);
      }
    }

    res.json({
      status: 'ok',
      service: 'EquiTrip Settlement & Calculation Engine',
      version: '1.3.0',
      currency: 'INR',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      mongodb: {
        configured: !!MONGODB_URI,
        connected: mongoConnected,
        database: MONGODB_DB_NAME,
        tripCount: tripCountInDb,
        error: mongoError,
      },
      tripKeyEngine: {
        currentCounterI: serverCounterI,
        maxI: MAX_I,
        range: '100000 - 999999',
      },
    });
  });

  /**
   * Allocate Unique 6-Digit Trip Key
   * POST /api/trips/allocate-key
   */
  app.post('/api/trips/allocate-key', (req: Request, res: Response) => {
    const key = computeServerTripKey(serverCounterI);
    const usedI = serverCounterI;
    serverCounterI = (serverCounterI + 1) % (MAX_I + 1);
    return res.json({
      key,
      counterI: usedI,
      nextCounterI: serverCounterI,
    });
  });

  /**
   * MongoDB Status Endpoint
   * GET /api/mongodb/status
   */
  app.get('/api/mongodb/status', async (req: Request, res: Response) => {
    if (!MONGODB_URI) {
      return res.json({
        configured: false,
        connected: false,
        message: 'MongoDB URI not set. Add MONGODB_URI to secrets or .env to store data in MongoDB Compass/Atlas.',
        database: MONGODB_DB_NAME,
        counterI: serverCounterI,
      });
    }

    try {
      const db = await getMongoDatabase();
      if (!db) {
        return res.json({
          configured: true,
          connected: false,
          message: 'Failed to initialize MongoDB client.',
          database: MONGODB_DB_NAME,
        });
      }
      await db.command({ ping: 1 });
      return res.json({
        configured: true,
        connected: true,
        message: 'Connected to MongoDB',
        database: MONGODB_DB_NAME,
        counterI: serverCounterI,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      let hint: string | undefined;
      if (
        msg.includes('ETIMEDOUT') ||
        msg.includes('Server selection timed out') ||
        msg.includes('whitelist') ||
        msg.includes('SSL alert number 80') ||
        msg.includes('tlsv1 alert internal error') ||
        msg.includes('0A000438')
      ) {
        hint = 'Atlas IP Access List required: In your MongoDB Atlas dashboard, go to "Network Access" -> click "+ Add IP Address" -> select "Allow Access From Anywhere" (0.0.0.0/0) and click Confirm.';
      } else if (msg.includes('Authentication failed') || msg.includes('bad auth')) {
        hint = 'Authentication failed. Please verify database username and password in the connection string (and ensure special characters in password are URL-encoded).';
      } else if (msg.includes('ENOTFOUND') || msg.includes('querySrv')) {
        hint = 'Cluster hostname DNS lookup failed. Please double check the connection string from Atlas.';
      } else if (MONGODB_URI.startsWith('mongodb://localhost') || MONGODB_URI.startsWith('mongodb://127.0.0.1')) {
        hint = 'A localhost URI was provided. Cloud-hosted web applications require a MongoDB Atlas cluster URI or public MongoDB instance.';
      }
      return res.status(200).json({
        configured: true,
        connected: false,
        message: `Connection error: ${msg}`,
        hint,
        database: MONGODB_DB_NAME,
      });
    }
  });

  /**
   * Get Active Trips from MongoDB
   * GET /api/mongodb/trips
   */
  app.get('/api/mongodb/trips', async (req: Request, res: Response) => {
    try {
      const db = await getMongoDatabase();
      if (!db) {
        return res.json({
          configured: false,
          trips: [],
          message: 'MongoDB not configured, operating in offline/local storage mode.',
        });
      }

      // Purge any expired trips before fetching
      await purgeExpiredTripsFromDb();

      // Filter out soft-deleted trips for default active workspace
      const trips = await db
        .collection('trips')
        .find({ isDeleted: { $ne: true } }, { projection: { _id: 0 } })
        .toArray();

      return res.json({
        configured: true,
        success: true,
        count: trips.length,
        trips,
      });
    } catch (err: any) {
      return res.status(500).json({
        configured: true,
        success: false,
        error: err?.message || String(err),
        trips: [],
      });
    }
  });

  /**
   * Load Trip by 6-Digit Unique Key
   * GET /api/mongodb/trips/key/:key
   * Note: Can fetch active or soft-deleted trips; automatically restores them for editing
   */
  app.get('/api/mongodb/trips/key/:key', async (req: Request, res: Response) => {
    try {
      const db = await getMongoDatabase();
      const rawKey = (req.params.key || '').trim();

      if (!/^\d{6}$/.test(rawKey)) {
        return res.status(400).json({
          success: false,
          error: 'Unique trip key must be a 6-digit number (100000 - 999999).',
        });
      }

      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'MongoDB is not configured or offline. Set MONGODB_URI to access cloud storage.',
        });
      }

      // Find trip by 6-digit key
      const trip = await db.collection('trips').findOne({ tripKey: rawKey }, { projection: { _id: 0 } });

      if (!trip) {
        return res.status(404).json({
          success: false,
          error: `No trip found matching 6-digit key #${rawKey}.`,
        });
      }

      // Check if trip expiration timer has ended
      if (trip.expiresAt) {
        const expMs = new Date(trip.expiresAt).getTime();
        if (!isNaN(expMs) && expMs <= Date.now()) {
          // Permanently delete expired trip record from database
          await db.collection('trips').deleteOne({ tripKey: rawKey });
          return res.status(410).json({
            success: false,
            error: `Trip #${rawKey} has reached its retention timer limit and was automatically deleted from the database.`,
          });
        }
      }

      // If the trip was marked deleted, restore it so the user can immediately edit it
      if (trip.isDeleted) {
        await db.collection('trips').updateOne(
          { tripKey: rawKey },
          {
            $set: {
              isDeleted: false,
              restoredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }
        );
        trip.isDeleted = false;
      }

      return res.json({
        success: true,
        message: `Trip "${trip.name}" successfully loaded from MongoDB.`,
        trip,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  /**
   * Get All Trips History from MongoDB (including soft-deleted)
   * GET /api/mongodb/trips/history
   */
  app.get('/api/mongodb/trips/history', async (req: Request, res: Response) => {
    try {
      const db = await getMongoDatabase();
      if (!db) {
        return res.status(503).json({ success: false, error: 'MongoDB not configured' });
      }

      const history = await db
        .collection('trips')
        .find(
          {},
          {
            projection: {
              _id: 0,
              id: 1,
              tripKey: 1,
              name: 1,
              description: 1,
              baseCurrency: 1,
              createdAt: 1,
              updatedAt: 1,
              isDeleted: 1,
              deletedAt: 1,
              participants: 1,
              transactions: 1,
            },
          }
        )
        .sort({ updatedAt: -1 })
        .toArray();

      const summarized = history.map((item: any) => ({
        id: item.id,
        tripKey: item.tripKey,
        name: item.name,
        description: item.description,
        baseCurrency: item.baseCurrency || 'INR',
        isDeleted: !!item.isDeleted,
        deletedAt: item.deletedAt,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        participantCount: Array.isArray(item.participants) ? item.participants.length : 0,
        transactionCount: Array.isArray(item.transactions) ? item.transactions.length : 0,
      }));

      return res.json({
        success: true,
        count: summarized.length,
        history: summarized,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  /**
   * Save / Sync Trips in MongoDB
   * POST /api/mongodb/trips
   * Body: { trips: Trip[] }
   */
  app.post('/api/mongodb/trips', async (req: Request, res: Response) => {
    try {
      const db = await getMongoDatabase();
      if (!db) {
        return res.status(503).json({
          success: false,
          message: 'MongoDB not configured. Set MONGODB_URI in secrets or .env to sync.',
        });
      }

      const { trips } = req.body;
      if (!Array.isArray(trips)) {
        return res.status(400).json({ success: false, error: 'Expected trips array in payload' });
      }

      for (const trip of trips) {
        if (trip && trip.id) {
          const createdAt = trip.createdAt || new Date().toISOString();
          let expiresAt = trip.expiresAt;
          if (!expiresAt) {
            const d = new Date(createdAt);
            d.setMonth(d.getMonth() + 1);
            expiresAt = d.toISOString();
          }
          const expiresAtDate = new Date(expiresAt);

          await db.collection('trips').updateOne(
            { id: trip.id },
            {
              $set: {
                ...trip,
                expiresAt,
                expiresAtDate,
                extensionAdded: !!trip.extensionAdded,
                extendedAt: trip.extendedAt || undefined,
                isDeleted: false, // Ensure active trips synced are marked not deleted
              },
            },
            { upsert: true }
          );
        }
      }

      return res.json({
        success: true,
        savedCount: trips.length,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  /**
   * Add 1-Week Extension to Trip Expiration Timer (Only Once Per Trip, When <= 2 Days Left)
   * POST /api/mongodb/trips/:id/extend
   */
  app.post('/api/mongodb/trips/:id/extend', async (req: Request, res: Response) => {
    try {
      const db = await getMongoDatabase();
      if (!db) {
        return res.status(503).json({ success: false, error: 'MongoDB not configured' });
      }

      const { id } = req.params;
      const trip = await db.collection('trips').findOne({ id });

      if (!trip) {
        return res.status(404).json({ success: false, error: 'Trip not found in database.' });
      }

      if (trip.extensionAdded) {
        return res.status(400).json({
          success: false,
          error: 'A 1-week extension has already been used for this trip. Extensions are allowed only once per trip.',
        });
      }

      const now = Date.now();
      const currentExpiresAtMs = trip.expiresAt
        ? new Date(trip.expiresAt).getTime()
        : (() => {
            const d = new Date(trip.createdAt || now);
            d.setMonth(d.getMonth() + 1);
            return d.getTime();
          })();

      const msRemaining = currentExpiresAtMs - now;

      if (msRemaining <= 0) {
        // Already expired - delete permanently from database
        await db.collection('trips').deleteOne({ id });
        return res.status(410).json({
          success: false,
          error: 'This trip has already expired and was deleted from the database.',
        });
      }

      const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
      if (msRemaining > TWO_DAYS_MS) {
        const daysLeft = (msRemaining / (24 * 60 * 60 * 1000)).toFixed(1);
        return res.status(400).json({
          success: false,
          error: `Extension can only be added when 2 days or fewer remain before deletion. Current time remaining: ${daysLeft} days.`,
        });
      }

      // Add exactly 1 week (7 days)
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const newExpiresAtMs = currentExpiresAtMs + ONE_WEEK_MS;
      const newExpiresAt = new Date(newExpiresAtMs).toISOString();
      const newExpiresAtDate = new Date(newExpiresAtMs);
      const extendedAt = new Date().toISOString();

      await db.collection('trips').updateOne(
        { id },
        {
          $set: {
            expiresAt: newExpiresAt,
            expiresAtDate: newExpiresAtDate,
            extensionAdded: true,
            extendedAt,
            updatedAt: extendedAt,
          },
        }
      );

      const updated = await db.collection('trips').findOne({ id }, { projection: { _id: 0 } });

      return res.json({
        success: true,
        message: 'Trip expiration successfully extended by 1 week (+7 days).',
        trip: updated,
        newExpiresAt,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  /**
   * Soft Delete / Archive Trip in MongoDB (DO NOT permanently drop)
   * DELETE /api/mongodb/trips/:id
   */
  app.delete('/api/mongodb/trips/:id', async (req: Request, res: Response) => {
    try {
      const db = await getMongoDatabase();
      if (!db) {
        return res.status(503).json({ success: false, message: 'MongoDB not configured' });
      }

      const id = req.params.id;
      // Soft-delete in MongoDB to preserve user records for later retrieval via 6-digit key
      const result = await db.collection('trips').updateOne(
        { id },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            archivedAt: new Date().toISOString(),
          },
        }
      );

      return res.json({
        success: true,
        archivedCount: result.modifiedCount,
        message: 'Trip safely archived in MongoDB (can be reloaded with 6-digit key).',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
      });
    }
  });

  /**
   * Calculate Trip Balances & Invariant
   * POST /api/engine/calculate
   * Body: { participants: Participant[], transactions: Transaction[] }
   */
  app.post('/api/engine/calculate', (req: Request, res: Response) => {
    try {
      const { participants, transactions } = req.body;

      if (!Array.isArray(participants) || !Array.isArray(transactions)) {
        return res.status(400).json({
          error: 'Invalid request payload: participants and transactions must both be arrays.',
        });
      }

      const balanceData = calculateBalances(participants, transactions);
      const settlements = calculateOptimalSettlements(
        balanceData.participantBalances,
        balanceData.kittyBalanceCents
      );

      return res.json({
        ...balanceData,
        settlements,
        settlementCount: settlements.length,
        meta: {
          participantCount: participants.length,
          transactionCount: transactions.length,
          calculatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Engine calculation failed',
        details: err?.message || String(err),
      });
    }
  });

  /**
   * Split Calculation Utility
   * POST /api/engine/split
   * Body: {
   *   totalCents: number,
   *   method: 'EQUAL' | 'PERCENT' | 'WEIGHTED' | 'EXACT' | 'ITEMIZED',
   *   participants: string[],
   *   percentages?: Record<string, number>,
   *   weights?: Record<string, number>,
   *   items?: Array<{ name: string; amountCents: number; sharedBy: string[] }>
   * }
   */
  app.post('/api/engine/split', (req: Request, res: Response) => {
    try {
      const { totalCents, method, participants, percentages, weights, items } = req.body;

      if (typeof totalCents !== 'number' || totalCents <= 0) {
        return res.status(400).json({
          error: 'totalCents must be a positive integer.',
        });
      }

      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({
          error: 'participants must be a non-empty array of participant IDs.',
        });
      }

      let shares;

      switch (method) {
        case 'EQUAL': {
          shares = calculateEqualShares(totalCents, participants);
          break;
        }

        case 'PERCENT': {
          let percentArray: { participantId: string; percent: number }[] = [];
          if (Array.isArray(percentages)) {
            percentArray = percentages;
          } else if (percentages && typeof percentages === 'object') {
            percentArray = Object.entries(percentages).map(([participantId, percent]) => ({
              participantId,
              percent: Number(percent),
            }));
          } else {
            return res.status(400).json({
              error: 'percentages map or array is required for PERCENT split method.',
            });
          }
          const percentResult = calculatePercentShares(totalCents, percentArray);
          shares = percentResult.shares;
          break;
        }

        case 'WEIGHTED': {
          let weightArray: { participantId: string; shares: number }[] = [];
          if (Array.isArray(weights)) {
            weightArray = weights;
          } else if (weights && typeof weights === 'object') {
            weightArray = Object.entries(weights).map(([participantId, sharesVal]) => ({
              participantId,
              shares: Number(sharesVal),
            }));
          } else {
            return res.status(400).json({
              error: 'weights map or array is required for WEIGHTED split method.',
            });
          }
          shares = calculateWeightedShares(totalCents, weightArray);
          break;
        }

        case 'ITEMIZED': {
          if (!Array.isArray(items)) {
            return res.status(400).json({
              error: 'items array is required for ITEMIZED split method.',
            });
          }
          shares = calculateItemizedShares(items);
          break;
        }

        default:
          return res.status(400).json({
            error: `Unsupported or unknown split method: ${method}. Use EQUAL, PERCENT, WEIGHTED, or ITEMIZED.`,
          });
      }

      const allocatedCents = (shares as any[]).reduce((sum: number, s: any) => sum + s.calculatedCents, 0);
      const isReconciled = allocatedCents === totalCents;

      return res.json({
        method,
        totalCents,
        allocatedCents,
        isReconciled,
        remainderDriftCents: totalCents - allocatedCents,
        shares,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Split computation error',
        details: err?.message || String(err),
      });
    }
  });

  /**
   * Optimal Debt Simplification
   * POST /api/engine/simplify-debts
   * Body: { participantBalances: ParticipantBalance[], kittyBalanceCents?: number }
   */
  app.post('/api/engine/simplify-debts', (req: Request, res: Response) => {
    try {
      const { participantBalances, kittyBalanceCents = 0 } = req.body;

      if (!Array.isArray(participantBalances)) {
        return res.status(400).json({
          error: 'participantBalances must be an array of ParticipantBalance objects.',
        });
      }

      const settlements = calculateOptimalSettlements(participantBalances, kittyBalanceCents);

      return res.json({
        settlements,
        settlementCount: settlements.length,
        totalSettlementVolumeCents: settlements.reduce((sum, s) => sum + s.amountCents, 0),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Debt simplification failed',
        details: err?.message || String(err),
      });
    }
  });

  /**
   * Validate Expense Payload
   * POST /api/engine/validate
   * Body: { totalCents: number, payers: PayerContribution[], splitShares: SplitParticipantShare[] }
   */
  app.post('/api/engine/validate', (req: Request, res: Response) => {
    try {
      const { totalCents, payers, splitShares } = req.body;

      if (typeof totalCents !== 'number' || !Array.isArray(payers) || !Array.isArray(splitShares)) {
        return res.status(400).json({
          error: 'Invalid payload: totalCents (number), payers (array), and splitShares (array) are required.',
        });
      }

      const validation = validateExpense(totalCents, payers, splitShares);

      if (!validation.isValid) {
        return res.status(400).json({
          isValid: false,
          errors: validation.errors,
        });
      }

      return res.json({
        isValid: true,
        errors: [],
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Validation failed',
        details: err?.message || String(err),
      });
    }
  });

  /**
   * Execute Engine Test Suite (Server-Side)
   * GET /api/engine/run-tests
   */
  app.get('/api/engine/run-tests', (req: Request, res: Response) => {
    try {
      const start = performance.now();
      const results = runEngineTestSuite();
      const durationMs = parseFloat((performance.now() - start).toFixed(2));

      const passedCount = results.filter((r) => r.passed).length;
      const totalCount = results.length;
      const allPassed = passedCount === totalCount;

      return res.json({
        allPassed,
        totalCount,
        passedCount,
        failedCount: totalCount - passedCount,
        durationMs,
        executedAt: new Date().toISOString(),
        results,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'Test suite execution failed',
        details: err?.message || String(err),
      });
    }
  });

  // -------------------------------------------------------------
  // Static / Vite Frontend Integration
  // -------------------------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EquiTrip Server listening on http://0.0.0.0:${PORT}`);
  });

  // If container environment specifies another PORT (e.g. 8080), listen on it as well
  const ALT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;
  if (ALT_PORT && ALT_PORT !== PORT) {
    try {
      app.listen(ALT_PORT, '0.0.0.0', () => {
        console.log(`🚀 EquiTrip Server also listening on http://0.0.0.0:${ALT_PORT}`);
      });
    } catch (e) {
      console.warn(`Could not bind to alt port ${ALT_PORT}:`, e);
    }
  }
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
