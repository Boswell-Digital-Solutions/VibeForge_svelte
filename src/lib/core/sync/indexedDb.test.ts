/**
 * VF-300: IndexedDB Offline Storage Tests
 *
 * Test coverage for:
 * - Database initialization and schema
 * - CRUD operations for all stores
 * - Indexed queries
 * - Sync metadata tracking
 * - Pending operations queue
 * - Conflict storage
 * - Database statistics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	openDatabase,
	workspaceStore,
	contextBlockStore,
	runStore,
	promptTemplateStore,
	syncMetadataStore,
	pendingOperationsStore,
	conflictsStore,
	clearAllData,
	closeDatabase,
	getDatabaseStats,
	type SyncMetadata,
	type PendingOperation,
	type ConflictResolution,
} from './indexedDb';
import type { Workspace, ContextBlock } from '../types';
import type { Run, PromptTemplate } from '../api/dataforgeClient.enhanced';

describe('IndexedDB Offline Storage', () => {
	beforeEach(async () => {
		// Clear all data before each test
		await clearAllData();
	});

	afterEach(async () => {
		// Cleanup after each test
		await clearAllData();
	});

	describe('Database Initialization', () => {
		it('should open database successfully', async () => {
			const db = await openDatabase();
			expect(db).toBeDefined();
			expect(db.name).toBe('vibeforge-offline');
			closeDatabase();
		});

		it('should create all 7 object stores', async () => {
			const db = await openDatabase();

			const storeNames = [
				'workspaces',
				'contextBlocks',
				'runs',
				'promptTemplates',
				'syncMetadata',
				'pendingOperations',
				'conflicts',
			];

			for (const storeName of storeNames) {
				expect(db.objectStoreNames.contains(storeName)).toBe(true);
			}

			closeDatabase();
		});

		it('should create indexes for runs store', async () => {
			const db = await openDatabase();
			const transaction = db.transaction('runs', 'readonly');
			const store = transaction.objectStore('runs');

			expect(store.indexNames.contains('workspaceId')).toBe(true);
			expect(store.indexNames.contains('createdAt')).toBe(true);

			closeDatabase();
		});

		it('should create indexes for syncMetadata store', async () => {
			const db = await openDatabase();
			const transaction = db.transaction('syncMetadata', 'readonly');
			const store = transaction.objectStore('syncMetadata');

			expect(store.indexNames.contains('resourceType')).toBe(true);
			expect(store.indexNames.contains('isPending')).toBe(true);
			expect(store.indexNames.contains('hasConflict')).toBe(true);

			closeDatabase();
		});
	});

	describe('Workspace Store CRUD', () => {
		const mockWorkspace: Workspace = {
			id: 'ws-1',
			name: 'Test Workspace',
			description: 'Test description',
			settings: { theme: 'dark', autoSave: true },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		it('should save workspace', async () => {
			await workspaceStore.save(mockWorkspace);

			const retrieved = await workspaceStore.get(mockWorkspace.id);
			expect(retrieved).toEqual(mockWorkspace);
		});

		it('should get workspace by id', async () => {
			await workspaceStore.save(mockWorkspace);

			const retrieved = await workspaceStore.get(mockWorkspace.id);
			expect(retrieved?.id).toBe(mockWorkspace.id);
		});

		it('should return null for nonexistent workspace', async () => {
			const retrieved = await workspaceStore.get('nonexistent');
			expect(retrieved).toBeNull();
		});

		it('should get all workspaces', async () => {
			const ws1 = { ...mockWorkspace, id: 'ws-1' };
			const ws2 = { ...mockWorkspace, id: 'ws-2', name: 'Workspace 2' };

			await workspaceStore.save(ws1);
			await workspaceStore.save(ws2);

			const all = await workspaceStore.getAll();
			expect(all).toHaveLength(2);
			expect(all.map((w) => w.id)).toContain('ws-1');
			expect(all.map((w) => w.id)).toContain('ws-2');
		});

		it('should update workspace', async () => {
			await workspaceStore.save(mockWorkspace);

			const updated = { ...mockWorkspace, name: 'Updated Name' };
			await workspaceStore.save(updated);

			const retrieved = await workspaceStore.get(mockWorkspace.id);
			expect(retrieved?.name).toBe('Updated Name');
		});

		it('should delete workspace', async () => {
			await workspaceStore.save(mockWorkspace);
			await workspaceStore.delete(mockWorkspace.id);

			const retrieved = await workspaceStore.get(mockWorkspace.id);
			expect(retrieved).toBeNull();
		});

		it('should clear all workspaces', async () => {
			await workspaceStore.save(mockWorkspace);
			await workspaceStore.clear();

			const all = await workspaceStore.getAll();
			expect(all).toHaveLength(0);
		});
	});

	describe('Context Block Store CRUD', () => {
		const mockBlock: ContextBlock = {
			id: 'block-1',
			title: 'Test Block',
			kind: 'project',
			content: 'Test content',
			description: 'Test block',
			tags: ['general'],
			isActive: true,
			source: 'workspace',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		it('should save context block', async () => {
			await contextBlockStore.save(mockBlock);

			const retrieved = await contextBlockStore.get(mockBlock.id);
			expect(retrieved).toEqual(mockBlock);
		});

		it('should get all context blocks', async () => {
			const block1 = { ...mockBlock, id: 'block-1' };
			const block2 = { ...mockBlock, id: 'block-2' };

			await contextBlockStore.save(block1);
			await contextBlockStore.save(block2);

			const all = await contextBlockStore.getAll();
			expect(all).toHaveLength(2);
		});

		it('should delete context block', async () => {
			await contextBlockStore.save(mockBlock);
			await contextBlockStore.delete(mockBlock.id);

			const retrieved = await contextBlockStore.get(mockBlock.id);
			expect(retrieved).toBeNull();
		});
	});

	describe('Run Store CRUD', () => {
		const mockRun: Run = {
			id: 'run-1',
			workspaceId: 'ws-1',
			promptText: 'Test prompt',
			contextBlockIds: [],
			model: 'claude-3.5-sonnet',
			provider: 'anthropic',
			output: 'Test response',
			tokensUsed: 100,
			cost: 0.01,
			latencyMs: 1200,
			status: 'completed',
			createdAt: new Date().toISOString(),
		};

		it('should save run', async () => {
			await runStore.save(mockRun);

			const retrieved = await runStore.get(mockRun.id);
			expect(retrieved).toEqual(mockRun);
		});

		it('should get runs by workspace', async () => {
			const run1 = { ...mockRun, id: 'run-1', workspaceId: 'ws-1' };
			const run2 = { ...mockRun, id: 'run-2', workspaceId: 'ws-1' };
			const run3 = { ...mockRun, id: 'run-3', workspaceId: 'ws-2' };

			await runStore.save(run1);
			await runStore.save(run2);
			await runStore.save(run3);

			const ws1Runs = await runStore.getByWorkspace('ws-1');
			expect(ws1Runs).toHaveLength(2);
			expect(ws1Runs.map((r) => r.id)).toContain('run-1');
			expect(ws1Runs.map((r) => r.id)).toContain('run-2');
		});

		it('should get all runs', async () => {
			await runStore.save(mockRun);

			const all = await runStore.getAll();
			expect(all).toHaveLength(1);
		});

		it('should delete run', async () => {
			await runStore.save(mockRun);
			await runStore.delete(mockRun.id);

			const retrieved = await runStore.get(mockRun.id);
			expect(retrieved).toBeNull();
		});

		it('should clear all runs', async () => {
			await runStore.save(mockRun);
			await runStore.clear();

			const all = await runStore.getAll();
			expect(all).toHaveLength(0);
		});
	});

	describe('Prompt Template Store CRUD', () => {
		const mockTemplate: PromptTemplate = {
			id: 'template-1',
			workspaceId: 'ws-1',
			name: 'Test Template',
			description: 'Greets by name',
			template: 'Hello {name}',
			variables: ['name'],
			category: 'greeting',
			tags: ['greeting'],
			isPublic: false,
			createdBy: 'user-1',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		it('should save prompt template', async () => {
			await promptTemplateStore.save(mockTemplate);

			const retrieved = await promptTemplateStore.get(mockTemplate.id);
			expect(retrieved).toEqual(mockTemplate);
		});

		it('should get all prompt templates', async () => {
			await promptTemplateStore.save(mockTemplate);

			const all = await promptTemplateStore.getAll();
			expect(all).toHaveLength(1);
		});

		it('should delete prompt template', async () => {
			await promptTemplateStore.save(mockTemplate);
			await promptTemplateStore.delete(mockTemplate.id);

			const retrieved = await promptTemplateStore.get(mockTemplate.id);
			expect(retrieved).toBeNull();
		});
	});

	describe('Sync Metadata Store', () => {
		const mockMetadata: SyncMetadata = {
			id: 'ws-1',
			resourceType: 'workspace',
			localVersion: 1,
			serverVersion: 1,
			lastSyncedAt: new Date().toISOString(),
			isPending: false,
			hasConflict: false,
		};

		it('should save sync metadata', async () => {
			await syncMetadataStore.save(mockMetadata);

			const retrieved = await syncMetadataStore.get(mockMetadata.id);
			expect(retrieved).toEqual(mockMetadata);
		});

		it('should get pending resources', async () => {
			const pending1 = { ...mockMetadata, id: 'ws-1', isPending: true };
			const pending2 = { ...mockMetadata, id: 'ws-2', isPending: true };
			const synced = { ...mockMetadata, id: 'ws-3', isPending: false };

			await syncMetadataStore.save(pending1);
			await syncMetadataStore.save(pending2);
			await syncMetadataStore.save(synced);

			const pending = await syncMetadataStore.getPending();
			expect(pending).toHaveLength(2);
			expect(pending.map((p) => p.id)).toContain('ws-1');
			expect(pending.map((p) => p.id)).toContain('ws-2');
		});

		it('should get resources with conflicts', async () => {
			const conflict1 = { ...mockMetadata, id: 'ws-1', hasConflict: true };
			const conflict2 = { ...mockMetadata, id: 'ws-2', hasConflict: true };
			const noConflict = { ...mockMetadata, id: 'ws-3', hasConflict: false };

			await syncMetadataStore.save(conflict1);
			await syncMetadataStore.save(conflict2);
			await syncMetadataStore.save(noConflict);

			const conflicts = await syncMetadataStore.getConflicts();
			expect(conflicts).toHaveLength(2);
		});

		it('should get metadata by resource type', async () => {
			const workspace = { ...mockMetadata, id: 'ws-1', resourceType: 'workspace' as const };
			const run = { ...mockMetadata, id: 'run-1', resourceType: 'run' as const };

			await syncMetadataStore.save(workspace);
			await syncMetadataStore.save(run);

			const workspaces = await syncMetadataStore.getByResourceType('workspace');
			expect(workspaces).toHaveLength(1);
			expect(workspaces[0].id).toBe('ws-1');
		});

		it('should update sync metadata', async () => {
			await syncMetadataStore.save(mockMetadata);

			const updated = { ...mockMetadata, serverVersion: 2 };
			await syncMetadataStore.save(updated);

			const retrieved = await syncMetadataStore.get(mockMetadata.id);
			expect(retrieved?.serverVersion).toBe(2);
		});

		it('should delete sync metadata', async () => {
			await syncMetadataStore.save(mockMetadata);
			await syncMetadataStore.delete(mockMetadata.id);

			const retrieved = await syncMetadataStore.get(mockMetadata.id);
			expect(retrieved).toBeNull();
		});
	});

	describe('Pending Operations Store', () => {
		const mockOperation: PendingOperation = {
			id: 'op-1',
			resourceType: 'workspace',
			operation: 'update',
			resourceId: 'ws-1',
			data: { name: 'Updated' },
			timestamp: new Date().toISOString(),
			retryCount: 0,
		};

		it('should add pending operation', async () => {
			await pendingOperationsStore.add(mockOperation);

			const retrieved = await pendingOperationsStore.get(mockOperation.id);
			expect(retrieved).toEqual(mockOperation);
		});

		it('should get all pending operations', async () => {
			const op1 = { ...mockOperation, id: 'op-1' };
			const op2 = { ...mockOperation, id: 'op-2' };

			await pendingOperationsStore.add(op1);
			await pendingOperationsStore.add(op2);

			const all = await pendingOperationsStore.getAll();
			expect(all).toHaveLength(2);
		});

		it('should get pending operations sorted by timestamp', async () => {
			const now = Date.now();
			const op1 = { ...mockOperation, id: 'op-1', timestamp: new Date(now).toISOString() };
			const op2 = { ...mockOperation, id: 'op-2', timestamp: new Date(now + 1000).toISOString() };

			await pendingOperationsStore.add(op2);
			await pendingOperationsStore.add(op1);

			const all = await pendingOperationsStore.getAll();
			expect(all[0].id).toBe('op-1'); // Oldest first
			expect(all[1].id).toBe('op-2');
		});

		it('should remove pending operation', async () => {
			await pendingOperationsStore.add(mockOperation);
			await pendingOperationsStore.remove(mockOperation.id);

			const retrieved = await pendingOperationsStore.get(mockOperation.id);
			expect(retrieved).toBeNull();
		});

		it('should clear all pending operations', async () => {
			await pendingOperationsStore.add(mockOperation);
			await pendingOperationsStore.clear();

			const all = await pendingOperationsStore.getAll();
			expect(all).toHaveLength(0);
		});
	});

	describe('Conflicts Store', () => {
		const mockConflict: ConflictResolution = {
			id: 'conflict-1',
			resourceType: 'workspace',
			resourceId: 'ws-1',
			localData: { name: 'Local Name' },
			serverData: { name: 'Server Name' },
			strategy: 'manual',
		};

		it('should save conflict', async () => {
			await conflictsStore.save(mockConflict);

			const retrieved = await conflictsStore.get(mockConflict.id);
			expect(retrieved).toEqual(mockConflict);
		});

		it('should get all conflicts', async () => {
			const conflict1 = { ...mockConflict, id: 'conflict-1' };
			const conflict2 = { ...mockConflict, id: 'conflict-2' };

			await conflictsStore.save(conflict1);
			await conflictsStore.save(conflict2);

			const all = await conflictsStore.getAll();
			expect(all).toHaveLength(2);
		});

		it('should get unresolved conflicts', async () => {
			const unresolved = { ...mockConflict, id: 'conflict-1' };
			const resolved = {
				...mockConflict,
				id: 'conflict-2',
				resolvedAt: new Date().toISOString(),
			};

			await conflictsStore.save(unresolved);
			await conflictsStore.save(resolved);

			const unresolvedConflicts = await conflictsStore.getUnresolved();
			expect(unresolvedConflicts).toHaveLength(1);
			expect(unresolvedConflicts[0].id).toBe('conflict-1');
		});

		it('should mark conflict as resolved', async () => {
			await conflictsStore.save(mockConflict);

			const updated = {
				...mockConflict,
				resolvedAt: new Date().toISOString(),
			};
			await conflictsStore.save(updated);

			const retrieved = await conflictsStore.get(mockConflict.id);
			expect(retrieved?.resolvedAt).toBeDefined();
		});

		it('should delete conflict', async () => {
			await conflictsStore.save(mockConflict);
			await conflictsStore.delete(mockConflict.id);

			const retrieved = await conflictsStore.get(mockConflict.id);
			expect(retrieved).toBeNull();
		});
	});

	describe('Database Statistics', () => {
		it('should get database statistics', async () => {
			// Add some data
			await workspaceStore.save({
				id: 'ws-1',
				name: 'Test',
				description: 'Test',
				settings: { theme: 'dark', autoSave: true },
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			await runStore.save({
				id: 'run-1',
				workspaceId: 'ws-1',
				promptText: 'Test',
				contextBlockIds: [],
				model: 'claude-3.5-sonnet',
				provider: 'anthropic',
				output: 'Test',
				tokensUsed: 100,
				cost: 0.01,
				latencyMs: 1200,
				status: 'completed',
				createdAt: new Date().toISOString(),
			});

			await syncMetadataStore.save({
				id: 'ws-1',
				resourceType: 'workspace',
				localVersion: 1,
				serverVersion: 1,
				lastSyncedAt: new Date().toISOString(),
				isPending: true,
				hasConflict: false,
			});

			const stats = await getDatabaseStats();

			expect(stats.workspaces).toBe(1);
			expect(stats.runs).toBe(1);
			expect(stats.pending).toBe(1);
			expect(stats.conflicts).toBe(0);
		});

		it('should return zero counts for empty database', async () => {
			const stats = await getDatabaseStats();

			expect(stats.workspaces).toBe(0);
			expect(stats.contextBlocks).toBe(0);
			expect(stats.runs).toBe(0);
			expect(stats.promptTemplates).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.conflicts).toBe(0);
		});
	});

	describe('Clear All Data', () => {
		it('should clear all data from all stores', async () => {
			// Add data to multiple stores
			await workspaceStore.save({
				id: 'ws-1',
				name: 'Test',
				description: 'Test',
				settings: { theme: 'dark', autoSave: true },
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			await runStore.save({
				id: 'run-1',
				workspaceId: 'ws-1',
				promptText: 'Test',
				contextBlockIds: [],
				model: 'claude-3.5-sonnet',
				provider: 'anthropic',
				output: 'Test',
				tokensUsed: 100,
				cost: 0.01,
				latencyMs: 1200,
				status: 'completed',
				createdAt: new Date().toISOString(),
			});

			await pendingOperationsStore.add({
				id: 'op-1',
				resourceType: 'workspace',
				operation: 'update',
				resourceId: 'ws-1',
				data: {},
				timestamp: new Date().toISOString(),
				retryCount: 0,
			});

			// Clear all
			await clearAllData();

			// Verify all stores are empty
			const stats = await getDatabaseStats();
			expect(stats.workspaces).toBe(0);
			expect(stats.runs).toBe(0);
			expect(stats.pending).toBe(0);
		});
	});
});
