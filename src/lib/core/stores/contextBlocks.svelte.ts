/**
 * VibeForge V2 - Context Blocks Store (VF-303: Enhanced with Offline-First Sync)
 *
 * Manages context blocks using Svelte 5 runes with offline-first sync.
 *
 * Features:
 * - Offline-first: All blocks saved to IndexedDB immediately
 * - Auto-sync: Background sync to DataForge when online
 * - Real-time sync: WebSocket updates from other devices/tabs
 * - Context library: Complete block history with search and filtering
 *
 * Phase 3 - Track A: Backend Persistence (VF-303)
 */

import type { ContextBlock } from "$lib/core/types";
import { browser } from "$app/environment";
import * as sync from '$lib/core/sync';
import { initWebSocketSync } from '$lib/core/sync';

// ============================================================================
// TYPES
// ============================================================================

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict' | 'offline';

interface ContextSyncMetadata {
  blockId: string;
  status: SyncStatus;
  lastSynced: Date | null;
  pendingChanges: boolean;
  hasConflict: boolean;
  errorMessage: string | null;
}

// ============================================================================
// LOCALSTORAGE PERSISTENCE (Fallback for non-synced data)
// ============================================================================

const STORAGE_KEY = "vibeforge:context-blocks";
const ORDER_KEY = "vibeforge:context-order";

function loadFromStorage(): ContextBlock[] {
  if (!browser) return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load context blocks from storage:", e);
  }
  return [];
}

function saveToStorage(blocks: ContextBlock[]) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
    // Save order separately for quick lookups
    const order = blocks.map((b) => b.id);
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch (e) {
    console.error("Failed to save context blocks to storage:", e);
  }
}

// ============================================================================
// CONTEXT BLOCKS STATE
// ============================================================================

interface ContextBlocksState {
  blocks: ContextBlock[];
  isLoading: boolean;
  error: string | null;
  // NEW: Sync tracking
  syncStatus: SyncStatus;
  syncMetadata: Map<string, ContextSyncMetadata>;
  isOnline: boolean;
  isLoadingHistory: boolean;
}

const state = $state<ContextBlocksState>({
  blocks: loadFromStorage(),
  isLoading: false,
  error: null,
  // NEW: Sync state
  syncStatus: 'idle',
  syncMetadata: new Map(),
  isOnline: true,
  isLoadingHistory: false,
});

// ============================================================================
// DERIVED STATE
// ============================================================================

const activeBlocks = $derived(state.blocks.filter((b) => b.isActive));

const inactiveBlocks = $derived(state.blocks.filter((b) => !b.isActive));

const activeBlockIds = $derived(activeBlocks.map((b) => b.id));

const blocksByKind = $derived(
  state.blocks.reduce((acc, block) => {
    if (!acc[block.kind]) {
      acc[block.kind] = [];
    }
    acc[block.kind].push(block);
    return acc;
  }, {} as Record<string, ContextBlock[]>)
);

const totalActiveTokens = $derived(
  activeBlocks.reduce(
    (sum, block) => sum + Math.floor(block.content.length / 4),
    0
  )
);

// NEW: Sync derived state
const hasPendingChanges = $derived(
  Array.from(state.syncMetadata.values()).some(m => m.pendingChanges)
);

const hasConflicts = $derived(
  Array.from(state.syncMetadata.values()).some(m => m.hasConflict)
);

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize WebSocket sync on store creation
let wsSync: ReturnType<typeof initWebSocketSync> | null = null;

if (typeof window !== 'undefined') {
  // Initialize WebSocket for real-time updates
  wsSync = initWebSocketSync();

  // Subscribe to context block updates from other tabs/devices
  wsSync.subscribe((update) => {
    if (update.resourceType === 'contextBlock') {
      handleRemoteContextUpdate(update);
    }
  });

  // Update online status
  state.isOnline = sync.getOnlineStatus();

  // Listen for online/offline events
  window.addEventListener('online', () => {
    state.isOnline = true;
    state.syncStatus = 'syncing';
    // Trigger sync of pending changes
    syncPendingChanges().catch(console.error);
  });

  window.addEventListener('offline', () => {
    state.isOnline = false;
    state.syncStatus = 'offline';
  });
}

// ============================================================================
// SYNC HELPERS
// ============================================================================

function updateSyncMetadata(blockId: string, updates: Partial<ContextSyncMetadata>) {
  const existing = state.syncMetadata.get(blockId);
  const updated: ContextSyncMetadata = {
    blockId,
    status: updates.status ?? existing?.status ?? 'idle',
    lastSynced: updates.lastSynced ?? existing?.lastSynced ?? null,
    pendingChanges: updates.pendingChanges ?? existing?.pendingChanges ?? false,
    hasConflict: updates.hasConflict ?? existing?.hasConflict ?? false,
    errorMessage: updates.errorMessage ?? existing?.errorMessage ?? null,
  };
  state.syncMetadata.set(blockId, updated);
}

function getSyncMetadata(blockId: string): ContextSyncMetadata | undefined {
  return state.syncMetadata.get(blockId);
}

function handleRemoteContextUpdate(update: any) {
  const { type, resourceId, data } = update;

  if (type === 'created' && data) {
    // Add new block from remote
    const exists = state.blocks.find(b => b.id === resourceId);
    if (!exists) {
      state.blocks = [...state.blocks, data as ContextBlock];
      saveToStorage(state.blocks);
    }
  } else if (type === 'updated' && data) {
    // Update block from remote
    state.blocks = state.blocks.map(b =>
      b.id === resourceId ? data as ContextBlock : b
    );
    saveToStorage(state.blocks);
  } else if (type === 'deleted') {
    // Remove block deleted remotely
    state.blocks = state.blocks.filter(b => b.id !== resourceId);
    saveToStorage(state.blocks);
  }
}

async function syncPendingChanges() {
  if (!state.isOnline) return;

  try {
    state.syncStatus = 'syncing';
    const result = await sync.syncAll({ forceSync: true });

    if (result.conflicts > 0) {
      state.syncStatus = 'conflict';
    } else if (result.errors.length > 0) {
      state.syncStatus = 'error';
    } else {
      state.syncStatus = 'synced';
    }
  } catch (err) {
    state.syncStatus = 'error';
    console.error('[ContextBlocksStore] Sync failed:', err);
  }
}

// ============================================================================
// BASIC ACTIONS (Enhanced with offline-first sync)
// ============================================================================

function setBlocks(blocks: ContextBlock[]) {
  state.blocks = blocks;
  state.error = null;
  saveToStorage(blocks);
}

async function addBlock(block: ContextBlock) {
  // Optimistically add to UI
  state.blocks = [...state.blocks, block];
  saveToStorage(state.blocks);

  // Mark as pending sync
  updateSyncMetadata(block.id, {
    status: state.isOnline ? 'syncing' : 'offline',
    pendingChanges: !state.isOnline,
  });

  // Save using sync manager (saves to IndexedDB + syncs to server)
  try {
    await sync.saveContext(block);

    // Update sync metadata on success
    updateSyncMetadata(block.id, {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: false,
    });
  } catch (err) {
    console.error('[ContextBlocksStore] Failed to sync block:', err);
    updateSyncMetadata(block.id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Sync failed',
    });
  }
}

async function updateBlock(id: string, updates: Partial<ContextBlock>) {
  // Find existing block
  const existing = state.blocks.find(b => b.id === id);
  if (!existing) return;

  // Create updated block
  const updatedBlock: ContextBlock = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Optimistically update UI
  state.blocks = state.blocks.map((block) =>
    block.id === id ? updatedBlock : block
  );
  saveToStorage(state.blocks);

  // Mark as pending sync
  updateSyncMetadata(id, {
    status: state.isOnline ? 'syncing' : 'offline',
    pendingChanges: !state.isOnline,
  });

  // Save using sync manager
  try {
    await sync.saveContext(updatedBlock);

    // Update sync metadata on success
    updateSyncMetadata(id, {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: false,
    });
  } catch (err) {
    console.error('[ContextBlocksStore] Failed to sync block update:', err);
    updateSyncMetadata(id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Sync failed',
    });
  }
}

function removeBlock(id: string) {
  state.blocks = state.blocks.filter((block) => block.id !== id);
  state.syncMetadata.delete(id);
  saveToStorage(state.blocks);
}

function toggleActive(id: string) {
  const block = state.blocks.find(b => b.id === id);
  if (block) {
    updateBlock(id, { isActive: !block.isActive });
  }
}

function setActiveOnly(ids: string[]) {
  state.blocks = state.blocks.map((block) => ({
    ...block,
    isActive: ids.includes(block.id),
  }));
  saveToStorage(state.blocks);

  // Sync all updated blocks
  for (const block of state.blocks) {
    updateBlock(block.id, { isActive: block.isActive });
  }
}

function activateAll() {
  state.blocks = state.blocks.map((block) => ({ ...block, isActive: true }));
  saveToStorage(state.blocks);

  // Sync all blocks
  for (const block of state.blocks) {
    updateBlock(block.id, { isActive: true });
  }
}

function deactivateAll() {
  state.blocks = state.blocks.map((block) => ({ ...block, isActive: false }));
  saveToStorage(state.blocks);

  // Sync all blocks
  for (const block of state.blocks) {
    updateBlock(block.id, { isActive: false });
  }
}

function setLoading(loading: boolean) {
  state.isLoading = loading;
}

function setError(error: string | null) {
  state.error = error;
}

function getBlockById(id: string): ContextBlock | undefined {
  return state.blocks.find((block) => block.id === id);
}

function reorderBlock(draggedId: string, targetId: string) {
  const draggedIndex = state.blocks.findIndex((b) => b.id === draggedId);
  const targetIndex = state.blocks.findIndex((b) => b.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  const newBlocks = [...state.blocks];
  const [draggedBlock] = newBlocks.splice(draggedIndex, 1);
  newBlocks.splice(targetIndex, 0, draggedBlock);

  state.blocks = newBlocks;
  saveToStorage(state.blocks);

  // Sync reordered blocks (order matters for some use cases)
  for (const block of newBlocks) {
    updateBlock(block.id, {}); // Touch to trigger sync
  }
}

// ============================================================================
// CRUD WITH OFFLINE-FIRST SYNC
// ============================================================================

/**
 * Load context block history (from server if online, from cache if offline)
 */
async function loadHistory(workspaceId?: string, limit?: number) {
  state.isLoadingHistory = true;
  state.error = null;

  try {
    // Use sync manager to get blocks (handles offline fallback).
    // ContextBlock carries no workspace association yet, so the sync layer
    // cannot filter by workspaceId; the parameter is accepted but inert here.
    const blocks = await sync.listContexts();

    // Apply limit if specified
    const limitedBlocks = limit ? blocks.slice(0, limit) : blocks;

    state.blocks = limitedBlocks;
    saveToStorage(limitedBlocks);

    // Initialize sync metadata for each block
    for (const block of limitedBlocks) {
      if (!state.syncMetadata.has(block.id)) {
        updateSyncMetadata(block.id, {
          status: 'synced',
          lastSynced: new Date(),
          pendingChanges: false,
        });
      }
    }
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to load context library';
    console.error('[ContextBlocksStore] Load history failed:', err);
  } finally {
    state.isLoadingHistory = false;
  }
}

/**
 * Delete context block (optimistic update)
 */
async function deleteBlock(id: string) {
  // Captured before the try so the rollback in catch can still see it.
  const blockToDelete = state.blocks.find(b => b.id === id);

  try {
    // Optimistically remove from UI
    state.blocks = state.blocks.filter(b => b.id !== id);
    saveToStorage(state.blocks);

    // Delete using sync manager
    await sync.deleteContext(id);

    // Remove sync metadata
    state.syncMetadata.delete(id);
  } catch (err) {
    // Rollback on error
    if (blockToDelete) {
      state.blocks = [...state.blocks, blockToDelete];
      saveToStorage(state.blocks);
    }
    state.error = err instanceof Error ? err.message : 'Failed to delete context block';
    throw err;
  }
}

/**
 * Force sync all pending changes (manual trigger)
 */
async function forceSyncAll() {
  if (!state.isOnline) {
    state.error = 'Cannot sync while offline';
    return;
  }

  state.syncStatus = 'syncing';

  try {
    const result = await sync.syncAll({ forceSync: true, resolveConflicts: true });

    if (result.conflicts > 0) {
      state.syncStatus = 'conflict';
      // Reload blocks to get conflict data
      await loadHistory();
    } else if (result.errors.length > 0) {
      state.syncStatus = 'error';
      state.error = `Sync errors: ${result.errors.join(', ')}`;
    } else {
      state.syncStatus = 'synced';
      // Reload blocks to get latest data
      await loadHistory();
    }

    return result;
  } catch (err) {
    state.syncStatus = 'error';
    state.error = err instanceof Error ? err.message : 'Sync failed';
    throw err;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const contextBlocksStore = {
  // State
  get blocks() {
    return state.blocks;
  },
  get isLoading() {
    return state.isLoading;
  },
  get error() {
    return state.error;
  },

  // NEW: Sync state
  get syncStatus() {
    return state.syncStatus;
  },
  get isOnline() {
    return state.isOnline;
  },
  get hasPendingChanges() {
    return hasPendingChanges;
  },
  get hasConflicts() {
    return hasConflicts;
  },
  get isLoadingHistory() {
    return state.isLoadingHistory;
  },

  // Derived
  get activeBlocks() {
    return activeBlocks;
  },
  get inactiveBlocks() {
    return inactiveBlocks;
  },
  get activeBlockIds() {
    return activeBlockIds;
  },
  get blocksByKind() {
    return blocksByKind;
  },
  get totalActiveTokens() {
    return totalActiveTokens;
  },

  // Actions
  setBlocks,
  addBlock,
  updateBlock,
  removeBlock,
  toggleActive,
  setActiveOnly,
  activateAll,
  deactivateAll,
  setLoading,
  setError,
  getBlockById,
  reorderBlock,
  getSyncMetadata,

  // CRUD with offline-first sync
  loadHistory,
  deleteBlock,
  forceSyncAll,
  syncPendingChanges,
};
