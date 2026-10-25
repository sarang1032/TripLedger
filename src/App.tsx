/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Participant,
  SettlementTransfer,
  Transaction,
  Trip,
} from './types/trip';
import {
  calculateBalances,
  calculateOptimalSettlements,
  formatMoney,
  KITTY_ID,
} from './engine/calculator';
import { StorageService } from './services/storage';
import { CATEGORY_LABELS } from './utils/constants';
import { allocateNextTripKey } from './utils/tripKeyGenerator';

// Modals
import { ExpenseModal } from './components/ExpenseModal';
import { TransferModal } from './components/TransferModal';
import { KittyModal } from './components/KittyModal';
import { TripModal } from './components/TripModal';
import { ParticipantModal } from './components/ParticipantModal';
import { BackupModal } from './components/BackupModal';
import { ImportModal } from './components/ImportModal';
import { ConfirmModal } from './components/ConfirmModal';
import { LoadTripModal } from './components/LoadTripModal';
import { TripPrintModal } from './components/TripPrintModal';
import { TripExportModal } from './components/TripExportModal';
import { TripTimerWidget } from './components/TripTimerWidget';

// Views
import { DashboardView } from './components/DashboardView';
import { SettlementFlowVisualizer } from './components/SettlementFlowVisualizer';
import { ArithmeticAuditView } from './components/ArithmeticAuditView';
import { KittyManagerView } from './components/KittyManagerView';

// Icons
import {
  Plus,
  Coins,
  ArrowRightLeft,
  PiggyBank,
  Users,
  Calculator,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Search,
  Receipt,
  ChevronDown,
  Menu,
  X,
  MoreHorizontal,
  ChevronRight,
  Settings,
  ArrowLeft,
  LayoutDashboard,
  Download,
  Upload,
  Check,
  KeyRound,
  Printer,
} from 'lucide-react';

export default function App() {
  // Trips state
  const [trips, setTrips] = useState<Trip[]>(() => StorageService.loadTrips());

  // activeTripId is loaded from URL hash (e.g. #148192) or localStorage
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').trim();
      if (/^\d{6}$/.test(hash)) {
        const initialTrips = StorageService.loadTrips();
        const match = initialTrips.find((t) => t.tripKey === hash);
        if (match) return match.id;
      }
    }
    return StorageService.getActiveTripId();
  });

  // Current active trip (if any)
  const currentTrip = useMemo(() => {
    if (!activeTripId) return null;
    return trips.find((t) => t.id === activeTripId) || null;
  }, [trips, activeTripId]);

  // Sync with storage on change
  const persistTrips = (updatedTrips: Trip[]) => {
    setTrips(updatedTrips);
    StorageService.saveTrips(updatedTrips);
  };

  /**
   * Update active trip:
   * First sends a GET request to MongoDB for this particular trip (using its 6-digit key),
   * applies the updates on the freshest remote state, saves locally, and syncs to MongoDB.
   */
  const updateCurrentTrip = async (updater: (trip: Trip) => Trip) => {
    if (!currentTrip) return;
    const tripKey = currentTrip.tripKey;
    let baseTrip = currentTrip;

    // Send a GET request first to db for that particular trip (using six digit unique code)
    if (tripKey && /^\d{6}$/.test(tripKey)) {
      try {
        const freshTrip = await StorageService.fetchTripByKeyFromDb(tripKey);
        if (freshTrip) {
          baseTrip = freshTrip;
        }
      } catch (err) {
        console.warn('Could not fetch latest trip from db before update, using local state:', err);
      }
    }

    const updatedTrip = updater(baseTrip);
    setTrips((prevTrips) => {
      const exists = prevTrips.some((t) => t.id === updatedTrip.id);
      const nextTrips = exists
        ? prevTrips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
        : [updatedTrip, ...prevTrips];
      persistTrips(nextTrips);
      return nextTrips;
    });
  };

  // Switch trip or open from dashboard
  const handleSelectTrip = async (id: string) => {
    setActiveTripId(id);
    StorageService.setActiveTripId(id);
    const target = trips.find((t) => t.id === id);
    if (target?.tripKey && /^\d{6}$/.test(target.tripKey)) {
      if (typeof window !== 'undefined') {
        window.location.hash = target.tripKey;
      }
      // Send GET request to db for that particular trip using six digit unique code
      const freshTrip = await StorageService.fetchTripByKeyFromDb(target.tripKey);
      if (freshTrip) {
        handleTripLoaded(freshTrip, 'mongodb');
      }
    }
  };

  const handleBackToDashboard = () => {
    setActiveTripId(null);
    StorageService.setActiveTripId(null);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  // On page reload/mount: send a GET request first to db for that particular trip (using six digit unique code)
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '').trim() : '';
    const savedActiveId = StorageService.getActiveTripId();

    let targetKey: string | null = null;
    if (/^\d{6}$/.test(hash)) {
      targetKey = hash;
    } else if (savedActiveId) {
      const existing = trips.find((t) => t.id === savedActiveId);
      if (existing?.tripKey && /^\d{6}$/.test(existing.tripKey)) {
        targetKey = existing.tripKey;
      } else {
        // Check local device history cache for trip key
        const cached = StorageService.loadCachedHistory().find((h) => h.tripId === savedActiveId);
        if (cached?.tripKey && /^\d{6}$/.test(cached.tripKey)) {
          targetKey = cached.tripKey;
        }
      }
    }

    if (targetKey) {
      // Send a GET request first to db for that particular trip (using six digit unique code)
      StorageService.fetchTripByKeyFromDb(targetKey).then((freshTrip) => {
        if (freshTrip) {
          handleTripLoaded(freshTrip, 'mongodb');
        }
      });
    }
  }, []);

  // Confirmation dialog state replacing native window.confirm/alert
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });


  const [isLoadTripModalOpen, setIsLoadTripModalOpen] = useState(false);

  const handleDeleteTrip = (id: string, name: string) => {
    const targetTrip = trips.find((t) => t.id === id);
    const tripKey = targetTrip?.tripKey;

    setConfirmDialog({
      isOpen: true,
      title: 'Remove Trip from Dashboard',
      message: (
        <div className="space-y-2 text-left">
          <p>
            Are you sure you want to remove <strong className="text-white font-medium">"{name}"</strong> from your active dashboard view?
          </p>
          {tripKey && (
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs">
              <span className="text-zinc-400">Unique Trip Key: </span>
              <span className="font-mono font-semibold text-indigo-300">#{tripKey}</span>
            </div>
          )}
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            <strong className="text-zinc-200">This trip will not be permanently deleted.</strong> It remains safely preserved in MongoDB Atlas and this device's history cache. You can reload and continue editing it anytime using the "Load a Trip" button.
          </p>
        </div>
      ),
      confirmText: 'Remove Trip',
      variant: 'danger',
      onConfirm: () => {
        // Record in local cache history as removed/archived so device keeps full history
        if (targetTrip) {
          StorageService.recordTripInHistory(targetTrip, true);
        }
        const updated = trips.filter((t) => t.id !== id);
        persistTrips(updated);
        // Soft-delete in MongoDB (does not drop permanently)
        StorageService.archiveTripInMongo(id).catch(() => {});
        if (activeTripId === id) {
          setActiveTripId(null);
        }
      },
    });
  };

  const handleTripLoaded = (loadedTrip: Trip, source: 'mongodb' | 'cache') => {
    setTrips((prevTrips) => {
      const existsIndex = prevTrips.findIndex(
        (t) => t.id === loadedTrip.id || (loadedTrip.tripKey && t.tripKey === loadedTrip.tripKey)
      );
      let updated: Trip[];
      if (existsIndex >= 0) {
        updated = [...prevTrips];
        updated[existsIndex] = loadedTrip;
      } else {
        updated = [loadedTrip, ...prevTrips];
      }
      persistTrips(updated);
      return updated;
    });

    // Enter the loaded trip immediately so user can edit it
    setActiveTripId(loadedTrip.id);
    StorageService.setActiveTripId(loadedTrip.id);
    if (loadedTrip.tripKey && typeof window !== 'undefined') {
      window.location.hash = loadedTrip.tripKey;
    }
  };

  // Navigation tab inside an opened trip
  type TabType =
    | 'LEDGER'
    | 'BALANCES'
    | 'AUDIT'
    | 'KITTY'
    | 'PARTICIPANTS';
  const [activeTab, setActiveTab] = useState<TabType>('LEDGER');

  // Mobile More Drawer State
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // Filter & Search states in Ledger
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Modal open states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isKittyModalOpen, setIsKittyModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTripData, setEditingTripData] = useState<Trip | null>(null);

  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleDownloadIndividualTrip = () => {
    if (!currentTrip) return;
    const exportData = JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        app: 'TJourney',
        trip: currentTrip,
      },
      null,
      2
    );
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const keyPart = currentTrip.tripKey ? `${currentTrip.tripKey}-` : '';
    const safeName = currentTrip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.download = `trip-${keyPart}${safeName || 'data'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  // Core Mathematical Calculations for Active Trip (only computed if trip is opened)
  const {
    participantBalances,
    kittyBalanceCents,
    totalExpensesCents,
  } = useMemo(() => {
    if (!currentTrip) {
      return {
        participantBalances: [],
        kittyBalanceCents: 0,
        totalExpensesCents: 0,
        isBalanced: true,
      };
    }
    const participants = currentTrip.participants || [];
    const transactions = currentTrip.transactions || [];
    return calculateBalances(participants, transactions);
  }, [currentTrip]);

  // Optimal Settlements for active trip
  const settlements = useMemo(() => {
    if (!currentTrip) return [];
    return calculateOptimalSettlements(participantBalances, kittyBalanceCents);
  }, [currentTrip, participantBalances, kittyBalanceCents]);

  // Helper Participant Map for active trip
  const pMap = useMemo(() => {
    if (!currentTrip) return new Map();
    const participants = currentTrip.participants || [];
    return new Map(participants.map((p) => [p.id, p]));
  }, [currentTrip]);

  // Handlers for Transactions in active trip
  const handleSaveExpense = (
    expenseData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!currentTrip) return;
    const now = new Date().toISOString();
    if (editingExpense) {
      updateCurrentTrip((trip) => ({
        ...trip,
        updatedAt: now,
        transactions: (trip.transactions || []).map((tx) =>
          tx.id === editingExpense.id
            ? { ...expenseData, id: tx.id, tripId: trip.id, createdAt: tx.createdAt, updatedAt: now }
            : tx
        ),
      }));
      setEditingExpense(null);
    } else {
      const newTx: Transaction = {
        ...expenseData,
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tripId: currentTrip.id,
        createdAt: now,
        updatedAt: now,
      };
      updateCurrentTrip((trip) => ({
        ...trip,
        updatedAt: now,
        transactions: [newTx, ...(trip.transactions || [])],
      }));
    }
  };

  const handleSaveTransfer = (
    txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!currentTrip) return;
    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...txData,
      id: `tx-tf-${Date.now()}`,
      tripId: currentTrip.id,
      createdAt: now,
      updatedAt: now,
    };
    updateCurrentTrip((trip) => ({
      ...trip,
      updatedAt: now,
      transactions: [newTx, ...(trip.transactions || [])],
    }));
  };

  const handleSaveKittyTx = (
    txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!currentTrip) return;
    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...txData,
      id: `tx-kt-${Date.now()}`,
      tripId: currentTrip.id,
      createdAt: now,
      updatedAt: now,
    };
    updateCurrentTrip((trip) => ({
      ...trip,
      updatedAt: now,
      transactions: [newTx, ...(trip.transactions || [])],
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    const txToDelete = (currentTrip?.transactions || []).find((tx) => tx.id === id);
    const txLabel = txToDelete?.title || 'this transaction';
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Transaction',
      message: (
        <span>
          Are you sure you want to delete <strong className="text-white font-medium">"{txLabel}"</strong>? Net balances and settlement transfers will automatically recompute.
        </span>
      ),
      confirmText: 'Delete Transaction',
      variant: 'danger',
      onConfirm: () => {
        updateCurrentTrip((trip) => ({
          ...trip,
          transactions: (trip.transactions || []).filter((tx) => tx.id !== id),
        }));
      },
    });
  };

  // Participant Handlers
  const handleSaveParticipant = (participant: Participant) => {
    if (!currentTrip) return;
    const currentList = currentTrip.participants || [];
    const exists = currentList.some((p) => p.id === participant.id);
    updateCurrentTrip((trip) => {
      let updatedList = trip.participants || [];
      if (exists) {
        updatedList = updatedList.map((p) =>
          p.id === participant.id ? participant : p
        );
      } else {
        updatedList = [...updatedList, participant];
      }
      return {
        ...trip,
        participants: updatedList,
        updatedAt: new Date().toISOString(),
      };
    });
    setEditingParticipant(null);
  };

  const handleDeleteParticipant = (id: string) => {
    if (!currentTrip) return;
    const participant = (currentTrip.participants || []).find((p) => p.id === id);
    const pName = participant?.name || 'this participant';

    const isReferenced = (currentTrip.transactions || []).some(
      (tx) =>
        tx.payers.some((p) => p.participantId === id) ||
        tx.splitShares.some((s) => s.participantId === id)
    );

    if (isReferenced) {
      setConfirmDialog({
        isOpen: true,
        title: 'Cannot Remove Participant',
        message: (
          <span>
            <strong className="text-white font-medium">{pName}</strong> is referenced in existing transactions. To maintain strict ledger integrity, please reassign or delete those transactions first before removing this participant.
          </span>
        ),
        variant: 'info',
        isAlertOnly: true,
        confirmText: 'Understood',
        onConfirm: () => {},
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Remove Participant',
      message: (
        <span>
          Are you sure you want to remove <strong className="text-white font-medium">{pName}</strong> from this trip?
        </span>
      ),
      confirmText: 'Remove Participant',
      variant: 'danger',
      onConfirm: () => {
        updateCurrentTrip((trip) => ({
          ...trip,
          participants: (trip.participants || []).filter((p) => p.id !== id),
        }));
      },
    });
  };

  // Trip Metadata Handlers
  const handleSaveTrip = async (data: {
    name: string;
    description?: string;
    baseCurrency: string;
    startDate?: string;
    endDate?: string;
  }) => {
    if (editingTripData) {
      const tripKey = editingTripData.tripKey;
      let baseTrip = editingTripData;
      // Send a GET request first to db for that particular trip (using six digit unique code)
      if (tripKey && /^\d{6}$/.test(tripKey)) {
        try {
          const freshTrip = await StorageService.fetchTripByKeyFromDb(tripKey);
          if (freshTrip) {
            baseTrip = freshTrip;
          }
        } catch (err) {
          console.warn('Could not fetch trip by key before updating metadata:', err);
        }
      }

      const updatedTrip: Trip = {
        ...baseTrip,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const updatedList = trips.map((t) =>
        t.id === updatedTrip.id ? updatedTrip : t
      );
      persistTrips(updatedList);
      setEditingTripData(null);
    } else {
      const existingKeys = trips.map((t) => t.tripKey).filter(Boolean) as string[];
      const { key: allocatedKey } = allocateNextTripKey(existingKeys);

      const now = new Date();
      const createdAt = now.toISOString();
      const expDate = new Date(now.getTime());
      expDate.setMonth(expDate.getMonth() + 1);
      const expiresAt = expDate.toISOString();

      const newTrip: Trip = {
        id: `trip-${Date.now()}`,
        tripKey: allocatedKey,
        name: data.name,
        description: data.description,
        baseCurrency: data.baseCurrency || 'INR',
        startDate: data.startDate,
        endDate: data.endDate,
        createdAt,
        expiresAt,
        extensionAdded: false,
        updatedAt: createdAt,
        participants: [
          {
            id: `p-${Date.now()}-1`,
            name: 'You',
            avatarColor: '#6366f1',
            isActive: true,
          },
          {
            id: `p-${Date.now()}-2`,
            name: 'Traveler',
            avatarColor: '#10b981',
            isActive: true,
          },
        ],
        transactions: [],
        settlements: [],
      };
      const updatedList = [newTrip, ...trips];
      persistTrips(updatedList);
      // Open the newly created trip
      setActiveTripId(newTrip.id);
      StorageService.setActiveTripId(newTrip.id);
      if (newTrip.tripKey && typeof window !== 'undefined') {
        window.location.hash = newTrip.tripKey;
      }
    }
  };

  // Handler to extend a trip's expiration by 1 week (only once per trip, <= 2 days left)
  const handleExtendTrip = async (tripId: string) => {
    const res = await StorageService.extendTrip(tripId);
    if (res.success && res.trip) {
      const updated = trips.map((t) => (t.id === tripId ? { ...t, ...res.trip } : t));
      persistTrips(updated);
    } else {
      // Local fallback in case MongoDB is offline
      const updated = trips.map((t) => {
        if (t.id === tripId) {
          const curExp = t.expiresAt ? new Date(t.expiresAt).getTime() : Date.now();
          const newExp = new Date(curExp + 7 * 24 * 60 * 60 * 1000).toISOString();
          return {
            ...t,
            expiresAt: newExp,
            extensionAdded: true,
            extendedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      });
      persistTrips(updated);
    }
  };

  // Settlement Handlers
  const handleRecordSettlement = (settlement: SettlementTransfer) => {
    if (!currentTrip) return;
    const fromName = pMap.get(settlement.fromParticipantId)?.name || 'Sender';
    const toName = pMap.get(settlement.toParticipantId)?.name || 'Receiver';

    const settlementTx: Transaction = {
      id: `tx-settle-${Date.now()}`,
      tripId: currentTrip.id,
      type: 'TRANSFER',
      title: `Settlement: ${fromName} paid ${toName}`,
      category: 'general',
      date: new Date().toISOString().split('T')[0],
      currency: currentTrip.baseCurrency,
      exchangeRateToBase: 1.0,
      originalAmount: settlement.amountCents / 100,
      totalAmountCents: settlement.amountCents,
      payers: [{ participantId: settlement.fromParticipantId, amountCents: settlement.amountCents }],
      splitMethod: 'EXACT',
      splitShares: [{ participantId: settlement.toParticipantId, calculatedCents: settlement.amountCents }],
      notes: 'Recorded via Settle Up flow.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateCurrentTrip((trip) => ({
      ...trip,
      transactions: [settlementTx, ...(trip.transactions || [])],
    }));
  };

  // Filtered transactions for the Ledger tab
  const transactionsList = currentTrip?.transactions || [];
  const filteredTransactions = useMemo(() => {
    return transactionsList.filter((tx) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = tx.title.toLowerCase().includes(query);
        const matchesNotes = tx.notes?.toLowerCase().includes(query);
        const matchesPayer = tx.payers.some((payer) => {
          const name = pMap.get(payer.participantId)?.name?.toLowerCase() || '';
          return name.includes(query);
        });
        if (!matchesTitle && !matchesNotes && !matchesPayer) return false;
      }

      // Type filter
      if (selectedTypeFilter !== 'ALL') {
        if (selectedTypeFilter === 'EXPENSE' && tx.type !== 'EXPENSE') return false;
        if (selectedTypeFilter === 'TRANSFER' && tx.type !== 'TRANSFER') return false;
        if (
          selectedTypeFilter === 'KITTY' &&
          tx.type !== 'KITTY_DEPOSIT' &&
          tx.type !== 'KITTY_EXPENSE' &&
          tx.type !== 'KITTY_PAYOUT'
        )
          return false;
      }

      // Category filter
      if (selectedCategoryFilter !== 'ALL' && tx.category !== selectedCategoryFilter) {
        return false;
      }

      return true;
    });
  }, [transactionsList, searchTerm, selectedTypeFilter, selectedCategoryFilter, pMap]);

  return (
    <div className="min-h-screen bg-[#111113] text-[#F8F7F4] flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white pb-24 sm:pb-12">
      {/* Top Application Header */}
      <header className="border-b border-white/10 px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-30 bg-[#111113]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-[-0.04em] text-[#F8F7F4] hover:text-indigo-300 transition-colors cursor-pointer shrink-0"
            title="Go to Dashboard"
          >
            <span>TJourney</span>
          </button>

          {/* If Trip is opened, show breadcrumb & trip switcher */}
          {currentTrip && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-600 hidden sm:inline">/</span>
              <div className="relative inline-flex items-center max-w-[190px] sm:max-w-xs">
                <select
                  value={currentTrip.id}
                  onChange={(e) => {
                    if (e.target.value === '__DASHBOARD__') {
                      handleBackToDashboard();
                    } else {
                      handleSelectTrip(e.target.value);
                    }
                  }}
                  className="appearance-none pr-7 pl-2.5 py-1.5 text-xs font-mono font-medium text-zinc-200 bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                  aria-label="Select active trip"
                >
                  <option value="__DASHBOARD__" className="bg-[#18181b] text-zinc-400">
                    ← Back to Dashboard
                  </option>
                  <option disabled className="bg-[#18181b] text-zinc-600">
                    ──────────
                  </option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#18181b] text-[#F8F7F4]">
                      {t.tripKey ? `#${t.tripKey} · ${t.name}` : t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none shrink-0" />
              </div>
            </div>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Individual Trip Export Button (Options for PDF or JSON) */}
          {currentTrip && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 rounded-lg transition-colors cursor-pointer shadow-xs"
              title="Export trip as PDF or JSON"
              aria-label="Export trip"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export</span>
            </button>
          )}

          {/* Upload Button (Only shown on Dashboard, removed from inside trips) */}
          {!currentTrip && (
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center justify-center p-2 text-zinc-300 hover:text-white bg-white/[0.04] border border-white/15 hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
              title="Upload"
              aria-label="Upload"
            >
              <Upload className="w-4 h-4 text-zinc-400 hover:text-white transition-colors" />
            </button>
          )}

          {/* Mobile Menu Toggle (Only in Trip view) */}
          {currentTrip && (
            <button
              type="button"
              onClick={() => setIsMobileMoreOpen(true)}
              className="sm:hidden p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              aria-label="Open Trip Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* VIEW CONDITIONAL: DASHBOARD vs OPENED TRIP */}
      {!currentTrip ? (
        /* DASHBOARD VIEW: Shows Recent Trip History & Action buttons (Add/Load) */
        <DashboardView
          trips={trips}
          onSelectTrip={handleSelectTrip}
          onCreateTrip={() => {
            setEditingTripData(null);
            setIsTripModalOpen(true);
          }}
          onLoadTrip={() => setIsLoadTripModalOpen(true)}
          onEditTrip={(trip) => {
            setEditingTripData(trip);
            setIsTripModalOpen(true);
          }}
          onDeleteTrip={handleDeleteTrip}
          onExtendTrip={handleExtendTrip}
        />
      ) : (
        /* TRIP VIEW: Ledger, Balances & Settlements, Arithmetic Audit, Kitty Pool */
        <main className="grid-container px-4 sm:px-8 py-6 sm:py-8">
          {/* Left Column (Primary Views) */}
          <section className="min-w-0 space-y-6">
            {/* Trip Back Breadcrumb & Hero Section */}
            <div>
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-indigo-400 transition-colors mb-3 cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 transform group-hover:-translate-x-1 transition-transform" />
                <span>Back to Dashboard</span>
              </button>

              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  <h1 className="text-3xl sm:text-5xl font-light text-[#F8F7F4] leading-tight tracking-tight">
                    {currentTrip.name}
                  </h1>
                  {currentTrip.tripKey && (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-mono font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                      title="Trip Key (Unique 6-digit identification)"
                    >
                      #{currentTrip.tripKey}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTripData(currentTrip);
                      setIsTripModalOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-white border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
                    title="Edit Trip Settings"
                    aria-label="Edit Trip Settings"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="opacity-60 text-sm sm:text-base text-[#F8F7F4]">
                {currentTrip.description || 'Trip expense ledger and settlement audit.'}
              </p>

              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 flex-wrap pt-2">
                <span>{(currentTrip.participants || []).length} Active Members</span>
                <span>·</span>
                <span>Base Currency: {currentTrip.baseCurrency}</span>
                {currentTrip.startDate && (
                  <>
                    <span>·</span>
                    <span>
                      {currentTrip.startDate} {currentTrip.endDate ? `to ${currentTrip.endDate}` : ''}
                    </span>
                  </>
                )}
              </div>

              {/* Database Retention Expiry Timer Banner */}
              <TripTimerWidget trip={currentTrip} onExtendTrip={handleExtendTrip} variant="banner" className="mt-3.5" />

              {/* Direct Quick Action Buttons in Hero */}
              <div className="flex items-center gap-2.5 flex-wrap pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingExpense(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="btn cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Direct Repayment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsKittyModalOpen(true)}
                  className="px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PiggyBank className="w-3.5 h-3.5" />
                  <span>Kitty Pool</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingParticipant(null);
                    setIsParticipantModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Add Member</span>
                </button>
              </div>
            </div>

            {/* Primary Tab Navigation for Opened Trip */}
            <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar gap-1 text-xs font-mono uppercase tracking-wider pb-1">
              <button
                type="button"
                onClick={() => setActiveTab('LEDGER')}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'LEDGER'
                    ? 'bg-white/15 text-white border border-white/20 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ledger ({(currentTrip.transactions || []).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('BALANCES')}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'BALANCES'
                    ? 'bg-white/15 text-white border border-white/20 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Balances & Settlements</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('AUDIT')}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'AUDIT'
                    ? 'bg-white/15 text-white border border-white/20 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Arithmetic Audit</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('KITTY')}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'KITTY'
                    ? 'bg-white/15 text-white border border-white/20 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" />
                <span>Kitty Pool</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PARTICIPANTS')}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'PARTICIPANTS'
                    ? 'bg-white/15 text-white border border-white/20 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members ({(currentTrip.participants || []).length})</span>
              </button>
            </div>

            {/* TAB 1: LEDGER */}
            {activeTab === 'LEDGER' && (
              <div className="space-y-4">
                {/* Ledger Action & Filter Bar */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search ledger by title, person, or note..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono min-h-[38px]"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs p-1 font-mono cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTypeFilter}
                        onChange={(e) => setSelectedTypeFilter(e.target.value)}
                        className="flex-1 sm:flex-none px-3 py-2 text-xs bg-[#18181b] border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 text-zinc-300 font-mono min-h-[38px] cursor-pointer"
                      >
                        <option value="ALL">All Types</option>
                        <option value="EXPENSE">Expenses Only</option>
                        <option value="TRANSFER">Repayments</option>
                        <option value="KITTY">Kitty Pool</option>
                      </select>

                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="flex-1 sm:flex-none px-3 py-2 text-xs bg-[#18181b] border border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 text-zinc-300 font-mono min-h-[38px] cursor-pointer"
                      >
                        <option value="ALL">All Categories</option>
                        {Object.entries(CATEGORY_LABELS).map(([k, item]) => (
                          <option key={k} value={k}>
                            {item.label}
                          </option>
                        ))}
                        {StorageService.loadCustomCategories().map((cat) => (
                          <option key={cat.key} value={cat.key}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Transactions List */}
                {filteredTransactions.length === 0 ? (
                  <div className="card p-8 sm:p-12 text-center space-y-4">
                    <Receipt className="w-10 h-10 text-zinc-600 mx-auto" />
                    <div className="text-sm font-semibold text-zinc-300">No transactions found</div>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {(currentTrip.transactions || []).length === 0
                        ? 'Start by recording an expense or direct transfer.'
                        : 'No records matched your search filters.'}
                    </p>
                    {(currentTrip.transactions || []).length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpense(null);
                          setIsExpenseModalOpen(true);
                        }}
                        className="btn cursor-pointer mx-auto"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Expense</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredTransactions.map((tx) => {
                      const isExpense = tx.type === 'EXPENSE';
                      const isTransfer = tx.type === 'TRANSFER';
                      const isKittyDeposit = tx.type === 'KITTY_DEPOSIT';
                      const isKittyExpense = tx.type === 'KITTY_EXPENSE';
                      const isKittyPayout = tx.type === 'KITTY_PAYOUT';

                      const payersText = tx.payers
                        .map((payer) => {
                          const name =
                            payer.participantId === KITTY_ID
                              ? 'Common Kitty'
                              : pMap.get(payer.participantId)?.name || 'Someone';
                          return `${name} (${formatMoney(payer.amountCents, currentTrip.baseCurrency)})`;
                        })
                        .join(', ');

                      return (
                        <div
                          key={tx.id}
                          onClick={() => {
                            if (isExpense) {
                              setEditingExpense(tx);
                              setIsExpenseModalOpen(true);
                            }
                          }}
                          className={`card p-3.5 sm:p-4 hover:bg-white/[0.05] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isExpense ? 'cursor-pointer' : ''
                          }`}
                        >
                          {/* Info */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-medium text-[#F8F7F4] truncate">
                                {tx.title}
                              </h4>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded">
                                {isTransfer
                                  ? 'Repayment'
                                  : isKittyDeposit
                                  ? 'Kitty Deposit'
                                  : isKittyExpense
                                  ? 'Kitty Spend'
                                  : isKittyPayout
                                  ? 'Kitty Refund'
                                  : CATEGORY_LABELS[tx.category]?.label || tx.category}
                              </span>
                            </div>

                            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 flex-wrap">
                              <span>{tx.date}</span>
                              <span>·</span>
                              <span className="truncate">
                                Paid by: {payersText}
                              </span>
                              {tx.splitShares.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span>Split among {tx.splitShares.length}</span>
                                </>
                              )}
                            </div>

                            {tx.notes && (
                              <p className="text-xs text-zinc-500 italic line-clamp-1">{tx.notes}</p>
                            )}
                          </div>

                          {/* Amount & Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                            <div className="text-left sm:text-right">
                              <div className="text-base font-normal font-mono text-[#F8F7F4]">
                                {formatMoney(tx.totalAmountCents, currentTrip.baseCurrency)}
                              </div>
                              {tx.splitShares.length > 0 && tx.splitMethod === 'EQUAL' && (
                                <div className="text-[10px] text-zinc-500 font-mono">
                                  ~{formatMoney(
                                    Math.floor(tx.totalAmountCents / tx.splitShares.length),
                                    currentTrip.baseCurrency
                                  )}
                                  /person
                                </div>
                              )}
                            </div>

                            {/* Edit / Delete */}
                            <div className="flex items-center gap-1">
                              {isExpense && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingExpense(tx);
                                    setIsExpenseModalOpen(true);
                                  }}
                                  className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Edit Expense"
                                  aria-label="Edit Expense"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTransaction(tx.id);
                                }}
                                className="p-2 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                title="Delete Transaction"
                                aria-label="Delete Transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BALANCES & SETTLEMENTS */}
            {activeTab === 'BALANCES' && (
              <SettlementFlowVisualizer
                trip={currentTrip}
                participants={currentTrip.participants || []}
                balances={participantBalances}
                settlements={settlements}
                kittyBalanceCents={kittyBalanceCents}
                onRecordSettlement={handleRecordSettlement}
                onOpenPrintModal={() => setIsPrintModalOpen(true)}
              />
            )}

            {/* TAB 3: ARITHMETIC AUDIT */}
            {activeTab === 'AUDIT' && (
              <ArithmeticAuditView
                trip={currentTrip}
                participants={currentTrip.participants || []}
                transactions={currentTrip.transactions || []}
              />
            )}

            {/* TAB 4: COMMON KITTY */}
            {activeTab === 'KITTY' && (
              <KittyManagerView
                trip={currentTrip}
                participants={currentTrip.participants || []}
                transactions={currentTrip.transactions || []}
                kittyBalanceCents={kittyBalanceCents}
                onOpenKittyModal={() => setIsKittyModalOpen(true)}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {/* TAB 5: MEMBERS */}
            {activeTab === 'PARTICIPANTS' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium text-[#F8F7F4]">Trip Participants</h3>
                    <p className="text-xs text-zinc-400">
                      Manage travelers, colors, join dates for late arrivals, and contact info.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingParticipant(null);
                      setIsParticipantModalOpen(true);
                    }}
                    className="btn flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(currentTrip.participants || []).map((p) => {
                    const bal = participantBalances.find((b) => b.participantId === p.id);
                    return (
                      <div
                        key={p.id}
                        className="card p-4 space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: p.avatarColor }}
                              />
                              <h4 className="text-sm font-medium text-[#F8F7F4] truncate">{p.name}</h4>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingParticipant(p);
                                  setIsParticipantModalOpen(true);
                                }}
                                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                aria-label="Edit participant"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteParticipant(p.id);
                                }}
                                className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                title="Remove participant"
                                aria-label="Delete participant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs font-mono text-zinc-400 space-y-1 mt-3">
                            {p.phone && <div>Phone: {p.phone}</div>}
                            {p.email && <div>Email: {p.email}</div>}
                            {p.joinedDate && <div>Joined: {p.joinedDate}</div>}
                            {p.notes && <div className="italic text-zinc-500">{p.notes}</div>}
                          </div>
                        </div>

                        {bal && (
                          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                            <span className="text-zinc-400">Net Standing:</span>
                            <span
                              className={`font-semibold ${
                                bal.netBalanceCents > 0
                                  ? 'text-emerald-400'
                                  : bal.netBalanceCents < 0
                                  ? 'text-red-400'
                                  : 'text-zinc-500'
                              }`}
                            >
                              {bal.netBalanceCents >= 0 ? '+' : ''}
                              {formatMoney(bal.netBalanceCents, currentTrip.baseCurrency)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Right Column (Quick Stats Aside Card) */}
          <aside className="card p-6 space-y-6 h-fit lg:sticky lg:top-24">
            <h3 className="label">Quick Stats</h3>
            <div className="flex flex-col gap-5">
              <div>
                <div className="label">Total Spent</div>
                <div className="font-mono text-2xl font-normal text-[#F8F7F4] mt-0.5">
                  {formatMoney(totalExpensesCents, currentTrip.baseCurrency)}
                </div>
              </div>

              <div>
                <div className="label">Settlements</div>
                <div className="font-mono text-2xl font-normal text-[#F8F7F4] mt-0.5">
                  {settlements.length}
                </div>
              </div>

              <div>
                <div className="label">Kitty Balance</div>
                <div className="font-mono text-2xl font-normal text-emerald-400 mt-0.5">
                  {formatMoney(kittyBalanceCents, currentTrip.baseCurrency)}
                </div>
              </div>

              <div>
                <div className="label">Active Members</div>
                <div className="font-mono text-2xl font-normal text-[#F8F7F4] mt-0.5">
                  {(currentTrip.participants || []).length}
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingExpense(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="btn w-full cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
                  <span>+ Member Repayment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsKittyModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <PiggyBank className="w-3.5 h-3.5" />
                  <span>+ Kitty Pool Deposit</span>
                </button>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-2 text-[11px] font-mono text-zinc-400">
                <div className="flex justify-between">
                  <span>Currency</span>
                  <span className="text-zinc-200">{currentTrip.baseCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Arithmetic Audit</span>
                  <span className="text-emerald-400">Zero-Sum Conserved</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage</span>
                  <span className="text-zinc-200">Local / Offline</span>
                </div>
              </div>
            </div>
          </aside>
        </main>
      )}

      {/* MOBILE FLOATING ACTION BUTTON (ONLY INSIDE OPENED TRIP) */}
      {currentTrip && (
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setIsExpenseModalOpen(true);
          }}
          className="sm:hidden fixed right-4 bottom-20 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto"
          aria-label="Add new expense"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (ONLY INSIDE OPENED TRIP) */}
      {currentTrip && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111113]/95 backdrop-blur-md border-t border-white/10 px-2 py-1 pb-safe flex items-center justify-around shadow-2xl pointer-events-auto">
          <button
            type="button"
            onClick={() => setActiveTab('LEDGER')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] min-h-[48px] rounded-lg transition-colors cursor-pointer ${
              activeTab === 'LEDGER'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BALANCES')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] min-h-[48px] rounded-lg transition-colors cursor-pointer ${
              activeTab === 'BALANCES'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Balances</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('KITTY')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] min-h-[48px] rounded-lg transition-colors cursor-pointer ${
              activeTab === 'KITTY'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Kitty</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUDIT')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] min-h-[48px] rounded-lg transition-colors cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMoreOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] min-h-[48px] rounded-lg transition-colors cursor-pointer ${
              activeTab === 'PARTICIPANTS'
                ? 'text-indigo-400 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-mono mt-0.5">More</span>
          </button>
        </nav>
      )}

      {/* MOBILE MORE DRAWER SHEET */}
      {isMobileMoreOpen && currentTrip && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full bg-[#18181b] rounded-t-2xl border-t border-white/10 p-4 space-y-3 pb-safe max-h-[80dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Trip Navigation</span>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  handleBackToDashboard();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                  <span>Dashboard (All Trips)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('PARTICIPANTS');
                  setIsMobileMoreOpen(false);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Participants ({(currentTrip.participants || []).length})</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsBackupModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <span>Backups, Export & Sample Trips</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setEditingTripData(currentTrip);
                  setIsTripModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Trip Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setEditingTripData(null);
                  setIsTripModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 text-xs font-mono font-medium text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors mt-2 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Create New Trip</span>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* MODALS */}
      {currentTrip && isExpenseModalOpen && (
        <ExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => {
            setIsExpenseModalOpen(false);
            setEditingExpense(null);
          }}
          onSave={handleSaveExpense}
          participants={currentTrip.participants || []}
          baseCurrency={currentTrip.baseCurrency}
          initialData={editingExpense}
          tripStartDate={currentTrip.startDate}
        />
      )}

      {currentTrip && isTransferModalOpen && (
        <TransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSave={handleSaveTransfer}
          participants={currentTrip.participants || []}
          baseCurrency={currentTrip.baseCurrency}
          tripStartDate={currentTrip.startDate}
        />
      )}

      {currentTrip && isKittyModalOpen && (
        <KittyModal
          isOpen={isKittyModalOpen}
          onClose={() => setIsKittyModalOpen(false)}
          onSave={handleSaveKittyTx}
          participants={currentTrip.participants || []}
          baseCurrency={currentTrip.baseCurrency}
          currentKittyBalanceCents={kittyBalanceCents}
          tripStartDate={currentTrip.startDate}
        />
      )}

      {currentTrip && isParticipantModalOpen && (
        <ParticipantModal
          isOpen={isParticipantModalOpen}
          onClose={() => {
            setIsParticipantModalOpen(false);
            setEditingParticipant(null);
          }}
          onSave={handleSaveParticipant}
          initialData={editingParticipant}
          tripStartDate={currentTrip.startDate}
        />
      )}

      {/* Trip Modal (can be opened from Dashboard or inside a trip) */}
      {isTripModalOpen && (
        <TripModal
          isOpen={isTripModalOpen}
          onClose={() => {
            setIsTripModalOpen(false);
            setEditingTripData(null);
          }}
          onSave={handleSaveTrip}
          initialData={editingTripData}
        />
      )}

      {/* Load Trip by 6-Digit Key & Device Cache History Modal */}
      {isLoadTripModalOpen && (
        <LoadTripModal
          isOpen={isLoadTripModalOpen}
          onClose={() => setIsLoadTripModalOpen(false)}
          onTripLoaded={handleTripLoaded}
          activeTripKeys={trips.map((t) => t.tripKey).filter(Boolean) as string[]}
        />
      )}

      {/* Backup & Data Modal */}
      {isBackupModalOpen && (
        <BackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          onDataChanged={() => {
            setTrips(StorageService.loadTrips());
          }}
        />
      )}

      {/* Import JSON Modal */}
      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onDataChanged={() => {
            setTrips(StorageService.loadTrips());
          }}
        />
      )}

      {/* Print to PDF & Formatted Report Modal */}
      {isPrintModalOpen && currentTrip && (
        <TripPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          trip={currentTrip}
        />
      )}

      {/* Export Options Modal (PDF or JSON) */}
      {isExportModalOpen && currentTrip && (
        <TripExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          trip={currentTrip}
          onOpenPrintPreview={() => setIsPrintModalOpen(true)}
        />
      )}

      {/* Reusable Confirm & Alert Dialog (replacing blocked window.confirm / alert) */}
      {confirmDialog.isOpen && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          variant={confirmDialog.variant}
          isAlertOnly={confirmDialog.isAlertOnly}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
