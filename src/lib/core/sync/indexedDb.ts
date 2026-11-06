/**
 * VibeForge V2 - IndexedDB Offline Storage (VF-300)
 *
 * Offline-first storage layer with:
 * - Local IndexedDB cache for all resources
 * - Automatic sync with DataForge when online
 * - Conflict resolution (last-write-wins + manual merge)
 * - Optimistic updates with rollback
 * - Pending operations queue
 *
 * Phase 3 - Track A: Backend Persistence
 */

import type { Workspace, ContextBlock } from "$lib/core/types";
import type { Run, PromptTemplate } from "$lib/core/api/dataforgeClient.enhanced";

// ============================================================================
// TYPES
// ============================================================================

export interface SyncMetadata {
  id: string;
  resourceType: 'workspace' | 'contextBlock' | 'run' | 'promptTemplate';
  lastSyncedAt: string;
  localVersion: number;
  serverVersion: number;
  isPending: boolean;
  hasConflict: boolean;
}

export interface PendingOperation {
  id: string;
  resourceType: SyncMetadata['resourceType'];
  operation: 'create' | 'update' | 'delete';
  resourceId: string;
  data?: unknown;
  timestamp: string;
  retryCount: number;
}

export interface ConflictResolution {
  id: string;
  resourceType: SyncMetadata['resourceType'];
  resourceId: string;
  localData: unknown;
  serverData: unknown;
  resolvedData?: unknown;
  strategy: 'local' | 'server' | 'manual' | 'merged';
  resolvedAt?: string;
}

// ============================================================================
// IndexedDB Setup
// ============================================================================

const DB_NAME = 'vibeforge-offline';
const DB_VERSION = 1;

const STORES = {
  workspaces: 'workspaces',
  contextBlocks: 'contextBlocks',
  runs: 'runs',
  promptTemplates: 'promptTemplates',
  syncMetadata: 'syncMetadata',
  pendingOperations: 'pendingOperations',
  conflicts: 'conflicts',
};

let dbInstance: IDBDatabase | null = null;
let dbOpening: Promise<IDBDatabase> | null = null;

async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  // Share a single open request: callers arriving during the upgrade must not
  // start a second one, or their transactions race the versionchange.
  if (dbOpening) return dbOpening;

  dbOpening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      if (!db.objectStoreNames.contains(STORES.workspaces)) {
        db.createObjectStore(STORES.workspaces, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.contextBlocks)) {
        db.createObjectStore(STORES.contextBlocks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.runs)) {
        const runStore = db.createObjectStore(STORES.runs, { keyPath: 'id' });
        runStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        runStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.promptTemplates)) {
        const promptStore = db.createObjectStore(STORES.promptTemplates, { keyPath: 'id' });
        promptStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        promptStore.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.syncMetadata)) {
        const syncStore = db.createObjectStore(STORES.syncMetadata, { keyPath: 'id' });
        syncStore.createIndex('resourceType', 'resourceType', { unique: false });
        syncStore.createIndex('isPending', 'isPending', { unique: false });
        syncStore.createIndex('hasConflict', 'hasConflict', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.pendingOperations)) {
        const pendingStore = db.createObjectStore(STORES.pendingOperations, { keyPath: 'id' });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.conflicts)) {
        db.createObjectStore(STORES.conflicts, { keyPath: 'id' });
      }
    };
  });

  try {
    return await dbOpening;
  } finally {
    dbOpening = null;
  }
}

/**
 * Close the cached connection and drop it from the cache.
 *
 * Use this instead of calling close() on the connection openDatabase() returns:
 * that connection is shared, and a closed one left in the cache makes every
 * later transaction fail with InvalidStateError.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbOpening = null;
}

// ============================================================================
// GENERIC CRUD OPERATIONS
// ============================================================================

async function get<T>(storeName: string, id: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, data: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function query<T>(
  storeName: string,
  indexName: string,
  value: string | number
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// RESOURCE-SPECIFIC OPERATIONS
// ============================================================================

export const workspaceStore = {
  async get(id: string): Promise<Workspace | null> {
    return get<Workspace>(STORES.workspaces, id);
  },
  async getAll(): Promise<Workspace[]> {
    return getAll<Workspace>(STORES.workspaces);
  },
  async save(workspace: Workspace): Promise<void> {
    await put(STORES.workspaces, workspace);
  },
  async delete(id: string): Promise<void> {
    await remove(STORES.workspaces, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.workspaces);
  },
};

export const contextBlockStore = {
  async get(id: string): Promise<ContextBlock | null> {
    return get<ContextBlock>(STORES.contextBlocks, id);
  },
  async getAll(): Promise<ContextBlock[]> {
    return getAll<ContextBlock>(STORES.contextBlocks);
  },
  async save(block: ContextBlock): Promise<void> {
    await put(STORES.contextBlocks, block);
  },
  async delete(id: string): Promise<void> {
    await remove(STORES.contextBlocks, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.contextBlocks);
  },
};

export const runStore = {
  async get(id: string): Promise<Run | null> {
    return get<Run>(STORES.runs, id);
  },
  async getAll(): Promise<Run[]> {
    return getAll<Run>(STORES.runs);
  },
  async getByWorkspace(workspaceId: string): Promise<Run[]> {
    return query<Run>(STORES.runs, 'workspaceId', workspaceId);
  },
  async save(run: Run): Promise<void> {
    await put(STORES.runs, run);
  },
  async delete(id: string): Promise<void> {
    await remove(STORES.runs, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.runs);
  },
};

export const promptTemplateStore = {
  async get(id: string): Promise<PromptTemplate | null> {
    return get<PromptTemplate>(STORES.promptTemplates, id);
  },
  async getAll(): Promise<PromptTemplate[]> {
    return getAll<PromptTemplate>(STORES.promptTemplates);
  },
  async getByWorkspace(workspaceId: string): Promise<PromptTemplate[]> {
    return query<PromptTemplate>(STORES.promptTemplates, 'workspaceId', workspaceId);
  },
  async getByCategory(category: string): Promise<PromptTemplate[]> {
    return query<PromptTemplate>(STORES.promptTemplates, 'category', category);
  },
  async save(template: PromptTemplate): Promise<void> {
    await put(STORES.promptTemplates, template);
  },
  async delete(id: string): Promise<void> {
    await remove(STORES.promptTemplates, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.promptTemplates);
  },
};

// ============================================================================
// SYNC METADATA OPERATIONS
// ============================================================================

export const syncMetadataStore = {
  async get(id: string): Promise<SyncMetadata | null> {
    return get<SyncMetadata>(STORES.syncMetadata, id);
  },
  async save(metadata: SyncMetadata): Promise<void> {
    await put(STORES.syncMetadata, metadata);
  },
  async getPending(): Promise<SyncMetadata[]> {
    // A boolean is not a valid IndexedDB key, so the isPending index never
    // holds these records. Filter the (local-cache sized) collection instead.
    const all = await getAll<SyncMetadata>(STORES.syncMetadata);
    return all.filter((metadata) => metadata.isPending);
  },
  async getConflicts(): Promise<SyncMetadata[]> {
    const all = await getAll<SyncMetadata>(STORES.syncMetadata);
    return all.filter((metadata) => metadata.hasConflict);
  },
  async getByResourceType(
    resourceType: SyncMetadata['resourceType']
  ): Promise<SyncMetadata[]> {
    return query<SyncMetadata>(STORES.syncMetadata, 'resourceType', resourceType);
  },
  async delete(id: string): Promise<void> {
    await remove(STORES.syncMetadata, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.syncMetadata);
  },
};

// ============================================================================
// PENDING OPERATIONS QUEUE
// ============================================================================

export const pendingOperationsStore = {
  async add(operation: PendingOperation): Promise<void> {
    await put(STORES.pendingOperations, operation);
  },
  async get(id: string): Promise<PendingOperation | null> {
    return get<PendingOperation>(STORES.pendingOperations, id);
  },
  async getAll(): Promise<PendingOperation[]> {
    const ops = await getAll<PendingOperation>(STORES.pendingOperations);
    // Sort by timestamp (oldest first)
    return ops.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },
  async remove(id: string): Promise<void> {
    await remove(STORES.pendingOperations, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.pendingOperations);
  },
};

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

export const conflictsStore = {
  async add(conflict: ConflictResolution): Promise<void> {
    await put(STORES.conflicts, conflict);
  },
  async save(conflict: ConflictResolution): Promise<void> {
    await put(STORES.conflicts, conflict);
  },
  async get(id: string): Promise<ConflictResolution | null> {
    return get<ConflictResolution>(STORES.conflicts, id);
  },
  async getAll(): Promise<ConflictResolution[]> {
    return getAll<ConflictResolution>(STORES.conflicts);
  },
  async getUnresolved(): Promise<ConflictResolution[]> {
    const all = await getAll<ConflictResolution>(STORES.conflicts);
    return all.filter((c) => !c.resolvedAt);
  },
  async resolve(id: string, resolution: ConflictResolution): Promise<void> {
    await put(STORES.conflicts, {
      ...resolution,
      resolvedAt: new Date().toISOString(),
    });
  },
  async remove(id: string): Promise<void> {
    await remove(STORES.conflicts, id);
  },
  async delete(id: string): Promise<void> {
    await remove(STORES.conflicts, id);
  },
  async clear(): Promise<void> {
    await clear(STORES.conflicts);
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export async function clearAllData(): Promise<void> {
  await workspaceStore.clear();
  await contextBlockStore.clear();
  await runStore.clear();
  await promptTemplateStore.clear();
  await syncMetadataStore.clear();
  await pendingOperationsStore.clear();
  await conflictsStore.clear();
}

export async function getDatabaseStats(): Promise<{
  workspaces: number;
  contextBlocks: number;
  runs: number;
  promptTemplates: number;
  pending: number;
  conflicts: number;
}> {
  const [workspaces, contextBlocks, runs, promptTemplates, pending, conflicts] = await Promise.all([
    workspaceStore.getAll(),
    contextBlockStore.getAll(),
    runStore.getAll(),
    promptTemplateStore.getAll(),
    syncMetadataStore.getPending(),
    syncMetadataStore.getConflicts(),
  ]);

  return {
    workspaces: workspaces.length,
    contextBlocks: contextBlocks.length,
    runs: runs.length,
    promptTemplates: promptTemplates.length,
    pending: pending.length,
    conflicts: conflicts.length,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export { openDatabase };
