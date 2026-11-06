/**
 * VF-300: DataForge Enhanced HTTP Client Tests
 *
 * Test coverage for:
 * - HTTP retry logic with exponential backoff
 * - Timeout handling
 * - Auth token headers
 * - CRUD operations for all resources
 * - Batch operations
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from './dataforgeClient.enhanced';

// Mock fetch globally
global.fetch = vi.fn();

describe('DataForge Enhanced HTTP Client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Clear localStorage
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Retry Logic', () => {
		it('should retry on 500 error with exponential backoff', async () => {
			const mockFetch = vi.mocked(fetch);

			// First call fails with 500
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ detail: 'Internal Server Error' }),
			} as Response);

			// Second call succeeds
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: [], total: 0, page: 1, page_size: 100 }),
			} as Response);

			await api.listWorkspaces();

			// Should have retried once
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should retry on 502/503/504 errors', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				json: async () => ({ detail: 'Service Unavailable' }),
			} as Response);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: [], total: 0, page: 1, page_size: 100 }),
			} as Response);

			await api.listWorkspaces();

			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should retry on 429 (rate limit) error', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				json: async () => ({ detail: 'Too Many Requests' }),
			} as Response);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: [], total: 0, page: 1, page_size: 100 }),
			} as Response);

			await api.listWorkspaces();

			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should not retry on 400 error', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ detail: 'Bad Request' }),
			} as Response);

			await expect(api.listWorkspaces()).rejects.toThrow('Bad Request');

			// Should NOT have retried
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should not retry on 404 error', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ detail: 'Not Found' }),
			} as Response);

			await expect(api.getWorkspace('nonexistent-id')).rejects.toThrow('Not Found');

			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should stop retrying after max retries (3)', async () => {
			vi.useFakeTimers();
			const mockFetch = vi.mocked(fetch);

			// Fail all attempts
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				json: async () => ({ detail: 'Internal Server Error' }),
			} as Response);

			const assertion = expect(api.listWorkspaces()).rejects.toThrow(
				'Internal Server Error'
			);
			await vi.runAllTimersAsync();
			await assertion;

			// Should have tried 4 times total (1 initial + 3 retries)
			expect(mockFetch).toHaveBeenCalledTimes(4);
			vi.useRealTimers();
		});

		it('should use exponential backoff delays', async () => {
			vi.useFakeTimers();
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				json: async () => ({ detail: 'Internal Server Error' }),
			} as Response);

			const promise = api.listWorkspaces().catch(() => {});

			// First call immediate
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Wait 1s, second call
			await vi.advanceTimersByTimeAsync(1000);
			expect(mockFetch).toHaveBeenCalledTimes(2);

			// Wait 2s, third call
			await vi.advanceTimersByTimeAsync(2000);
			expect(mockFetch).toHaveBeenCalledTimes(3);

			// Wait 4s, fourth call
			await vi.advanceTimersByTimeAsync(4000);
			expect(mockFetch).toHaveBeenCalledTimes(4);

			await promise;
			vi.useRealTimers();
		});
	});

	describe('Timeout Handling', () => {
		it('should abort request after timeout (10s default)', async () => {
			vi.useFakeTimers();
			const mockFetch = vi.mocked(fetch);

			// Mock a request that hangs until its signal aborts, as fetch does.
			mockFetch.mockImplementation(
				(_url, init) =>
					new Promise((_resolve, reject) => {
						(init as RequestInit | undefined)?.signal?.addEventListener(
							'abort',
							() => {
								const abortError = new Error('Aborted');
								abortError.name = 'AbortError';
								reject(abortError);
							}
						);
					})
			);

			const promise = api.listWorkspaces().catch((e) => e);

			// Drain the timeout and every retry backoff it schedules.
			await vi.runAllTimersAsync();

			const error = await promise;
			expect(error).toBeDefined();

			vi.useRealTimers();
		});
	});

	describe('Auth Token Headers', () => {
		it('should include JWT token in Authorization header', async () => {
			const mockFetch = vi.mocked(fetch);
			localStorage.setItem('vibeforge:auth:token', 'test-jwt-token');

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: [], total: 0, page: 1, page_size: 100 }),
			} as Response);

			await api.listWorkspaces();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Bearer test-jwt-token',
					}),
				})
			);
		});

		it('should work without token if not authenticated', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: [], total: 0, page: 1, page_size: 100 }),
			} as Response);

			await api.listWorkspaces();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.not.objectContaining({
						Authorization: expect.anything(),
					}),
				})
			);
		});
	});

	describe('Workspace CRUD Operations', () => {
		it('should list workspaces', async () => {
			const mockFetch = vi.mocked(fetch);
			const mockWorkspaces = [
				{ id: '1', name: 'Workspace 1', description: 'Test', settings: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: mockWorkspaces, total: 1, page: 1, page_size: 100 }),
			} as Response);

			const result = await api.listWorkspaces();

			// The workspace endpoints resolve the parsed body, not an ApiResponse.
			expect(result).toEqual({ results: mockWorkspaces, total: 1, page: 1, page_size: 100 });
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/workspaces'),
				expect.objectContaining({ method: 'GET' })
			);
		});

		it('should get workspace by id', async () => {
			const mockFetch = vi.mocked(fetch);
			const mockWorkspace = { id: '1', name: 'Workspace 1', description: 'Test', settings: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockWorkspace,
			} as Response);

			const result = await api.getWorkspace('1');

			expect(result).toEqual(mockWorkspace);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/workspaces/1'),
				expect.objectContaining({ method: 'GET' })
			);
		});

		it('should create workspace', async () => {
			const mockFetch = vi.mocked(fetch);
			const newWorkspace = {
				name: 'New Workspace',
				description: 'Test',
				settings: { theme: 'dark' as const, autoSave: true },
			};
			const createdWorkspace = { ...newWorkspace, id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => createdWorkspace,
			} as Response);

			const result = await api.createWorkspace(newWorkspace);

			expect(result).toEqual(createdWorkspace);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/workspaces'),
				expect.objectContaining({ method: 'POST', body: JSON.stringify(newWorkspace) })
			);
		});

		it('should update workspace', async () => {
			const mockFetch = vi.mocked(fetch);
			const updates = { name: 'Updated Name' };
			const updatedWorkspace = { id: '1', name: 'Updated Name', description: 'Test', settings: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => updatedWorkspace,
			} as Response);

			const result = await api.updateWorkspace('1', updates);

			expect(result).toEqual(updatedWorkspace);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/workspaces/1'),
				expect.objectContaining({ method: 'PATCH', body: JSON.stringify(updates) })
			);
		});

		it('should delete workspace', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: async () => ({}),
			} as Response);

			await api.deleteWorkspace('1');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/workspaces/1'),
				expect.objectContaining({ method: 'DELETE' })
			);
		});
	});

	describe('Run CRUD Operations', () => {
		it('should list runs', async () => {
			const mockFetch = vi.mocked(fetch);
			const mockRuns = [
				{
					id: '1',
					workspace_id: 'ws-1',
					model: 'claude-3.5-sonnet',
					prompt: 'Test prompt',
					response: 'Test response',
					total_tokens: 100,
					cost: 0.01,
					created_at: new Date().toISOString(),
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ results: mockRuns, total: 1, page: 1, page_size: 100 }),
			} as Response);

			const result = await api.listRuns('ws-1');

			expect(result.data).toEqual({ results: mockRuns, total: 1, page: 1, page_size: 100 });
		});

		it('should create run', async () => {
			const mockFetch = vi.mocked(fetch);
			const newRun = {
				workspaceId: 'ws-1',
				promptText: 'Test prompt',
				contextBlockIds: [],
				model: 'claude-3.5-sonnet',
				provider: 'anthropic',
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({ ...newRun, id: '1', created_at: new Date().toISOString() }),
			} as Response);

			const result = await api.createRun(newRun);

			expect(result.data!.id).toBe('1');
		});

		it('should search runs with filters', async () => {
			const mockFetch = vi.mocked(fetch);
			const searchRequest = {
				workspaceId: 'ws-1',
				model: 'claude-3.5-sonnet',
				minCost: 0.01,
				maxCost: 1.0,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [],
			} as Response);

			await api.searchRuns(searchRequest);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/runs/search'),
				expect.objectContaining({ method: 'POST' })
			);
		});

		it('should update run', async () => {
			const mockFetch = vi.mocked(fetch);
			const updates = { output: 'Updated response' };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ id: '1', ...updates }),
			} as Response);

			const result = await api.updateRun('1', updates);

			expect(result.data!.output).toBe('Updated response');
		});

		it('should delete run', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: async () => ({}),
			} as Response);

			const result = await api.deleteRun('1');

			expect(result.success).toBe(true);
		});
	});

	describe('Context Block CRUD Operations', () => {
		it('should list context blocks', async () => {
			const mockFetch = vi.mocked(fetch);
			const mockBlocks = [
				{
					id: '1',
					workspace_id: 'ws-1',
					title: 'Test Block',
					content: 'Test content',
					category: 'general',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					items: mockBlocks,
					total: 1,
					page: 1,
					pageSize: 100,
					hasMore: false,
				}),
			} as Response);

			const result = await api.listContextBlocks('ws-1');

			expect(result.data!.items).toEqual(mockBlocks);
		});

		it('should create context block', async () => {
			const mockFetch = vi.mocked(fetch);
			const newBlock = {
				title: 'New Block',
				kind: 'project' as const,
				content: 'Content',
				description: 'Test block',
				tags: ['general'],
				isActive: true,
				source: 'workspace' as const,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({ ...newBlock, id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
			} as Response);

			const result = await api.createContextBlock(newBlock);

			expect(result.data!.id).toBe('1');
		});

		it('should search context blocks', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [],
			} as Response);

			await api.searchContextBlocks({ query: 'test', workspaceId: 'ws-1' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/context-blocks/search'),
				expect.objectContaining({ method: 'POST' })
			);
		});
	});

	describe('Prompt Template CRUD Operations', () => {
		it('should list prompt templates', async () => {
			const mockFetch = vi.mocked(fetch);
			const mockTemplates = [
				{
					id: '1',
					workspace_id: 'ws-1',
					name: 'Test Template',
					template: 'Hello {name}',
					category: 'greeting',
					variables: ['name'],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					items: mockTemplates,
					total: 1,
					page: 1,
					pageSize: 100,
					hasMore: false,
				}),
			} as Response);

			const result = await api.listPromptTemplates('ws-1');

			expect(result.data!.items).toEqual(mockTemplates);
		});

		it('should create prompt template', async () => {
			const mockFetch = vi.mocked(fetch);
			const newTemplate = {
				workspaceId: 'ws-1',
				name: 'New Template',
				description: 'Greets by name',
				template: 'Hello {name}',
				variables: ['name'],
				category: 'greeting',
				tags: ['greeting'],
				isPublic: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({ ...newTemplate, id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
			} as Response);

			const result = await api.createPromptTemplate(newTemplate);

			expect(result.data!.id).toBe('1');
		});

		it('should update prompt template', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ id: '1', name: 'Updated Template' }),
			} as Response);

			const result = await api.updatePromptTemplate('1', { name: 'Updated Template' });

			expect(result.data!.name).toBe('Updated Template');
		});

		it('should delete prompt template', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 204,
				json: async () => ({}),
			} as Response);

			const result = await api.deletePromptTemplate('1');

			expect(result.success).toBe(true);
		});
	});

	describe('Batch Operations', () => {
		it('should batch update context blocks', async () => {
			const mockFetch = vi.mocked(fetch);
			const operations = [
				{ operation: 'update' as const, id: '1', data: { title: 'Updated 1' } },
				{ operation: 'update' as const, id: '2', data: { title: 'Updated 2' } },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [
					{ success: true, data: { id: '1', title: 'Updated 1' } },
					{ success: true, data: { id: '2', title: 'Updated 2' } },
				],
			} as Response);

			const result = await api.batchUpdateContextBlocks(operations);

			expect(result).toHaveLength(2);
			expect(result[0].success).toBe(true);
		});

		it('should batch update runs', async () => {
			const mockFetch = vi.mocked(fetch);
			const operations = [
				{ operation: 'update' as const, id: '1', data: { output: 'Updated 1' } },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [
					{ success: true, data: { id: '1', response: 'Updated 1' } },
				],
			} as Response);

			const result = await api.batchUpdateRuns(operations);

			expect(result).toHaveLength(1);
		});

		it('should batch update prompt templates', async () => {
			const mockFetch = vi.mocked(fetch);
			const operations = [
				{ operation: 'update' as const, id: '1', data: { name: 'Updated Template' } },
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => [
					{ success: true, data: { id: '1', name: 'Updated Template' } },
				],
			} as Response);

			const result = await api.batchUpdatePromptTemplates(operations);

			expect(result).toHaveLength(1);
		});
	});

	describe('Error Handling', () => {
		it('should throw error with detail message', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ detail: 'Validation failed' }),
			} as Response);

			await expect(api.listWorkspaces()).rejects.toThrow('Validation failed');
		});

		it('should throw generic error if no detail', async () => {
			vi.useFakeTimers();
			const mockFetch = vi.mocked(fetch);

			// A 500 is retried, so every attempt needs the same answer.
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				json: async () => ({}),
			} as Response);

			const assertion = expect(api.listWorkspaces()).rejects.toThrow('HTTP 500');
			await vi.runAllTimersAsync();
			await assertion;

			vi.useRealTimers();
		});

		it('should handle network errors', async () => {
			const mockFetch = vi.mocked(fetch);

			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			await expect(api.listWorkspaces()).rejects.toThrow();
		});
	});
});
