/**
 * VibeForge V2 - Runs Store (VF-302: Enhanced with Offline-First Sync)
 *
 * Manages prompt execution runs and history using Svelte 5 runes with offline-first sync.
 *
 * Features:
 * - Offline-first: All runs saved to IndexedDB immediately
 * - Auto-sync: Background sync to DataForge when online
 * - Real-time sync: WebSocket updates from other devices/tabs
 * - Streaming execution: Token-by-token updates with local caching
 * - Run history: Complete execution history with search and filtering
 *
 * Phase 3 - Track A: Backend Persistence (VF-302)
 */

import type { PromptRun, RunStatus, Model, ContextBlock } from '$lib/core/types';
import { toApiRun, toPromptRun } from '$lib/core/api/runMapping';
import { executePromptSimplified, type SimplifiedExecuteResponse } from '$lib/core/api/neuroforgeClient';
import {
  ExecutionOrchestrator,
  type ExecutionRequest,
  type ExecutionOptions,
  type ExecutionResult,
  type ExecutionProgress,
  type StreamEvent,
} from '$lib/core/execution';
import * as sync from '$lib/core/sync';
import { initWebSocketSync } from '$lib/core/sync';

// ============================================================================
// TYPES
// ============================================================================

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict' | 'offline';

interface RunSyncMetadata {
  runId: string;
  status: SyncStatus;
  lastSynced: Date | null;
  pendingChanges: boolean;
  hasConflict: boolean;
  errorMessage: string | null;
}

// ============================================================================
// RUNS STATE
// ============================================================================

interface RunsState {
  runs: PromptRun[];
  activeRunId: string | null;
  isExecuting: boolean;
  executionProgress: number; // 0-100
  error: string | null;
  // NEW: Sync tracking
  syncStatus: SyncStatus;
  syncMetadata: Map<string, RunSyncMetadata>;
  isOnline: boolean;
  isLoadingHistory: boolean;
}

const state = $state<RunsState>({
  runs: [],
  activeRunId: null,
  isExecuting: false,
  executionProgress: 0,
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

const activeRun = $derived(state.runs.find((r) => r.id === state.activeRunId) || null);

const latestRun = $derived(
  state.runs.length > 0
    ? state.runs.reduce((latest, run) =>
        new Date(run.startedAt) > new Date(latest.startedAt) ? run : latest
      )
    : null
);

const runsByStatus = $derived(
  state.runs.reduce(
    (acc, run) => {
      if (!acc[run.status]) {
        acc[run.status] = [];
      }
      acc[run.status].push(run);
      return acc;
    },
    {} as Record<RunStatus, PromptRun[]>
  )
);

const successfulRuns = $derived(state.runs.filter((r) => r.status === 'success'));

const failedRuns = $derived(state.runs.filter((r) => r.status === 'error'));

const totalTokensUsed = $derived(
  state.runs.reduce((sum, run) => sum + (run.totalTokens || 0), 0)
);

const totalCost = $derived(state.runs.reduce((sum, run) => sum + (run.cost || 0), 0));

const averageDuration = $derived.by(() => {
  const completed = state.runs.filter((r) => r.durationMs !== undefined);
  if (completed.length === 0) return 0;
  const total = completed.reduce((sum, run) => sum + (run.durationMs || 0), 0);
  return Math.round(total / completed.length);
});

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

  // Subscribe to run updates from other tabs/devices
  wsSync.subscribe((update) => {
    if (update.resourceType === 'run') {
      handleRemoteRunUpdate(update);
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

function updateSyncMetadata(runId: string, updates: Partial<RunSyncMetadata>) {
  const existing = state.syncMetadata.get(runId);
  const updated: RunSyncMetadata = {
    runId,
    status: updates.status ?? existing?.status ?? 'idle',
    lastSynced: updates.lastSynced ?? existing?.lastSynced ?? null,
    pendingChanges: updates.pendingChanges ?? existing?.pendingChanges ?? false,
    hasConflict: updates.hasConflict ?? existing?.hasConflict ?? false,
    errorMessage: updates.errorMessage ?? existing?.errorMessage ?? null,
  };
  state.syncMetadata.set(runId, updated);
}

function getSyncMetadata(runId: string): RunSyncMetadata | undefined {
  return state.syncMetadata.get(runId);
}

function handleRemoteRunUpdate(update: any) {
  const { type, resourceId, data } = update;

  if (type === 'created' && data) {
    // Add new run from remote
    const exists = state.runs.find(r => r.id === resourceId);
    if (!exists) {
      state.runs = [data as PromptRun, ...state.runs];
    }
  } else if (type === 'updated' && data) {
    // Update run from remote
    state.runs = state.runs.map(r =>
      r.id === resourceId ? data as PromptRun : r
    );
    if (state.activeRunId === resourceId) {
      // Active run updated remotely - could show notification
    }
  } else if (type === 'deleted') {
    // Remove run deleted remotely
    state.runs = state.runs.filter(r => r.id !== resourceId);
    if (state.activeRunId === resourceId) {
      state.activeRunId = null;
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
    console.error('[RunsStore] Sync failed:', err);
  }
}

// ============================================================================
// BASIC ACTIONS
// ============================================================================

function setRuns(runs: PromptRun[]) {
  state.runs = runs;
  state.error = null;
}

async function addRun(run: PromptRun) {
  // Optimistically add to UI
  state.runs = [run, ...state.runs];

  // Mark as pending sync
  updateSyncMetadata(run.id, {
    status: state.isOnline ? 'syncing' : 'offline',
    pendingChanges: !state.isOnline,
  });

  // Save using sync manager (saves to IndexedDB + syncs to server)
  try {
    await sync.saveRun(toApiRun(run));

    // Update sync metadata on success
    updateSyncMetadata(run.id, {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: false,
    });
  } catch (err) {
    console.error('[RunsStore] Failed to sync run:', err);
    updateSyncMetadata(run.id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Sync failed',
    });
  }
}

async function updateRun(id: string, updates: Partial<PromptRun>) {
  // Find existing run
  const existing = state.runs.find(r => r.id === id);
  if (!existing) return;

  // Create updated run
  const updatedRun: PromptRun = {
    ...existing,
    ...updates,
  };

  // Optimistically update UI
  state.runs = state.runs.map((run) => (run.id === id ? updatedRun : run));

  // Mark as pending sync
  updateSyncMetadata(id, {
    status: state.isOnline ? 'syncing' : 'offline',
    pendingChanges: !state.isOnline,
  });

  // Save using sync manager
  try {
    await sync.saveRun(toApiRun(updatedRun));

    // Update sync metadata on success
    updateSyncMetadata(id, {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: false,
    });
  } catch (err) {
    console.error('[RunsStore] Failed to sync run update:', err);
    updateSyncMetadata(id, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Sync failed',
    });
  }
}

function removeRun(id: string) {
  state.runs = state.runs.filter((run) => run.id !== id);
  state.syncMetadata.delete(id);
}

function clearRuns() {
  state.runs = [];
  state.activeRunId = null;
  state.syncMetadata.clear();
}

function setActiveRun(id: string | null) {
  state.activeRunId = id;
}

function startExecution() {
  state.isExecuting = true;
  state.executionProgress = 0;
  state.error = null;
}

function updateExecutionProgress(progress: number) {
  state.executionProgress = Math.max(0, Math.min(100, progress));
}

function completeExecution() {
  state.isExecuting = false;
  state.executionProgress = 100;
}

function cancelExecution() {
  state.isExecuting = false;
  state.executionProgress = 0;
  // Update any pending runs to cancelled
  state.runs = state.runs.map((run) =>
    run.status === 'pending' || run.status === 'running'
      ? { ...run, status: 'cancelled' }
      : run
  );
}

function setError(error: string | null) {
  state.error = error;
  state.isExecuting = false;
}

function getRunById(id: string): PromptRun | undefined {
  return state.runs.find((run) => run.id === id);
}

function getRunsByModel(modelId: string): PromptRun[] {
  return state.runs.filter((run) => run.modelId === modelId);
}

// ============================================================================
// CRUD WITH OFFLINE-FIRST SYNC
// ============================================================================

/**
 * Load run history (from server if online, from cache if offline)
 */
async function loadHistory(workspaceId?: string, limit?: number) {
  state.isLoadingHistory = true;
  state.error = null;

  try {
    // Use sync manager to get runs (handles offline fallback)
    const runs = (await sync.listRuns(workspaceId)).map(toPromptRun);

    // Apply limit if specified
    const limitedRuns = limit ? runs.slice(0, limit) : runs;

    state.runs = limitedRuns;

    // Initialize sync metadata for each run
    for (const run of limitedRuns) {
      if (!state.syncMetadata.has(run.id)) {
        updateSyncMetadata(run.id, {
          status: 'synced',
          lastSynced: new Date(),
          pendingChanges: false,
        });
      }
    }
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Failed to load run history';
    console.error('[RunsStore] Load history failed:', err);
  } finally {
    state.isLoadingHistory = false;
  }
}

/**
 * Delete run (optimistic update)
 */
async function deleteRun(id: string) {
  // Captured before the try so the rollback in catch can still see it.
  const runToDelete = state.runs.find(r => r.id === id);

  try {
    // Optimistically remove from UI
    state.runs = state.runs.filter(r => r.id !== id);

    if (state.activeRunId === id) {
      state.activeRunId = null;
    }

    // Delete using sync manager
    await sync.deleteRun(id);

    // Remove sync metadata
    state.syncMetadata.delete(id);
  } catch (err) {
    // Rollback on error
    if (runToDelete) {
      state.runs = [runToDelete, ...state.runs];
    }
    state.error = err instanceof Error ? err.message : 'Failed to delete run';
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
      // Reload runs to get conflict data
      await loadHistory();
    } else if (result.errors.length > 0) {
      state.syncStatus = 'error';
      state.error = `Sync errors: ${result.errors.join(', ')}`;
    } else {
      state.syncStatus = 'synced';
      // Reload runs to get latest data
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
// EXECUTION (Enhanced with offline-first sync)
// ============================================================================

// Execute a prompt with a single model (Refactoring Plan Compatible)
async function execute(prompt: string, modelId: string, contextBlocks?: string[]): Promise<SimplifiedExecuteResponse> {
  state.isExecuting = true;
  state.error = null;

  try {
    const result = await executePromptSimplified({
      prompt,
      model_id: modelId,
      context_blocks: contextBlocks,
    });

    // Convert SimplifiedExecuteResponse to PromptRun format
    const run: PromptRun = {
      id: result.run_id,
      workspaceId: 'default', // SimplifiedExecuteResponse doesn't include workspace_id
      promptSnapshot: prompt,
      contextBlockIds: contextBlocks || [],
      modelId: result.model_id,
      output: result.output,
      status: 'success',
      totalTokens: result.usage.total_tokens,
      durationMs: result.latency_ms,
      startedAt: result.created_at,
      completedAt: new Date().toISOString(),
      cost: 0, // Calculate based on model pricing
    };

    await addRun(run); // Now uses offline-first sync
    state.activeRunId = run.id;
    return result;
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Execution failed';
    throw err;
  } finally {
    state.isExecuting = false;
  }
}

/**
 * Execute prompt with full execution engine (streaming, parallel, context)
 */
async function executeWithEngine(
  request: ExecutionRequest,
  options: ExecutionOptions = {}
): Promise<ExecutionResult[]> {
  state.isExecuting = true;
  state.error = null;
  state.executionProgress = 0;

  try {
    // Create placeholder runs immediately for each model (so they show in UI)
    const placeholderRuns: Map<string, PromptRun> = new Map();
    for (const model of request.models) {
      const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const placeholderRun: PromptRun = {
        id: runId,
        workspaceId: 'default',
        promptSnapshot: request.prompt,
        contextBlockIds: request.contextBlocks.map((b) => b.id),
        modelId: model.id,
        output: '',
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      placeholderRuns.set(model.id, placeholderRun);
      await addRun(placeholderRun); // Now uses offline-first sync
    }

    // Set first run as active
    const firstRun = Array.from(placeholderRuns.values())[0];
    if (firstRun) {
      state.activeRunId = firstRun.id;
    }

    // Set up stream event handler
    const streamEvents: StreamEvent[] = [];
    const onStreamEvent = (event: StreamEvent) => {
      streamEvents.push(event);

      // For start events, map the executor's run ID to our placeholder run
      if (event.type === 'start' && 'data' in event && 'modelId' in event.data) {
        const modelId = event.data.modelId;
        const placeholder = placeholderRuns.get(modelId);
        if (placeholder) {
          // Update placeholder run ID to match executor's run ID
          updateRun(placeholder.id, { id: event.runId });
          placeholderRuns.set(modelId, { ...placeholder, id: event.runId });
        }
      }

      // Update run output for token events (reactive update)
      if (event.type === 'token' && 'data' in event && 'token' in event.data) {
        const newOutput = event.data.token;
        // Find run by either the event runId or by model ID
        let targetRunId = event.runId;
        let run = state.runs.find((r) => r.id === targetRunId);

        if (run) {
          const updatedOutput = (run.output || '') + newOutput;
          streamRunUpdate(targetRunId, updatedOutput);
        }
      }
    };

    // Set up progress handler
    const onProgress = (progress: ExecutionProgress) => {
      state.executionProgress = progress.percentage;
    };

    // Execute with orchestrator
    const results = await ExecutionOrchestrator.execute(request, {
      ...options,
      onStreamEvent,
      onProgress,
    });

    // Update placeholder runs with final results
    for (const result of results) {
      // Find the placeholder run for this model
      const placeholder = Array.from(placeholderRuns.values()).find(
        (p) => p.modelId === result.model.id
      );

      if (placeholder) {
        // Update the existing placeholder with final results
        await updateRun(placeholder.id, {
          id: result.runId,
          output: result.output,
          status: result.status,
          totalTokens: result.usage.totalTokens,
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
          durationMs: result.durationMs,
          cost: result.usage.estimatedCost,
          completedAt: result.completedAt,
          error: result.error,
        });

        // Update placeholder map with new ID
        placeholderRuns.set(result.model.id, {
          ...placeholder,
          id: result.runId,
        });

        // Update active run ID if this was the active placeholder
        if (state.activeRunId === placeholder.id) {
          state.activeRunId = result.runId;
        }
      } else {
        // Fallback: create new run if no placeholder found
        const run: PromptRun = {
          id: result.runId,
          workspaceId: 'default',
          promptSnapshot: request.prompt,
          contextBlockIds: request.contextBlocks.map((b) => b.id),
          modelId: result.model.id,
          output: result.output,
          status: result.status,
          totalTokens: result.usage.totalTokens,
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
          durationMs: result.durationMs,
          cost: result.usage.estimatedCost,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          error: result.error,
        };
        await addRun(run); // Now uses offline-first sync
      }
    }

    state.executionProgress = 100;
    return results;
  } catch (err) {
    state.error = err instanceof Error ? err.message : 'Execution failed';
    throw err;
  } finally {
    state.isExecuting = false;
  }
}

/**
 * Execute with current prompt and context blocks from stores
 */
async function executeFromStores(
  prompt: string,
  models: Model[],
  contextBlocks: ContextBlock[],
  variables?: Record<string, string>,
  options?: ExecutionOptions
): Promise<ExecutionResult[]> {
  const request: ExecutionRequest = {
    prompt,
    models,
    contextBlocks,
    variables,
  };

  return executeWithEngine(request, options);
}

/**
 * Stream a single run update (local only, not synced)
 */
function streamRunUpdate(runId: string, output: string) {
  state.runs = state.runs.map((run) =>
    run.id === runId ? { ...run, output } : run
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const runsStore = {
  // State
  get runs() {
    return state.runs;
  },
  get activeRunId() {
    return state.activeRunId;
  },
  get isExecuting() {
    return state.isExecuting;
  },
  get executionProgress() {
    return state.executionProgress;
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
  get activeRun() {
    return activeRun;
  },
  get latestRun() {
    return latestRun;
  },
  get runsByStatus() {
    return runsByStatus;
  },
  get successfulRuns() {
    return successfulRuns;
  },
  get failedRuns() {
    return failedRuns;
  },
  get totalTokensUsed() {
    return totalTokensUsed;
  },
  get totalCost() {
    return totalCost;
  },
  get averageDuration() {
    return averageDuration;
  },

  // Actions
  setRuns,
  addRun,
  updateRun,
  removeRun,
  clearRuns,
  setActiveRun,
  startExecution,
  updateExecutionProgress,
  completeExecution,
  cancelExecution,
  setError,
  getRunById,
  getRunsByModel,
  getSyncMetadata,

  // CRUD with offline-first sync
  loadHistory,
  deleteRun,
  forceSyncAll,
  syncPendingChanges,

  // Execution (enhanced with offline-first sync)
  execute,
  executeWithEngine,
  executeFromStores,
  streamRunUpdate,
};
