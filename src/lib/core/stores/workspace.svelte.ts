/**
 * VibeForge V2 - Workspace Store (VF-301: Enhanced with Offline-First Sync)
 *
 * Manages workspace state using Svelte 5 runes with offline-first sync.
 *
 * Features:
 * - Offline-first: All changes saved to IndexedDB immediately
 * - Auto-sync: Background sync to DataForge when online
 * - Conflict resolution: Detects and resolves sync conflicts
 * - Multi-device: Real-time sync via WebSocket
 * - Resilient: Works offline, syncs when reconnected
 *
 * Phase 3 - Track A: Backend Persistence
 * Note: .svelte.ts extension required for Svelte 5 runes in TS files
 */

import type { Workspace } from '$lib/core/types';
import type { CreateWorkspaceRequest } from '$lib/core/api/dataforgeClient.enhanced';
import * as sync from '$lib/core/sync';
import { initWebSocketSync } from '$lib/core/sync';

// ============================================================================
// TYPES
// ============================================================================

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict' | 'offline';

interface WorkspaceSyncMetadata {
  workspaceId: string;
  status: SyncStatus;
  lastSynced: Date | null;
  pendingChanges: boolean;
  hasConflict: boolean;
  errorMessage: string | null;
}

// ============================================================================
// WORKSPACE STATE
// ============================================================================

interface WorkspaceState {
  workspaces: Workspace[];
  current: Workspace | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  // NEW: Sync tracking
  syncStatus: SyncStatus;
  syncMetadata: Map<string, WorkspaceSyncMetadata>;
  isOnline: boolean;
}

// Create workspace store state
const state = $state<WorkspaceState>({
  workspaces: [],
  current: null,
  isLoading: false,
  isSaving: false,
  error: null,
  // NEW: Sync state
  syncStatus: 'idle',
  syncMetadata: new Map(),
  isOnline: true,
});

// ============================================================================
// DERIVED STATE
// ============================================================================

const workspaceId = $derived(state.current?.id);
const theme = $derived(state.current?.settings.theme ?? 'dark');
const autoSave = $derived(state.current?.settings.autoSave ?? true);

// NEW: Sync derived state
const hasPendingChanges = $derived(
  Array.from(state.syncMetadata.values()).some(m => m.pendingChanges)
);

const hasConflicts = $derived(
  Array.from(state.syncMetadata.values()).some(m => m.hasConflict)
);

const currentWorkspaceSyncStatus = $derived.by(() => {
  if (!state.current) return null;
  return state.syncMetadata.get(state.current.id) ?? null;
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize WebSocket sync on store creation
let wsSync: ReturnType<typeof initWebSocketSync> | null = null;

if (typeof window !== 'undefined') {
  // Initialize WebSocket for real-time updates
  wsSync = initWebSocketSync();

  // Subscribe to workspace updates from other tabs/devices
  wsSync.subscribe((update) => {
    if (update.resourceType === 'workspace') {
      handleRemoteWorkspaceUpdate(update);
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

function updateSyncMetadata(workspaceId: string, updates: Partial<WorkspaceSyncMetadata>) {
  const existing = state.syncMetadata.get(workspaceId);
  const updated: WorkspaceSyncMetadata = {
    workspaceId,
    status: updates.status ?? existing?.status ?? 'idle',
    lastSynced: updates.lastSynced ?? existing?.lastSynced ?? null,
    pendingChanges: updates.pendingChanges ?? existing?.pendingChanges ?? false,
    hasConflict: updates.hasConflict ?? existing?.hasConflict ?? false,
    errorMessage: updates.errorMessage ?? existing?.errorMessage ?? null,
  };
  state.syncMetadata.set(workspaceId, updated);
}

function handleRemoteWorkspaceUpdate(update: any) {
  const { type, resourceId, data } = update;

  if (type === 'created' && data) {
    // Add new workspace from remote
    const exists = state.workspaces.find(w => w.id === resourceId);
    if (!exists) {
      state.workspaces = [data as Workspace, ...state.workspaces];
    }
  } else if (type === 'updated' && data) {
    // Update workspace from remote
    state.workspaces = state.workspaces.map(w =>
      w.id === resourceId ? data as Workspace : w
    );
    if (state.current?.id === resourceId) {
      state.current = data as Workspace;
    }
  } else if (type === 'deleted') {
    // Remove workspace deleted remotely
    state.workspaces = state.workspaces.filter(w => w.id !== resourceId);
    if (state.current?.id === resourceId) {
      state.current = null;
    }
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
    console.error('[WorkspaceStore] Sync failed:', err);
  }
}

// ============================================================================
// BASIC ACTIONS
// ============================================================================

function setWorkspace(workspace: Workspace) {
  state.current = workspace;
  state.error = null;
}

function setLoading(loading: boolean) {
  state.isLoading = loading;
}

function setError(error: string | null) {
  state.error = error;
}

function updateSettings(settings: Partial<Workspace['settings']>) {
  if (state.current) {
    state.current.settings = {
      ...state.current.settings,
      ...settings,
    };
    // Save updated workspace (optimistic update)
    update(state.current.id, { settings: state.current.settings }).catch(console.error);
  }
}

function clearWorkspace() {
  state.current = null;
  state.error = null;
}

function clearError() {
  state.error = null;
}

// ============================================================================
// CRUD OPERATIONS (VF-301: Offline-First with Sync Manager)
// ============================================================================

/**
 * Load all workspaces (from server if online, from cache if offline)
 */
async function load() {
  state.isLoading = true;
  state.error = null;

  try {
    // Use sync manager to get workspaces (handles offline fallback)
    state.workspaces = await sync.listWorkspaces();

    // Initialize sync metadata for each workspace
    for (const workspace of state.workspaces) {
      if (!state.syncMetadata.has(workspace.id)) {
        updateSyncMetadata(workspace.id, {
          status: 'synced',
          lastSynced: new Date(),
          pendingChanges: false,
        });
      }
    }
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to load workspaces';
  } finally {
    state.isLoading = false;
  }
}

/**
 * Create new workspace (optimistic update)
 */
async function create(data: CreateWorkspaceRequest) {
  state.isSaving = true;
  state.error = null;

  try {
    // Create workspace ID
    const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newWorkspace: Workspace = {
      id: workspaceId,
      name: data.name,
      description: data.description || '',
      settings: data.settings || { theme: 'dark', autoSave: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update UI immediately
    state.workspaces = [newWorkspace, ...state.workspaces];
    state.current = newWorkspace;

    // Mark as pending sync
    updateSyncMetadata(workspaceId, {
      status: state.isOnline ? 'syncing' : 'offline',
      pendingChanges: !state.isOnline,
    });

    // Save using sync manager (saves to IndexedDB + syncs to server)
    const savedWorkspace = await sync.saveWorkspace(newWorkspace);

    // Update sync metadata on success
    updateSyncMetadata(workspaceId, {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: false,
    });

    return savedWorkspace;
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to create workspace';
    throw err;
  } finally {
    state.isSaving = false;
  }
}

/**
 * Update workspace (optimistic update)
 */
async function update(id: string, data: Partial<CreateWorkspaceRequest>) {
  state.isSaving = true;
  state.error = null;

  try {
    // Find existing workspace
    const existing = state.workspaces.find(w => w.id === id);
    if (!existing) {
      throw new Error('Workspace not found');
    }

    // Create updated workspace
    const updatedWorkspace: Workspace = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      settings: data.settings ?? existing.settings,
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update UI immediately
    state.workspaces = state.workspaces.map(w => w.id === id ? updatedWorkspace : w);
    if (state.current?.id === id) {
      state.current = updatedWorkspace;
    }

    // Mark as pending sync
    updateSyncMetadata(id, {
      status: state.isOnline ? 'syncing' : 'offline',
      pendingChanges: !state.isOnline,
    });

    // Save using sync manager
    const savedWorkspace = await sync.saveWorkspace(updatedWorkspace);

    // Update sync metadata on success
    updateSyncMetadata(id, {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: false,
    });

    return savedWorkspace;
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to update workspace';

    // Mark sync error
    updateSyncMetadata(id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Sync failed',
    });

    throw err;
  } finally {
    state.isSaving = false;
  }
}

/**
 * Delete workspace (optimistic update)
 */
async function remove(id: string) {
  state.isSaving = true;
  state.error = null;

  try {
    // Optimistically remove from UI
    state.workspaces = state.workspaces.filter(w => w.id !== id);
    if (state.current?.id === id) {
      state.current = null;
    }

    // Delete using sync manager
    await sync.deleteWorkspace(id);

    // Remove sync metadata
    state.syncMetadata.delete(id);
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to delete workspace';
    throw err;
  } finally {
    state.isSaving = false;
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
      // Reload workspaces to get conflict data
      await load();
    } else if (result.errors.length > 0) {
      state.syncStatus = 'error';
      state.error = `Sync errors: ${result.errors.join(', ')}`;
    } else {
      state.syncStatus = 'synced';
      // Reload workspaces to get latest data
      await load();
    }

    return result;
  } catch (err) {
    state.syncStatus = 'error';
    state.error = err instanceof Error ? err.message : 'Sync failed';
    throw err;
  }
}

/**
 * Get workspace by ID (from cache or server)
 */
async function getById(id: string): Promise<Workspace | null> {
  try {
    return await sync.getWorkspace(id);
  } catch (err) {
    console.error('[WorkspaceStore] Failed to get workspace:', err);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const workspaceStore = {
  // State
  get workspaces() {
    return state.workspaces;
  },
  get current() {
    return state.current;
  },
  get isLoading() {
    return state.isLoading;
  },
  get isSaving() {
    return state.isSaving;
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
  get currentWorkspaceSyncStatus() {
    return currentWorkspaceSyncStatus;
  },

  // Derived
  get workspaceId() {
    return workspaceId;
  },
  get theme() {
    return theme;
  },
  get autoSave() {
    return autoSave;
  },

  // Actions
  setWorkspace,
  setLoading,
  setError,
  updateSettings,
  clearWorkspace,
  clearError,

  // CRUD (enhanced with offline-first sync)
  load,
  create,
  update,
  remove,
  getById,

  // NEW: Sync actions
  forceSyncAll,
  syncPendingChanges,
};
