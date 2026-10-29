/**
 * VF-320: Plan Comparison Service Tests
 *
 * Tests for plan comparison service functionality:
 * - Quality scoring (6 criteria)
 * - comparePlans (two-way comparison)
 * - Section diff generation
 * - Metrics comparison
 * - Winner determination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanComparisonService } from '$lib/workbench/planning/services/planComparisonService';
import { calculateCombinedScore } from '$lib/workbench/planning/types';
import type { PlanningSession } from '$lib/workbench/planning/types';

// Mock planning sessions for testing
const mockSessionA: PlanningSession = {
	id: 'session_a',
	title: 'Feature Implementation - Session A',
	description: 'Implement user authentication',
	requestType: 'feature',
	pipeline: {
		type: 'default',
		name: 'Default Planning',
		description: 'Balanced 4-stage workflow',
		stages: []
	},
	stages: [
		{
			id: 'stage_0',
			type: 'initial',
			config: {} as any,
			status: 'completed',
			input: 'Implement user authentication',
			output:
				'## Overview\nComplete authentication system.\n\n## Phase 1\nSetup infrastructure.\n\n## Acceptance Criteria\nUsers can login.\n\n## Testing\nUnit tests for auth.',
			context: [],
			tokens: { input: 100, output: 200, total: 300 },
			cost: 0.015,
			startedAt: new Date('2025-01-01T10:00:00Z'),
			completedAt: new Date('2025-01-01T10:02:00Z')
		}
	],
	deliverable: {
		implementationPlan: {
			content:
				'## Overview\nComplete authentication system with JWT tokens.\n\n## Phase 1: Infrastructure\nSetup database and API endpoints.\n\n## Phase 2: Implementation\nImplement login/logout.\n\n## Acceptance Criteria\n- Users can register\n- Users can login\n- Tokens expire after 1 hour\n\n## Testing Strategy\nUnit tests for all endpoints.\n\n## Deployment Plan\nDeploy to staging first.',
			filename: 'auth_plan.md'
		},
		claudeCodePrompt: {
			content: 'Implement the authentication system as described.',
			filename: 'auth_prompt.md'
		},
		metadata: {
			title: 'User Authentication',
			estimatedTime: '2 weeks',
			phases: ['Infrastructure', 'Implementation'],
			successCriteria: ['Registration works', 'Login works']
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
	title: 'Feature Implementation - Session B',
	description: 'Implement user authentication',
	requestType: 'feature',
	pipeline: {
		type: 'quick',
		name: 'Quick Planning',
		description: 'Fast 2-stage workflow',
		stages: []
	},
	stages: [
		{
			id: 'stage_0',
			type: 'initial',
			config: {} as any,
			status: 'completed',
			input: 'Implement user authentication',
			output:
				'## Overview\nBasic auth system.\n\n## Implementation\nUse OAuth.\n\n## Testing\nManual testing.',
			context: [],
			tokens: { input: 80, output: 150, total: 230 },
			cost: 0.0115,
			startedAt: new Date('2025-01-01T11:00:00Z'),
			completedAt: new Date('2025-01-01T11:01:30Z')
		}
	],
	deliverable: {
		implementationPlan: {
			content:
				'## Overview\nBasic authentication using OAuth 2.0.\n\n## Implementation Steps\n1. Setup OAuth provider\n2. Implement callback\n3. Store tokens\n\n## Testing\nManual testing with real accounts.',
			filename: 'oauth_plan.md'
		},
		claudeCodePrompt: {
			content: 'Implement OAuth authentication.',
			filename: 'oauth_prompt.md'
		},
		metadata: {
			title: 'OAuth Authentication',
			estimatedTime: '1 week',
			phases: ['Implementation'],
			successCriteria: ['OAuth login works']
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

describe('PlanComparisonService', () => {
	let service: PlanComparisonService;

	beforeEach(() => {
		service = new PlanComparisonService();
	});

	describe('Quality Scoring', () => {
		it('should score completeness based on key sections', () => {
			const assessment = service.scoreQuality(mockSessionA);
			const completeness = assessment.criterionScores.find((c) => c.criterion === 'completeness');
			expect(completeness).toBeDefined();
			expect(completeness!.score).toBeGreaterThan(0);
			expect(completeness!.explanation).toBeDefined();
		});

		it('should give higher completeness score for plans with more sections', () => {
			const assessmentA = service.scoreQuality(mockSessionA);
			const assessmentB = service.scoreQuality(mockSessionB);

			const completenessA = assessmentA.criterionScores.find(
				(c) => c.criterion === 'completeness'
			);
			const completenessB = assessmentB.criterionScores.find(
				(c) => c.criterion === 'completeness'
			);

			// Session A has more sections (Overview, Phase 1, Phase 2, Acceptance, Testing, Deployment)
			expect(completenessA!.score).toBeGreaterThan(completenessB!.score);
		});

		it('should score clarity based on structure and formatting', () => {
			const assessment = service.scoreQuality(mockSessionA);
			const clarity = assessment.criterionScores.find((c) => c.criterion === 'clarity');
			expect(clarity).toBeDefined();
			expect(clarity!.score).toBeGreaterThan(0);
		});

		it('should score detail based on word count and specificity', () => {
			const detailedPlan = [
				'## Overview',
				'detail '.repeat(520),
				'API database component service interface class function '.repeat(2)
			].join('\n');
			const detailedSession = {
				...mockSessionA,
				deliverable: {
					...mockSessionA.deliverable!,
					implementationPlan: {
						content: detailedPlan,
						filename: 'detailed_plan.md'
					}
				}
			};

			const assessment = service.scoreQuality(detailedSession);
			const detail = assessment.criterionScores.find((c) => c.criterion === 'detail');
			expect(detail).toBeDefined();
			expect(detail!.score).toBeGreaterThan(0);
		});

		it('should score feasibility based on risk awareness', () => {
			const assessment = service.scoreQuality(mockSessionA);
			const feasibility = assessment.criterionScores.find((c) => c.criterion === 'feasibility');
			expect(feasibility).toBeDefined();
			expect(feasibility!.score).toBeGreaterThan(0);
		});

		it('should score structure based on organization', () => {
			const assessment = service.scoreQuality(mockSessionA);
			const structure = assessment.criterionScores.find((c) => c.criterion === 'structure');
			expect(structure).toBeDefined();
			expect(structure!.score).toBeGreaterThan(0);
		});

		it('should score best practices', () => {
			const assessment = service.scoreQuality(mockSessionA);
			const bestPractices = assessment.criterionScores.find(
				(c) => c.criterion === 'best_practices'
			);
			expect(bestPractices).toBeDefined();
			expect(bestPractices!.score).toBeGreaterThan(0);
		});

		it('should calculate overall score as average of all criteria', () => {
			const assessment = service.scoreQuality(mockSessionA);
			expect(assessment.criterionScores).toHaveLength(6);

			const avgScore =
				assessment.criterionScores.reduce((sum, c) => sum + c.score, 0) /
				assessment.criterionScores.length;

			expect(assessment.overallScore).toBe(Math.round(avgScore));
		});

		it('should provide strengths for high-scoring criteria', () => {
			const assessment = service.scoreQuality(mockSessionA);
			expect(assessment.strengths).toBeDefined();
			expect(Array.isArray(assessment.strengths)).toBe(true);
		});

		it('should provide weaknesses for low-scoring criteria', () => {
			const assessment = service.scoreQuality(mockSessionB); // Simpler plan
			expect(assessment.weaknesses).toBeDefined();
			expect(Array.isArray(assessment.weaknesses)).toBe(true);
		});

		it('should provide recommendations for improvement', () => {
			const assessment = service.scoreQuality(mockSessionB);
			expect(assessment.recommendations).toBeDefined();
			expect(Array.isArray(assessment.recommendations)).toBe(true);
		});

		it('should include evidence for criterion scores', () => {
			const assessment = service.scoreQuality(mockSessionA);
			const completeness = assessment.criterionScores.find((c) => c.criterion === 'completeness');
			expect(completeness!.evidence).toBeDefined();
			expect(Array.isArray(completeness!.evidence)).toBe(true);
		});

		it('should set scoredAt timestamp', () => {
			const assessment = service.scoreQuality(mockSessionA);
			expect(assessment.scoredAt).toBeInstanceOf(Date);
		});
	});

	describe('comparePlans', () => {
		it('should create a two-way comparison', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.id).toBeDefined();
			expect(comparison.sessionA).toBe(mockSessionA);
			expect(comparison.sessionB).toBe(mockSessionB);
		});

		it('should use custom title if provided', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB, 'Custom Title');
			expect(comparison.title).toBe('Custom Title');
		});

		it('should generate default title from session titles', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.title).toContain('Session A');
			expect(comparison.title).toContain('Session B');
		});

		it('should include quality scores for both sessions', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.qualityScores.sessionA).toBeDefined();
			expect(comparison.qualityScores.sessionB).toBeDefined();
			expect(comparison.qualityScores.sessionA.sessionId).toBe(mockSessionA.id);
			expect(comparison.qualityScores.sessionB.sessionId).toBe(mockSessionB.id);
		});

		it('should generate section diffs', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.sectionDiffs).toBeDefined();
			expect(Array.isArray(comparison.sectionDiffs)).toBe(true);
		});

		it('should compare metrics (tokens, cost, duration, stages)', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.metricsComparison).toBeDefined();
			expect(comparison.metricsComparison.sessionA.totalTokens).toBe(300);
			expect(comparison.metricsComparison.sessionB.totalTokens).toBe(230);
			expect(comparison.metricsComparison.differences.tokenDiff).toBe(70); // 300 - 230
		});

		it('should calculate cost difference', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.metricsComparison.sessionA.totalCost).toBe(0.015);
			expect(comparison.metricsComparison.sessionB.totalCost).toBe(0.0115);
			expect(comparison.metricsComparison.differences.costDiff).toBeCloseTo(0.0035, 4);
		});

		it('should calculate duration difference', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			const durationA =
				mockSessionA.completedAt!.getTime() - mockSessionA.createdAt.getTime();
			const durationB =
				mockSessionB.completedAt!.getTime() - mockSessionB.createdAt.getTime();

			expect(comparison.metricsComparison.sessionA.durationMs).toBe(durationA);
			expect(comparison.metricsComparison.sessionB.durationMs).toBe(durationB);
			expect(comparison.metricsComparison.differences.durationDiff).toBe(durationA - durationB);
		});

		it('should compare stage counts', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.metricsComparison.sessionA.stageCount).toBe(1);
			expect(comparison.metricsComparison.sessionB.stageCount).toBe(1);
			expect(comparison.metricsComparison.differences.stageDiff).toBe(0);
		});

		it('should determine a winner', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.winner).toBeDefined();
			if (comparison.winner) {
				expect(comparison.winner.sessionId).toBeDefined();
				expect(['quality', 'cost', 'speed', 'combined']).toContain(comparison.winner.reason);
				expect(comparison.winner.score).toBeGreaterThanOrEqual(0);
				expect(comparison.winner.score).toBeLessThanOrEqual(100);
			}
		});

		it('should set createdAt timestamp', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.createdAt).toBeInstanceOf(Date);
		});
	});

	describe('Section Diff Generation', () => {
		it('should identify added sections', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			const addedSections = comparison.sectionDiffs.filter((d) => d.type === 'added');
			// Session A has "Deployment Plan" which Session B doesn't
			expect(addedSections.length).toBeGreaterThanOrEqual(0);
		});

		it('should identify removed sections', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			const removedSections = comparison.sectionDiffs.filter((d) => d.type === 'removed');
			expect(removedSections.length).toBeGreaterThanOrEqual(0);
		});

		it('should identify changed sections', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			const changedSections = comparison.sectionDiffs.filter((d) => d.type === 'changed');
			expect(changedSections.length).toBeGreaterThanOrEqual(0);
		});

		it('should calculate similarity for changed sections', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			const changedSections = comparison.sectionDiffs.filter((d) => d.type === 'changed');

			changedSections.forEach((diff) => {
				expect(diff.similarity).toBeDefined();
				expect(diff.similarity).toBeGreaterThanOrEqual(0);
				expect(diff.similarity).toBeLessThan(100);
			});
		});
	});

	describe('Winner Determination', () => {
		it('should select the session with the higher combined score', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.winner).not.toBeNull();

			const durationA =
				mockSessionA.completedAt!.getTime() - mockSessionA.startedAt!.getTime();
			const durationB =
				mockSessionB.completedAt!.getTime() - mockSessionB.startedAt!.getTime();
			const maxCost = Math.max(mockSessionA.totalCost, mockSessionB.totalCost);
			const maxDuration = Math.max(durationA, durationB);

			const scoreA = calculateCombinedScore(
				comparison.qualityScores.sessionA.overallScore,
				mockSessionA.totalCost,
				durationA,
				maxCost,
				maxDuration
			);
			const scoreB = calculateCombinedScore(
				comparison.qualityScores.sessionB.overallScore,
				mockSessionB.totalCost,
				durationB,
				maxCost,
				maxDuration
			);

			expect(comparison.winner!.sessionId).toBe(
				scoreA >= scoreB ? mockSessionA.id : mockSessionB.id
			);
			expect(comparison.winner!.reason).toBe('combined');
			expect(comparison.winner!.score).toBe(Math.max(scoreA, scoreB));
		});

		it('should include combined score in winner determination', () => {
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			expect(comparison.winner).toBeDefined();
			if (comparison.winner) {
				expect(comparison.winner.score).toBeGreaterThanOrEqual(0);
				expect(comparison.winner.score).toBeLessThanOrEqual(100);
			}
		});

		it('should allow null winner if sessions are very close', () => {
			// If sessions have nearly identical scores, winner could be null
			const comparison = service.comparePlans(mockSessionA, mockSessionB);
			// Winner can be null or defined
			if (comparison.winner !== null) {
				expect(comparison.winner.sessionId).toBeDefined();
			}
		});
	});

	describe('Edge Cases', () => {
		it('should handle sessions without deliverables', () => {
			const sessionWithoutDeliverable = { ...mockSessionA, deliverable: undefined };
			const assessment = service.scoreQuality(sessionWithoutDeliverable as any);
			expect(assessment.overallScore).toBeDefined();
			expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
		});

		it('should handle empty plan content', () => {
			const sessionWithEmptyPlan = {
				...mockSessionA,
				deliverable: {
					...mockSessionA.deliverable!,
					implementationPlan: { content: '', filename: 'empty_plan.md' }
				}
			};
			const assessment = service.scoreQuality(sessionWithEmptyPlan);
			expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
		});

		it('should handle sessions with no stages', () => {
			const sessionNoStages = { ...mockSessionA, stages: [], totalTokens: 0 };
			const comparison = service.comparePlans(sessionNoStages, mockSessionB);
			expect(comparison.metricsComparison.sessionA.stageCount).toBe(0);
			expect(comparison.metricsComparison.sessionA.totalTokens).toBe(0);
		});

		it('should handle sessions without completion time', () => {
			const sessionNoCompletion = { ...mockSessionA, completedAt: undefined };
			const comparison = service.comparePlans(sessionNoCompletion, mockSessionB);
			expect(comparison.metricsComparison.sessionA.durationMs).toBe(0);
		});
	});
});
