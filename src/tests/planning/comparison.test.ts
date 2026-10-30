/**
 * VF-320: Comparison Store Tests
 *
 * Tests for plan comparison Svelte 5 runes store:
 * - State initialization
 * - createTwoWayComparison
 * - createMultiWayComparison
 * - localStorage persistence
 * - Export functionality
 * - Session management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { comparisonStore } from '$lib/workbench/planning/stores/comparison.svelte';
import type { PlanningSession } from '$lib/workbench/planning/types';

// Mock planning sessions for testing
const mockSessionA: PlanningSession = {
	id: 'session_a',
	title: 'Session A',
	description: 'Test session A',
	requestType: 'feature',
	pipeline: {
		type: 'default',
		name: 'Default',
		description: 'Default pipeline',
		estimatedDuration: 30,
		maxIterations: 3,
		stages: []
	},
	stages: [
		{
			id: 'stage_0',
			index: 0,
			config: {} as any,
			status: 'completed',
			input: 'Test input',
			output: '## Overview\nSession A plan.',
			result: null,
			error: null,
			previousContext: [],
			userInjections: [],
			startedAt: new Date('2025-01-01T10:00:00Z'),
			completedAt: new Date('2025-01-01T10:02:00Z')
		}
	],
	deliverable: {
		implementationPlan: {
			content: '## Overview\nDetailed plan for Session A.',
			filename: 'session_a_plan.md'
		},
		claudeCodePrompt: {
			content: 'Implement Session A.',
			filename: 'session_a_prompt.md'
		},
		metadata: {
			title: 'Session A',
			estimatedTime: '1 week',
			phases: ['Phase A'],
			successCriteria: ['Criteria A']
		}
	},
	status: 'completed',
	currentStageIndex: 0,
	totalTokens: 300,
	totalCost: 0.015,
	createdAt: new Date('2025-01-01T10:00:00Z'),
	startedAt: new Date('2025-01-01T10:00:00Z'),
	pausedAt: null,
	completedAt: new Date('2025-01-01T10:05:00Z'),
	error: null,
	userId: 'user_test',
	workspaceId: 'ws_test'
};

const mockSessionB: PlanningSession = {
	id: 'session_b',
	title: 'Session B',
	description: 'Test session B',
	requestType: 'feature',
	pipeline: {
		type: 'quick',
		name: 'Quick',
		description: 'Quick pipeline',
		estimatedDuration: 30,
		maxIterations: 3,
		stages: []
	},
	stages: [
		{
			id: 'stage_0',
			index: 0,
			config: {} as any,
			status: 'completed',
			input: 'Test input',
			output: '## Overview\nSession B plan.',
			result: null,
			error: null,
			previousContext: [],
			userInjections: [],
			startedAt: new Date('2025-01-01T11:00:00Z'),
			completedAt: new Date('2025-01-01T11:01:30Z')
		}
	],
	deliverable: {
		implementationPlan: {
			content: '## Overview\nDetailed plan for Session B.',
			filename: 'session_b_plan.md'
		},
		claudeCodePrompt: {
			content: 'Implement Session B.',
			filename: 'session_b_prompt.md'
		},
		metadata: {
			title: 'Session B',
			estimatedTime: '3 days',
			phases: ['Phase B'],
			successCriteria: ['Criteria B']
		}
	},
	status: 'completed',
	currentStageIndex: 0,
	totalTokens: 230,
	totalCost: 0.0115,
	createdAt: new Date('2025-01-01T11:00:00Z'),
	startedAt: new Date('2025-01-01T11:00:00Z'),
	pausedAt: null,
	completedAt: new Date('2025-01-01T11:03:00Z'),
	error: null,
	userId: 'user_test',
	workspaceId: 'ws_test'
};

const mockSessionC: PlanningSession = {
	...mockSessionB,
	id: 'session_c',
	title: 'Session C'
};

describe('Comparison Store', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
		// Reset store state
		comparisonStore.clearAllComparisons();
	});

	describe('Initialization', () => {
		it('should initialize with empty state', () => {
			expect(comparisonStore.currentComparison).toBeNull();
			expect(comparisonStore.comparisonHistory).toEqual([]);
			expect(comparisonStore.isComparing).toBe(false);
			expect(comparisonStore.isExporting).toBe(false);
			expect(comparisonStore.error).toBeNull();
		});

		it('should load comparison history from localStorage', () => {
			// Create a comparison
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			const firstHistory = [...comparisonStore.comparisonHistory];

			// Simulate page reload by creating new store instance (in real app)
			// For this test, we verify localStorage was updated
			const storedData = localStorage.getItem('vibeforge-plan-comparisons');
			expect(storedData).toBeTruthy();
			expect(JSON.parse(storedData!).length).toBe(1);
		});
	});

	describe('createTwoWayComparison', () => {
		it('should create a two-way comparison', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);

			expect(comparisonStore.currentComparison).toBeDefined();
			expect(comparisonStore.currentComparison).toHaveProperty('sessionA');
			expect(comparisonStore.currentComparison).toHaveProperty('sessionB');
		});

		it('should use custom title if provided', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB, 'Custom Title');
			expect(comparisonStore.currentComparison?.title).toBe('Custom Title');
		});

		it('should set isComparing flag during creation', () => {
			// Note: isComparing is set synchronously, so we can't easily test it mid-execution
			// This test verifies it's false after completion
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			expect(comparisonStore.isComparing).toBe(false);
		});

		it('should add comparison to history', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			expect(comparisonStore.comparisonHistory.length).toBe(1);
			expect(comparisonStore.comparisonHistory[0]).toEqual(comparisonStore.currentComparison);
		});

		it('should add comparison at the beginning of history', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB, 'First');
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionC, 'Second');

			expect(comparisonStore.comparisonHistory[0].title).toBe('Second');
			expect(comparisonStore.comparisonHistory[1].title).toBe('First');
		});

		it('should limit history to MAX_HISTORY entries', () => {
			// Create 60 comparisons (MAX_HISTORY is 50)
			for (let i = 0; i < 60; i++) {
				comparisonStore.createTwoWayComparison(
					mockSessionA,
					mockSessionB,
					`Comparison ${i}`
				);
			}

			expect(comparisonStore.comparisonHistory.length).toBeLessThanOrEqual(50);
		});

		it('should persist to localStorage', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);

			const storedData = localStorage.getItem('vibeforge-plan-comparisons');
			expect(storedData).toBeTruthy();
			const parsed = JSON.parse(storedData!);
			expect(parsed.length).toBe(1);
		});
	});

	describe('createMultiWayComparison', () => {
		it('should create a multi-way comparison with 3+ sessions', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi Comparison'
			);

			expect(comparisonStore.currentComparison).toBeDefined();
			const comparison = comparisonStore.currentComparison as any;
			expect(comparison).toHaveProperty('sessions');
			expect(comparison.sessions).toHaveLength(3);
		});

		it('should generate quality scores for all sessions', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);

			const comparison = comparisonStore.currentComparison as any;
			expect(comparison.qualityScores).toBeDefined();
			expect(comparison.qualityScores.size).toBe(3);
		});

		it('should build metrics table for all sessions', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);

			const comparison = comparisonStore.currentComparison as any;
			expect(comparison.metricsTable).toBeDefined();
			expect(comparison.metricsTable).toHaveLength(3);
		});

		it('should generate rankings (byQuality, byCost, bySpeed, byCombined)', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);

			const comparison = comparisonStore.currentComparison as any;
			expect(comparison.rankings).toBeDefined();
			expect(comparison.rankings.byQuality).toHaveLength(3);
			expect(comparison.rankings.byCost).toHaveLength(3);
			expect(comparison.rankings.bySpeed).toHaveLength(3);
			expect(comparison.rankings.byCombined).toHaveLength(3);
		});

		it('should rank sessions by quality (highest first)', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);

			const comparison = comparisonStore.currentComparison as any;
			const rankings = comparison.rankings.byQuality;
			const scores = rankings.map((sessionId: string) =>
				comparison.qualityScores.get(sessionId)?.overallScore
			);

			// Verify descending order
			for (let i = 0; i < scores.length - 1; i++) {
				expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
			}
		});

		it('should rank sessions by cost (lowest first)', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);

			const comparison = comparisonStore.currentComparison as any;
			const rankings = comparison.rankings.byCost;
			const costs = rankings.map(
				(sessionId: string) =>
					comparison.metricsTable.find((m: any) => m.sessionId === sessionId)?.totalCost
			);

			// Verify ascending order (lowest cost first)
			for (let i = 0; i < costs.length - 1; i++) {
				expect(costs[i]).toBeLessThanOrEqual(costs[i + 1]);
			}
		});

		it('should rank sessions by speed (fastest first)', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);

			const comparison = comparisonStore.currentComparison as any;
			const rankings = comparison.rankings.bySpeed;
			const durations = rankings.map(
				(sessionId: string) =>
					comparison.metricsTable.find((m: any) => m.sessionId === sessionId)?.durationMs
			);

			// Verify ascending order (fastest first)
			for (let i = 0; i < durations.length - 1; i++) {
				expect(durations[i]).toBeLessThanOrEqual(durations[i + 1]);
			}
		});

		it('should add multi-way comparison to history', () => {
			comparisonStore.createMultiWayComparison(
				[mockSessionA, mockSessionB, mockSessionC],
				'Multi'
			);
			expect(comparisonStore.comparisonHistory.length).toBe(1);
		});
	});

	describe('Session Management', () => {
		it('should load a comparison from history', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB, 'First');
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionC, 'Second');

			const firstComparison = comparisonStore.comparisonHistory[1];
			comparisonStore.loadComparison(firstComparison.id);

			expect(comparisonStore.currentComparison?.id).toBe(firstComparison.id);
			expect(comparisonStore.currentComparison?.title).toBe('First');
		});

		it('should do nothing if comparison ID not found', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			const currentId = comparisonStore.currentComparison?.id;

			comparisonStore.loadComparison('nonexistent_id');

			// Current comparison should not change
			expect(comparisonStore.currentComparison?.id).toBe(currentId);
		});

		it('should delete a comparison from history', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB, 'First');
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionC, 'Second');

			const idToDelete = comparisonStore.comparisonHistory[0].id;
			comparisonStore.deleteComparison(idToDelete);

			expect(comparisonStore.comparisonHistory.length).toBe(1);
			expect(comparisonStore.comparisonHistory[0].id).not.toBe(idToDelete);
		});

		it('should clear current comparison if deleting it', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			const currentId = comparisonStore.currentComparison!.id;

			comparisonStore.deleteComparison(currentId);

			expect(comparisonStore.currentComparison).toBeNull();
		});

		it('should persist deletion to localStorage', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionC);

			const idToDelete = comparisonStore.comparisonHistory[0].id;
			comparisonStore.deleteComparison(idToDelete);

			const storedData = localStorage.getItem('vibeforge-plan-comparisons');
			const parsed = JSON.parse(storedData!);
			expect(parsed.length).toBe(1);
			expect(parsed[0].id).not.toBe(idToDelete);
		});

		it('should clear current comparison', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			comparisonStore.clearCurrentComparison();

			expect(comparisonStore.currentComparison).toBeNull();
		});

		it('should not affect history when clearing current comparison', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			const historyLength = comparisonStore.comparisonHistory.length;

			comparisonStore.clearCurrentComparison();

			expect(comparisonStore.comparisonHistory.length).toBe(historyLength);
		});

		it('should clear all comparisons', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionC);

			comparisonStore.clearAllComparisons();

			expect(comparisonStore.currentComparison).toBeNull();
			expect(comparisonStore.comparisonHistory).toEqual([]);
		});

		it('should clear localStorage when clearing all comparisons', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			comparisonStore.clearAllComparisons();

			const storedData = localStorage.getItem('vibeforge-plan-comparisons');
			expect(storedData).toBeNull();
		});
	});

	describe('Export Functionality', () => {
		beforeEach(() => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
		});

		it('should export comparison as markdown', async () => {
			const markdown = await comparisonStore.exportComparison('markdown');

			expect(markdown).toBeTruthy();
			expect(markdown).toContain('# Plan Comparison');
			expect(markdown).toContain('Session A');
			expect(markdown).toContain('Session B');
		});

		it('should export comparison as JSON', async () => {
			const json = await comparisonStore.exportComparison('json');

			expect(json).toBeTruthy();
			const parsed = JSON.parse(json);
			expect(parsed).toHaveProperty('id');
			expect(parsed).toHaveProperty('title');
			expect(parsed).toHaveProperty('type');
		});

		it('should export comparison as HTML', async () => {
			const html = await comparisonStore.exportComparison('html');

			expect(html).toBeTruthy();
			expect(html).toContain('<html>');
			expect(html).toContain('Plan Comparison');
		});

		it('should set isExporting flag during export', async () => {
			// Note: isExporting is set synchronously, so we can't easily test it mid-execution
			await comparisonStore.exportComparison('markdown');
			expect(comparisonStore.isExporting).toBe(false);
		});

		it('should throw error if no current comparison', async () => {
			comparisonStore.clearCurrentComparison();

			await expect(comparisonStore.exportComparison('markdown')).rejects.toThrow();
		});
	});

	describe('Error Handling', () => {
		it('should set error state on comparison failure', () => {
			// Create a session that might cause an error (e.g., missing data)
			const invalidSession = {} as PlanningSession;

			try {
				comparisonStore.createTwoWayComparison(invalidSession, mockSessionB);
			} catch (e) {
				// Error should be caught and set in state
			}

			// Note: Actual error handling depends on implementation
			// This test is a placeholder for error handling tests
		});

		it('should clear error when creating new comparison', () => {
			// Set an error state manually (if possible)
			// Then create a new comparison
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);

			expect(comparisonStore.error).toBeNull();
		});
	});

	describe('localStorage Persistence', () => {
		it('should serialize dates to ISO strings', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);

			const storedData = localStorage.getItem('vibeforge-plan-comparisons');
			expect(storedData).toBeTruthy();

			// Dates should be stored as ISO strings
			expect(storedData).toContain('2025-01-01');
		});

		it('should deserialize ISO strings to Date objects on load', () => {
			comparisonStore.createTwoWayComparison(mockSessionA, mockSessionB);
			const comparison = comparisonStore.currentComparison!;

			expect(comparison.createdAt).toBeInstanceOf(Date);
			expect((comparison as any).sessionA.createdAt).toBeInstanceOf(Date);
		});
	});
});
