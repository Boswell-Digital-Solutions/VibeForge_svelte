/**
 * VF-321: Plan Versioning Types Tests
 *
 * Tests for plan versioning helper functions:
 * - createPlanVersion
 * - createRefinementRequest
 * - comparePlanVersions
 * - getPlanVersion
 * - getLatestVersion
 * - createVersionedPlanningSession
 */

import { describe, it, expect } from 'vitest';
import {
	createPlanVersion,
	createRefinementRequest,
	comparePlanVersions,
	getPlanVersion,
	getLatestVersion,
	createVersionedPlanningSession,
	type PlanningSession,
	type PlanningSessionWithVersions,
	type PlanVersion,
	type RefinementRequest
} from '$lib/workbench/planning/types';

// Mock planning session
const mockSession: PlanningSession = {
	id: 'session_1',
	title: 'User Authentication',
	description: 'Implement user authentication system',
	requestType: 'feature',
	pipeline: {
		type: 'default',
		name: 'Default Planning',
		description: 'Balanced 4-stage workflow',
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
			output: 'Test output',
			streamingOutput: '',
			previousContext: [],
			userInjections: [],
			result: {
				content: 'Test output',
				tokensUsed: { prompt: 100, completion: 200, total: 300 },
				cost: 0.015,
				model: 'claude-3-5-sonnet-20241022',
				provider: 'anthropic',
				durationMs: 1200
			},
			startedAt: new Date('2025-01-01T10:00:00Z'),
			completedAt: new Date('2025-01-01T10:02:00Z'),
			error: null
		}
	],
	deliverable: {
		implementationPlan: {
			content: '## Overview\nAuthentication system with JWT',
			filename: 'auth_plan.md'
		},
		claudeCodePrompt: {
			content: 'Implement authentication',
			filename: 'auth_prompt.md'
		},
		metadata: {
			title: 'User Authentication',
			estimatedTime: '2 weeks',
			phases: ['Setup', 'Implementation'],
			successCriteria: ['Users can login']
		}
	},
	status: 'completed',
	totalTokens: 300,
	totalCost: 0.015,
	currentStageIndex: 0,
	createdAt: new Date('2025-01-01T10:00:00Z'),
	startedAt: new Date('2025-01-01T10:00:00Z'),
	pausedAt: null,
	completedAt: new Date('2025-01-01T10:02:00Z'),
	error: null,
	userId: 'user_test',
	workspaceId: 'ws_test'
};

describe('createPlanVersion', () => {
	it('should create a version snapshot from a session', () => {
		const version = createPlanVersion(mockSession, 1, null);

		expect(version.version).toBe(1);
		expect(version.deliverable).toBe(mockSession.deliverable);
		expect(version.totalTokens).toBe(300);
		expect(version.totalCost).toBe(0.015);
		expect(version.stages).toHaveLength(1);
		expect(version.refinementRequest).toBeNull();
		expect(version.status).toBe('completed');
		expect(version.createdAt).toBeInstanceOf(Date);
	});

	it('should include refinement request if provided', () => {
		const refinementRequest: RefinementRequest = {
			requirements: ['Add OAuth support'],
			requestedBy: 'user_123',
			requestedAt: new Date()
		};

		const version = createPlanVersion(mockSession, 2, refinementRequest);

		expect(version.version).toBe(2);
		expect(version.refinementRequest).toBe(refinementRequest);
	});

	it('should throw error if session has no deliverable', () => {
		const sessionWithoutDeliverable = { ...mockSession, deliverable: null };

		expect(() => createPlanVersion(sessionWithoutDeliverable as any, 1, null)).toThrow(
			'Cannot create version: session has no deliverable'
		);
	});

	it('should deep copy stages array', () => {
		const version = createPlanVersion(mockSession, 1, null);

		expect(version.stages).not.toBe(mockSession.stages);
		expect(version.stages[0]).toEqual(mockSession.stages[0]);
	});
});

describe('createRefinementRequest', () => {
	it('should create a refinement request with requirements', () => {
		const request = createRefinementRequest(['Add OAuth', 'Add 2FA'], 'user_123');

		expect(request.requirements).toEqual(['Add OAuth', 'Add 2FA']);
		expect(request.requestedBy).toBe('user_123');
		expect(request.requestedAt).toBeInstanceOf(Date);
		expect(request.additionalContext).toBeUndefined();
		expect(request.focusSections).toBeUndefined();
	});

	it('should include optional additional context', () => {
		const request = createRefinementRequest(
			['Add OAuth'],
			'user_123',
			'Focus on security'
		);

		expect(request.additionalContext).toBe('Focus on security');
	});

	it('should include optional focus sections', () => {
		const request = createRefinementRequest(
			['Add OAuth'],
			'user_123',
			undefined,
			['Security', 'Authentication']
		);

		expect(request.focusSections).toEqual(['Security', 'Authentication']);
	});
});

describe('comparePlanVersions', () => {
	const version1: PlanVersion = {
		version: 1,
		deliverable: {
			implementationPlan: {
				content: '## Overview\nBasic auth\n\n## Phase 1\nSetup',
				filename: 'auth_plan.md'
			},
			claudeCodePrompt: {
				content: 'Implement basic auth',
				filename: 'auth_prompt.md'
			},
			metadata: {
				title: 'Auth',
				estimatedTime: '1 week',
				phases: ['Setup'],
				successCriteria: ['Login works']
			}
		},
		totalTokens: 300,
		totalCost: 0.015,
		stages: [],
		refinementRequest: null,
		createdAt: new Date('2025-01-01T10:00:00Z'),
		status: 'completed'
	};

	const version2: PlanVersion = {
		version: 2,
		deliverable: {
			implementationPlan: {
				content: '## Overview\nOAuth auth\n\n## Phase 1\nSetup\n\n## Phase 2\nOAuth',
				filename: 'auth_plan.md'
			},
			claudeCodePrompt: {
				content: 'Implement OAuth auth',
				filename: 'auth_prompt.md'
			},
			metadata: {
				title: 'Auth',
				estimatedTime: '2 weeks',
				phases: ['Setup', 'OAuth'],
				successCriteria: ['Login works', 'OAuth works']
			}
		},
		totalTokens: 500,
		totalCost: 0.025,
		stages: [],
		refinementRequest: {
			requirements: ['Add OAuth support'],
			requestedBy: 'user_123',
			requestedAt: new Date('2025-01-01T11:00:00Z')
		},
		createdAt: new Date('2025-01-01T11:00:00Z'),
		status: 'completed'
	};

	it('should compare two versions and return diff', () => {
		const diff = comparePlanVersions(version1, version2);

		expect(diff.versionA).toBe(1);
		expect(diff.versionB).toBe(2);
		expect(diff.sectionDiffs).toBeDefined();
		expect(diff.addedRequirements).toEqual(['Add OAuth support']);
		expect(diff.metricsChange.tokensDiff).toBe(200); // 500 - 300
		expect(diff.metricsChange.costDiff).toBeCloseTo(0.01, 4); // 0.025 - 0.015
		expect(diff.summary).toContain('Version 2 vs 1');
	});

	it('should identify added sections', () => {
		const diff = comparePlanVersions(version1, version2);

		const addedSections = diff.sectionDiffs.filter((d) => d.type === 'added');
		expect(addedSections.length).toBeGreaterThan(0);
	});

	it('should identify changed sections', () => {
		const diff = comparePlanVersions(version1, version2);

		const changedSections = diff.sectionDiffs.filter((d) => d.type === 'changed');
		expect(changedSections.length).toBeGreaterThan(0);
	});

	it('should handle versions with no refinement request', () => {
		const diff = comparePlanVersions(version1, version1);

		expect(diff.addedRequirements).toEqual([]);
	});
});

describe('getPlanVersion', () => {
	const versionedSession: PlanningSessionWithVersions = {
		...mockSession,
		versionHistory: [
			createPlanVersion(mockSession, 1, null),
			createPlanVersion(mockSession, 2, {
				requirements: ['Add OAuth'],
				requestedBy: 'user_123',
				requestedAt: new Date()
			})
		],
		currentVersion: 2,
		parentSessionId: null,
		isRefinement: false
	};

	it('should retrieve version by number', () => {
		const version = getPlanVersion(versionedSession, 1);

		expect(version).toBeDefined();
		expect(version?.version).toBe(1);
	});

	it('should return null for non-existent version', () => {
		const version = getPlanVersion(versionedSession, 99);

		expect(version).toBeNull();
	});

	it('should retrieve latest version', () => {
		const version = getPlanVersion(versionedSession, 2);

		expect(version).toBeDefined();
		expect(version?.version).toBe(2);
		expect(version?.refinementRequest).toBeDefined();
	});
});

describe('getLatestVersion', () => {
	it('should return the latest version', () => {
		const versionedSession: PlanningSessionWithVersions = {
			...mockSession,
			versionHistory: [
				createPlanVersion(mockSession, 1, null),
				createPlanVersion(mockSession, 2, null),
				createPlanVersion(mockSession, 3, null)
			],
			currentVersion: 3,
			parentSessionId: null,
			isRefinement: false
		};

		const latest = getLatestVersion(versionedSession);

		expect(latest).toBeDefined();
		expect(latest?.version).toBe(3);
	});

	it('should return null if no versions exist', () => {
		const versionedSession: PlanningSessionWithVersions = {
			...mockSession,
			versionHistory: [],
			currentVersion: 0,
			parentSessionId: null,
			isRefinement: false
		};

		const latest = getLatestVersion(versionedSession);

		expect(latest).toBeNull();
	});
});

describe('createVersionedPlanningSession', () => {
	it('should create a versioned planning session', () => {
		const session = createVersionedPlanningSession(
			'Test Title',
			'Test Description',
			'feature',
			'default',
			'anonymous',
			'default',
			null
		);

		expect(session.id).toBeDefined();
		expect(session.title).toBe('Test Title');
		expect(session.description).toBe('Test Description');
		expect(session.versionHistory).toEqual([]);
		expect(session.currentVersion).toBe(0);
		expect(session.parentSessionId).toBeNull();
		expect(session.isRefinement).toBe(false);
	});

	it('should mark session as refinement if parent exists', () => {
		const session = createVersionedPlanningSession(
			'Test Title',
			'Test Description',
			'feature',
			'default',
			'anonymous',
			'default',
			'parent_123'
		);

		expect(session.parentSessionId).toBe('parent_123');
		expect(session.isRefinement).toBe(true);
	});
});

describe('Integration Tests', () => {
	it('should support full version lifecycle', () => {
		// Create initial session
		const session = createVersionedPlanningSession(
			'Auth Feature',
			'Implement authentication',
			'feature',
			'default',
			'anonymous',
			'default',
			null
		);

		expect(session.versionHistory).toHaveLength(0);

		// Simulate completion and create v1
		session.deliverable = mockSession.deliverable;
		session.status = 'completed';
		const v1 = createPlanVersion(session, 1, null);
		session.versionHistory.push(v1);
		session.currentVersion = 1;

		expect(session.versionHistory).toHaveLength(1);
		expect(session.currentVersion).toBe(1);

		// Create refinement request
		const refinement = createRefinementRequest(['Add OAuth'], 'user_123');

		// Create v2
		const v2 = createPlanVersion(session, 2, refinement);
		session.versionHistory.push(v2);
		session.currentVersion = 2;

		expect(session.versionHistory).toHaveLength(2);
		expect(session.currentVersion).toBe(2);

		// Get latest version
		const latest = getLatestVersion(session);
		expect(latest?.version).toBe(2);
		expect(latest?.refinementRequest?.requirements).toEqual(['Add OAuth']);

		// Compare versions
		const diff = comparePlanVersions(v1, v2);
		expect(diff.versionA).toBe(1);
		expect(diff.versionB).toBe(2);
		expect(diff.addedRequirements).toEqual(['Add OAuth']);
	});
});
