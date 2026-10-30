/**
 * VF-320: Plan Comparison Types
 *
 * Types for comparing completed planning sessions:
 * - Side-by-side diff view
 * - Quality scoring
 * - Section-level comparison
 * - Merge functionality
 * - Export formats
 */

import type { PlanningSession, PipelineType } from './index';

// ==============================================================================
// QUALITY SCORING
// ==============================================================================

/**
 * Quality criteria for scoring plans
 */
export type QualityCriterion =
	| 'completeness' // Does it cover all requirements?
	| 'clarity' // Is it easy to understand?
	| 'detail' // Does it provide sufficient detail?
	| 'feasibility' // Is it realistic and achievable?
	| 'structure' // Is it well-organized?
	| 'best_practices'; // Does it follow best practices?

/**
 * Quality score for a single criterion
 */
export interface CriterionScore {
	/** Criterion being scored */
	criterion: QualityCriterion;
	/** Score (0-100) */
	score: number;
	/** Explanation for the score */
	explanation: string;
	/** Evidence from the plan */
	evidence?: string[];
}

/**
 * Overall quality assessment for a plan
 */
export interface QualityAssessment {
	/** Session ID */
	sessionId: string;
	/** Overall score (average of all criteria, 0-100) */
	overallScore: number;
	/** Individual criterion scores */
	criterionScores: CriterionScore[];
	/** Strengths */
	strengths: string[];
	/** Weaknesses */
	weaknesses: string[];
	/** Recommendations for improvement */
	recommendations: string[];
	/** Scored timestamp */
	scoredAt: Date;
}

// ==============================================================================
// DIFF AND SECTIONS
// ==============================================================================

/**
 * Diff type for a section
 */
export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * A section extracted from a plan
 */
export interface PlanSection {
	/** Section ID */
	id: string;
	/** Section type (e.g., 'overview', 'phase', 'acceptance', 'risks') */
	type: string;
	/** Section title */
	title: string;
	/** Section content */
	content: string;
	/** Line number range in original plan */
	lineRange: [number, number];
	/** Subsections (if any) */
	subsections?: PlanSection[];
}

/**
 * Diff between two plan sections
 */
export interface SectionDiff {
	/** Diff type */
	type: DiffType;
	/** Section from session A */
	sectionA?: PlanSection;
	/** Section from session B */
	sectionB?: PlanSection;
	/** Similarity score (0-100, for 'changed' type) */
	similarity?: number;
	/** Content diff (for 'changed' type) */
	contentDiff?: {
		added: string[];
		removed: string[];
		modified: string[];
	};
}

// ==============================================================================
// PLAN COMPARISON
// ==============================================================================

/**
 * Comparison between two planning sessions
 */
export interface PlanComparison {
	/** Comparison ID */
	id: string;
	/** Title for this comparison */
	title: string;
	/** Session A */
	sessionA: PlanningSession;
	/** Session B */
	sessionB: PlanningSession;
	/** Quality assessments */
	qualityScores: {
		sessionA: QualityAssessment;
		sessionB: QualityAssessment;
	};
	/** Section-level diffs */
	sectionDiffs: SectionDiff[];
	/** Metrics comparison */
	metricsComparison: {
		sessionA: {
			totalTokens: number;
			totalCost: number;
			durationMs: number;
			stageCount: number;
		};
		sessionB: {
			totalTokens: number;
			totalCost: number;
			durationMs: number;
			stageCount: number;
		};
		/** Each difference is sessionA minus sessionB: positive means A spent more. */
		differences: {
			tokenDiff: number;
			costDiff: number;
			durationDiff: number;
			stageDiff: number;
		};
	};
	/** Winner based on selected criteria */
	winner: {
		sessionId: string;
		reason: 'quality' | 'cost' | 'speed' | 'combined';
		score: number;
	} | null;
	/** Created timestamp */
	createdAt: Date;
}

/**
 * Multi-plan comparison (3+ sessions)
 */
export interface MultiPlanComparison {
	/** Comparison ID */
	id: string;
	/** Title */
	title: string;
	/** All sessions being compared */
	sessions: PlanningSession[];
	/** Quality scores for all sessions */
	qualityScores: Map<string, QualityAssessment>;
	/** Pairwise diffs (sessionA_id:sessionB_id -> diffs) */
	pairwiseDiffs: Map<string, SectionDiff[]>;
	/** Metrics table */
	metricsTable: Array<{
		sessionId: string;
		pipeline: PipelineType;
		totalTokens: number;
		totalCost: number;
		durationMs: number;
		qualityScore: number;
	}>;
	/** Rankings */
	rankings: {
		byQuality: string[]; // Session IDs sorted by quality score
		byCost: string[]; // Session IDs sorted by cost (lowest first)
		bySpeed: string[]; // Session IDs sorted by duration (fastest first)
		byCombined: string[]; // Session IDs sorted by combined score
	};
	/** Created timestamp */
	createdAt: Date;
}

// ==============================================================================
// MERGE
// ==============================================================================

/**
 * Merged section combining best parts from multiple plans
 */
export interface MergedSection {
	/** Section ID */
	id: string;
	/** Section type */
	type: string;
	/** Section title */
	title: string;
	/** Merged content */
	content: string;
	/** Source session IDs that contributed to this section */
	sources: Array<{
		sessionId: string;
		contribution: string;
		reason: string;
	}>;
}

/**
 * Merged plan combining best sections from multiple sessions
 */
export interface MergedPlan {
	/** Merge ID */
	id: string;
	/** Title */
	title: string;
	/** Description */
	description: string;
	/** Source sessions */
	sourceSessions: string[];
	/** Merged sections */
	sections: MergedSection[];
	/** Overall quality assessment of merged plan */
	qualityAssessment: QualityAssessment;
	/** Merge strategy used */
	mergeStrategy: 'best_quality' | 'best_coverage' | 'balanced' | 'manual';
	/** Created timestamp */
	createdAt: Date;
}

// ==============================================================================
// EXPORT
// ==============================================================================

/**
 * Export format for comparison reports
 */
export type ExportFormat = 'markdown' | 'pdf' | 'html' | 'json';

/**
 * Comparison report for export
 */
export interface ComparisonReport {
	/** Report ID */
	id: string;
	/** Title */
	title: string;
	/** Report type */
	type: 'two-way' | 'multi-way';
	/** Executive summary */
	summary: {
		totalSessionsCompared: number;
		recommendedSession: string | null;
		keyFindings: string[];
		quickStats: {
			avgCost: number;
			avgDuration: number;
			avgQualityScore: number;
		};
	};
	/** Detailed comparison data */
	comparisonData: PlanComparison | MultiPlanComparison;
	/** Generated timestamp */
	generatedAt: Date;
	/** Format */
	format: ExportFormat;
}

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Calculate similarity between two strings (0-100)
 * Uses Levenshtein distance normalized
 */
export function calculateSimilarity(str1: string, str2: string): number {
	if (str1 === str2) return 100;
	if (!str1 || !str2) return 0;

	const longer = str1.length > str2.length ? str1 : str2;
	const shorter = str1.length > str2.length ? str2 : str1;

	if (longer.length === 0) return 100;

	const distance = levenshteinDistance(shorter, longer);
	const similarity = ((longer.length - distance) / longer.length) * 100;

	return Math.round(similarity);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= str2.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= str1.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= str2.length; i++) {
		for (let j = 1; j <= str1.length; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1 // deletion
				);
			}
		}
	}

	return matrix[str2.length][str1.length];
}

/**
 * Extract sections from a plan markdown
 */
export function extractSections(planMarkdown: string): PlanSection[] {
	const sections: PlanSection[] = [];
	const lines = planMarkdown.split('\n');
	let currentSection: PlanSection | null = null;
	let lineNumber = 0;

	for (const line of lines) {
		lineNumber++;

		// Detect section headers (## or ###)
		if (line.startsWith('##')) {
			// Save previous section
			if (currentSection) {
				currentSection.lineRange[1] = lineNumber - 1;
				sections.push(currentSection);
			}

			// Create new section
			const headerLevel = line.match(/^#+/)?.[0].length || 2;
			const title = line.replace(/^#+\s*/, '').trim();
			const type = inferSectionType(title);

			currentSection = {
				id: `section_${sections.length}`,
				type,
				title,
				content: '',
				lineRange: [lineNumber, lineNumber]
			};
		} else if (currentSection) {
			// Add content to current section
			currentSection.content += line + '\n';
		}
	}

	// Save last section
	if (currentSection) {
		currentSection.lineRange[1] = lineNumber;
		sections.push(currentSection);
	}

	return sections;
}

/**
 * Infer section type from title
 */
function inferSectionType(title: string): string {
	const titleLower = title.toLowerCase();

	if (titleLower.includes('overview') || titleLower.includes('summary')) return 'overview';
	if (titleLower.includes('phase') || titleLower.includes('step')) return 'phase';
	if (titleLower.includes('acceptance') || titleLower.includes('criteria'))
		return 'acceptance';
	if (titleLower.includes('risk') || titleLower.includes('challenge')) return 'risks';
	if (titleLower.includes('timeline') || titleLower.includes('schedule')) return 'timeline';
	if (titleLower.includes('resource') || titleLower.includes('team')) return 'resources';
	if (titleLower.includes('technical') || titleLower.includes('architecture'))
		return 'technical';
	if (titleLower.includes('test') || titleLower.includes('qa')) return 'testing';
	if (titleLower.includes('deploy') || titleLower.includes('release')) return 'deployment';

	return 'other';
}

/**
 * Compare two sections and generate diff
 */
export function compareSections(sectionA?: PlanSection, sectionB?: PlanSection): SectionDiff {
	if (!sectionA && !sectionB) {
		throw new Error('At least one section must be provided');
	}

	if (!sectionA) {
		return {
			type: 'added',
			sectionB
		};
	}

	if (!sectionB) {
		return {
			type: 'removed',
			sectionA
		};
	}

	const similarity = calculateSimilarity(sectionA.content, sectionB.content);

	if (similarity === 100) {
		return {
			type: 'unchanged',
			sectionA,
			sectionB,
			similarity
		};
	}

	// Generate content diff
	const linesA = sectionA.content.split('\n');
	const linesB = sectionB.content.split('\n');
	const added: string[] = [];
	const removed: string[] = [];
	const modified: string[] = [];

	// Simple line-by-line diff
	const maxLines = Math.max(linesA.length, linesB.length);
	for (let i = 0; i < maxLines; i++) {
		const lineA = linesA[i] || '';
		const lineB = linesB[i] || '';

		if (lineA === lineB) continue;

		if (!lineA) {
			added.push(lineB);
		} else if (!lineB) {
			removed.push(lineA);
		} else {
			modified.push(`- ${lineA}\n+ ${lineB}`);
		}
	}

	return {
		type: 'changed',
		sectionA,
		sectionB,
		similarity,
		contentDiff: {
			added,
			removed,
			modified
		}
	};
}

/**
 * Calculate combined score for ranking
 * Weights: Quality 50%, Cost 25%, Speed 25%
 */
export function calculateCombinedScore(
	qualityScore: number,
	cost: number,
	durationMs: number,
	maxCost: number,
	maxDuration: number
): number {
	// Normalize cost and duration to 0-100 (inverted - lower is better)
	const costScore = maxCost > 0 ? ((maxCost - cost) / maxCost) * 100 : 50;
	const speedScore = maxDuration > 0 ? ((maxDuration - durationMs) / maxDuration) * 100 : 50;

	// Weighted average
	const combined = qualityScore * 0.5 + costScore * 0.25 + speedScore * 0.25;

	return Math.round(combined);
}
