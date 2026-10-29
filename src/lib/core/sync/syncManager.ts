/**
 * VibeForge V2 - Sync Manager (VF-300)
 *
 * Coordinates synchronization between IndexedDB cache and DataForge backend:
 * - Optimistic updates with automatic rollback on error
 * - Automatic sync when online
 * - Conflict detection and resolution
 * - Pending operations queue processing
 * - Last-write-wins + manual merge strategies
 *
 * Phase 3 - Track A: Backend Persistence
 */

import type { Workspace, ContextBlock } from "$lib/core/types";
import type { Run, PromptTemplate } from "$lib/core/api/dataforgeClient.enhanced";
import * as api from "$lib/core/api/dataforgeClient.enhanced";
import * as indexedDb from "./indexedDb";
import type {
  SyncMetadata,
  PendingOperation,
  ConflictResolution,
} from "./indexedDb";

// ============================================================================
// TYPES
// ============================================================================

type Resource = Workspace | ContextBlock | Run | PromptTemplate;
type ResourceType = 'workspace' | 'contextBlock' | 'run' | 'promptTemplate';

export interface SyncOptions {
  forceSync?: boolean;
  resolveConflicts?: boolean;
  strategy?: 'local' | 'server' | 'manual';
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: number;
  errors: string[];
}

// ============================================================================
// ONLINE/OFFLINE DETECTION
// ============================================================================

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('[SyncManager] Online - starting sync...');
    syncAll().catch(console.error);
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('[SyncManager] Offline - queuing operations...');
  });
}

export function getOnlineStatus(): boolean {
  // Refresh from the live value where the environment has one. The cached flag
  // only changes on online/offline events, and a missed event would strand
  // every branch below on a stale answer.
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    isOnline = navigator.onLine;
  }
  return isOnline;
}

// ============================================================================
// OPTIMISTIC UPDATES
// ============================================================================

async function createSyncMetadata(
  id: string,
  resourceType: ResourceType
): Promise<SyncMetadata> {
  return {
    id: `${resourceType}:${id}`,
    resourceType,
    lastSyncedAt: new Date().toISOString(),
    localVersion: 1,
    serverVersion: 0,
    isPending: true,
    hasConflict: false,
  };
}

async function updateSyncMetadata(
  id: string,
  resourceType: ResourceType,
  updates: Partial<SyncMetadata>
): Promise<void> {
  const existing = await indexedDb.syncMetadataStore.get(`${resourceType}:${id}`);
  if (existing) {
    await indexedDb.syncMetadataStore.save({
      ...existing,
      ...updates,
    });
  }
}

// ============================================================================
// WORKSPACE SYNC
// ============================================================================

export async function saveWorkspace(workspace: Workspace): Promise<Workspace> {
  // Save to IndexedDB immediately (optimistic update)
  await indexedDb.workspaceStore.save(workspace);

  // Update sync metadata
  const metadata = await createSyncMetadata(workspace.id, 'workspace');
  await indexedDb.syncMetadataStore.save(metadata);

  if (getOnlineStatus()) {
    try {
      // Sync to server
      const existing = await api.getWorkspace(workspace.id).catch(() => null);
      const saved = existing
        ? await api.updateWorkspace(workspace.id, workspace)
        : await api.createWorkspace(workspace);

      // Update sync metadata on success
      await updateSyncMetadata(workspace.id, 'workspace', {
        isPending: false,
        serverVersion: metadata.localVersion,
        lastSyncedAt: new Date().toISOString(),
      });

      return saved;
    } catch (error) {
      console.error('[SyncManager] Failed to sync workspace:', error);
      // Add to pending operations
      await indexedDb.pendingOperationsStore.add({
        id: `pending_${Date.now()}`,
        resourceType: 'workspace',
        operation: 'update',
        resourceId: workspace.id,
        data: workspace,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    }
  }

  return workspace;
}

export async function deleteWorkspace(id: string): Promise<void> {
  // Delete from IndexedDB immediately
  await indexedDb.workspaceStore.delete(id);

  const pendingDelete: PendingOperation = {
    id: `pending_${Date.now()}`,
    resourceType: 'workspace',
    operation: 'delete',
    resourceId: id,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  // Offline, the delete still has to reach the server later. Queueing it
  // only in the catch below dropped every offline delete silently.
  if (!getOnlineStatus()) {
    await indexedDb.pendingOperationsStore.add(pendingDelete);
    return;
  }

  try {
    await api.deleteWorkspace(id);
    await indexedDb.syncMetadataStore.delete(`workspace:${id}`);
  } catch (error) {
    console.error('[SyncManager] Failed to delete workspace:', error);
    await indexedDb.pendingOperationsStore.add(pendingDelete);
  }
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  // Try IndexedDB first
  let workspace = await indexedDb.workspaceStore.get(id);

  if (!workspace && getOnlineStatus()) {
    // Fallback to server
    try {
      workspace = await api.getWorkspace(id);
      if (workspace) {
        await indexedDb.workspaceStore.save(workspace);
      }
    } catch (error) {
      console.error('[SyncManager] Failed to fetch workspace:', error);
    }
  }

  return workspace;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  // Try IndexedDB first
  let workspaces = await indexedDb.workspaceStore.getAll();

  if (workspaces.length === 0 && getOnlineStatus()) {
    // Fallback to server
    try {
      workspaces = await api.listWorkspaces();
      await Promise.all(workspaces.map(w => indexedDb.workspaceStore.save(w)));
    } catch (error) {
      console.error('[SyncManager] Failed to fetch workspaces:', error);
    }
  }

  return workspaces;
}

// ============================================================================
// CONTEXT BLOCK SYNC
// ============================================================================

export async function saveContextBlock(block: ContextBlock): Promise<ContextBlock> {
  await indexedDb.contextBlockStore.save(block);
  const metadata = await createSyncMetadata(block.id, 'contextBlock');
  await indexedDb.syncMetadataStore.save(metadata);

  if (getOnlineStatus()) {
    try {
      const result = await api.getContextBlock(block.id);
      const saved = result.success && result.data
        ? await api.updateContextBlock(block.id, block)
        : await api.createContextBlock(block);

      if (saved.success && saved.data) {
        await updateSyncMetadata(block.id, 'contextBlock', {
          isPending: false,
          serverVersion: metadata.localVersion,
          lastSyncedAt: new Date().toISOString(),
        });
        return saved.data;
      }
    } catch (error) {
      console.error('[SyncManager] Failed to sync context block:', error);
      await indexedDb.pendingOperationsStore.add({
        id: `pending_${Date.now()}`,
        resourceType: 'contextBlock',
        operation: 'update',
        resourceId: block.id,
        data: block,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    }
  }

  return block;
}

export async function deleteContextBlock(id: string): Promise<void> {
  await indexedDb.contextBlockStore.delete(id);

  const pendingDelete: PendingOperation = {
    id: `pending_${Date.now()}`,
    resourceType: 'contextBlock',
    operation: 'delete',
    resourceId: id,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  // Offline, the delete still has to reach the server later. Queueing it
  // only in the catch below dropped every offline delete silently.
  if (!getOnlineStatus()) {
    await indexedDb.pendingOperationsStore.add(pendingDelete);
    return;
  }

  try {
    await api.deleteContextBlock(id);
    await indexedDb.syncMetadataStore.delete(`contextBlock:${id}`);
  } catch (error) {
    console.error('[SyncManager] Failed to delete context block:', error);
    await indexedDb.pendingOperationsStore.add(pendingDelete);
  }
}

export async function listContextBlocks(): Promise<ContextBlock[]> {
  let blocks = await indexedDb.contextBlockStore.getAll();

  if (blocks.length === 0 && getOnlineStatus()) {
    try {
      const result = await api.listContextBlocks();
      if (result.success && result.data) {
        blocks = result.data.items;
        await Promise.all(blocks.map(b => indexedDb.contextBlockStore.save(b)));
      }
    } catch (error) {
      console.error('[SyncManager] Failed to fetch context blocks:', error);
    }
  }

  return blocks;
}

// ============================================================================
// RUN SYNC
// ============================================================================

export async function saveRun(run: Run): Promise<Run> {
  await indexedDb.runStore.save(run);
  const metadata = await createSyncMetadata(run.id, 'run');
  await indexedDb.syncMetadataStore.save(metadata);

  if (getOnlineStatus()) {
    try {
      const result = await api.getRun(run.id);
      const saved = result.success && result.data
        ? await api.updateRun(run.id, run)
        : await api.createRun({
            workspaceId: run.workspaceId,
            promptText: run.promptText,
            contextBlockIds: run.contextBlockIds,
            model: run.model,
            provider: run.provider,
          });

      if (saved.success && saved.data) {
        await updateSyncMetadata(run.id, 'run', {
          isPending: false,
          serverVersion: metadata.localVersion,
          lastSyncedAt: new Date().toISOString(),
        });
        return saved.data;
      }
    } catch (error) {
      console.error('[SyncManager] Failed to sync run:', error);
      await indexedDb.pendingOperationsStore.add({
        id: `pending_${Date.now()}`,
        resourceType: 'run',
        operation: 'update',
        resourceId: run.id,
        data: run,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    }
  }

  return run;
}

export async function listRuns(workspaceId?: string): Promise<Run[]> {
  let runs = workspaceId
    ? await indexedDb.runStore.getByWorkspace(workspaceId)
    : await indexedDb.runStore.getAll();

  if (runs.length === 0 && getOnlineStatus()) {
    try {
      const result = await api.listRuns(workspaceId);
      if (result.success && result.data) {
        runs = result.data.items;
        await Promise.all(runs.map(r => indexedDb.runStore.save(r)));
      }
    } catch (error) {
      console.error('[SyncManager] Failed to fetch runs:', error);
    }
  }

  return runs;
}

export async function deleteRun(id: string): Promise<void> {
  await indexedDb.runStore.delete(id);

  const pendingDelete: PendingOperation = {
    id: `pending_${Date.now()}`,
    resourceType: 'run',
    resourceId: id,
    operation: 'delete',
    data: null,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  // Offline, the delete still has to reach the server later. Queueing it
  // only in the catch below dropped every offline delete silently.
  if (!getOnlineStatus()) {
    await indexedDb.pendingOperationsStore.add(pendingDelete);
    return;
  }

  try {
    await api.deleteRun(id);
    await indexedDb.syncMetadataStore.delete(`run:${id}`);
  } catch (error) {
    console.error('[SyncManager] Failed to delete run:', error);
    await indexedDb.pendingOperationsStore.add(pendingDelete);
  }
}

// ============================================================================
// PROMPT TEMPLATE SYNC
// ============================================================================

export async function savePromptTemplate(template: PromptTemplate): Promise<PromptTemplate> {
  await indexedDb.promptTemplateStore.save(template);
  const metadata = await createSyncMetadata(template.id, 'promptTemplate');
  await indexedDb.syncMetadataStore.save(metadata);

  if (getOnlineStatus()) {
    try {
      const result = await api.getPromptTemplate(template.id);
      const saved = result.success && result.data
        ? await api.updatePromptTemplate(template.id, template)
        : await api.createPromptTemplate({
            workspaceId: template.workspaceId,
            name: template.name,
            description: template.description,
            template: template.template,
            variables: template.variables,
            category: template.category,
            tags: template.tags,
            isPublic: template.isPublic,
          });

      if (saved.success && saved.data) {
        await updateSyncMetadata(template.id, 'promptTemplate', {
          isPending: false,
          serverVersion: metadata.localVersion,
          lastSyncedAt: new Date().toISOString(),
        });
        return saved.data;
      }
    } catch (error) {
      console.error('[SyncManager] Failed to sync prompt template:', error);
      await indexedDb.pendingOperationsStore.add({
        id: `pending_${Date.now()}`,
        resourceType: 'promptTemplate',
        operation: 'update',
        resourceId: template.id,
        data: template,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    }
  }

  return template;
}

// ============================================================================
// BATCH SYNC
// ============================================================================

export async function syncAll(options: SyncOptions = {}): Promise<SyncResult> {
  if (!getOnlineStatus() && !options.forceSync) {
    return {
      success: false,
      synced: 0,
      conflicts: 0,
      errors: ['Offline - sync skipped'],
    };
  }

  const result: SyncResult = {
    success: true,
    synced: 0,
    conflicts: 0,
    errors: [],
  };

  try {
    // Process pending operations queue
    const pending = await indexedDb.pendingOperationsStore.getAll();

    for (const operation of pending) {
      try {
        await processPendingOperation(operation);
        await indexedDb.pendingOperationsStore.remove(operation.id);
        result.synced++;
      } catch (error) {
        result.errors.push(
          `Failed to sync ${operation.resourceType} ${operation.resourceId}: ${error}`
        );

        // Increment retry count
        operation.retryCount++;
        if (operation.retryCount < 5) {
          await indexedDb.pendingOperationsStore.add(operation);
        } else {
          // Give up after 5 retries
          await indexedDb.pendingOperationsStore.remove(operation.id);
          result.errors.push(`Giving up on ${operation.resourceType} ${operation.resourceId} after 5 retries`);
        }
      }
    }

    // Resolve conflicts if requested
    if (options.resolveConflicts) {
      const conflicts = await indexedDb.conflictsStore.getAll();
      for (const conflict of conflicts.filter(c => !c.resolvedAt)) {
        try {
          await resolveConflict(conflict, options.strategy || 'server');
          result.conflicts++;
        } catch (error) {
          result.errors.push(`Failed to resolve conflict ${conflict.id}: ${error}`);
        }
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Sync failed: ${error}`);
  }

  return result;
}

async function processPendingOperation(operation: PendingOperation): Promise<void> {
  switch (operation.resourceType) {
    case 'workspace':
      if (operation.operation === 'update' && operation.data) {
        await api.updateWorkspace(operation.resourceId, operation.data as Workspace);
      } else if (operation.operation === 'delete') {
        await api.deleteWorkspace(operation.resourceId);
      }
      break;

    case 'contextBlock':
      if (operation.operation === 'update' && operation.data) {
        await api.updateContextBlock(operation.resourceId, operation.data as ContextBlock);
      } else if (operation.operation === 'delete') {
        await api.deleteContextBlock(operation.resourceId);
      }
      break;

    case 'run':
      if (operation.operation === 'update' && operation.data) {
        await api.updateRun(operation.resourceId, operation.data as Run);
      } else if (operation.operation === 'delete') {
        await api.deleteRun(operation.resourceId);
      }
      break;

    case 'promptTemplate':
      if (operation.operation === 'update' && operation.data) {
        await api.updatePromptTemplate(operation.resourceId, operation.data as PromptTemplate);
      } else if (operation.operation === 'delete') {
        await api.deletePromptTemplate(operation.resourceId);
      }
      break;
  }
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

async function resolveConflict(
  conflict: ConflictResolution,
  strategy: 'local' | 'server' | 'manual'
): Promise<void> {
  if (strategy === 'manual') {
    // Wait for user to resolve manually
    return;
  }

  const resolvedData = strategy === 'local' ? conflict.localData : conflict.serverData;

  // Update conflict with resolution
  await indexedDb.conflictsStore.resolve(conflict.id, {
    ...conflict,
    resolvedData,
    strategy,
  });

  // Apply resolution
  switch (conflict.resourceType) {
    case 'workspace':
      await indexedDb.workspaceStore.save(resolvedData as Workspace);
      break;
    case 'contextBlock':
      await indexedDb.contextBlockStore.save(resolvedData as ContextBlock);
      break;
    case 'run':
      await indexedDb.runStore.save(resolvedData as Run);
      break;
    case 'promptTemplate':
      await indexedDb.promptTemplateStore.save(resolvedData as PromptTemplate);
      break;
  }

  // Mark as resolved
  await updateSyncMetadata(conflict.resourceId, conflict.resourceType, {
    hasConflict: false,
  });
}

// ============================================================================
// EXPORT
// ============================================================================

export { getOnlineStatus as isOnline };
