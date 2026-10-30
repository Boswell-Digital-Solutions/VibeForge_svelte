/**
 * VF-320: Plan Comparison Store
 *
 * Svelte 5 runes store for managing plan comparisons:
 * - Create two-way and multi-way comparisons
 * - Store comparison history
 * - Export comparison reports
 * - localStorage persistence
 */

import type {
	PlanningSession,
	PlanComparison,
	MultiPlanComparison,
	QualityAssessment,
	ComparisonReport,
	ExportFormat
} from '../types';
import { calculateCombinedScore } from '../types';
import { planComparisonService } from '../services/planComparisonService';

/**
 * Comparison Store State
 */
interface ComparisonState {
	/** Current comparison being viewed */
	currentComparison: PlanComparison | MultiPlanComparison | null;
	/** Comparison history (stored locally) */
	comparisonHistory: Array<PlanComparison | MultiPlanComparison>;
	/** Is generating comparison? */
	isComparing: boolean;
	/** Is exporting report? */
	isExporting: boolean;
	/** Error message */
	error: string | null;
}

const STORAGE_KEY = 'vibeforge-plan-comparisons';
const MAX_HISTORY = 20;

// Helper to load from localStorage
function loadFromStorage(): Array<PlanComparison | MultiPlanComparison> {
	if (typeof window === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];

		const parsed = JSON.parse(stored);

		// Convert date strings back to Date objects
		return parsed.map((comp: any) => ({
			...comp,
			createdAt: new Date(comp.createdAt),
			sessionA: comp.sessionA ? deserializeSession(comp.sessionA) : undefined,
			sessionB: comp.sessionB ? deserializeSession(comp.sessionB) : undefined,
			sessions: comp.sessions ? comp.sessions.map(deserializeSession) : undefined,
			qualityScores: comp.qualityScores
				? deserializeQualityScores(comp.qualityScores)
				: undefined
		}));
	} catch (err) {
		console.error('Failed to load comparisons from localStorage:', err);
		return [];
	}
}

// Helper to save to localStorage
function saveToStorage(comparisons: Array<PlanComparison | MultiPlanComparison>): void {
	if (typeof window === 'undefined') return;
	try {
		// Limit to MAX_HISTORY
		const limited = comparisons.slice(0, MAX_HISTORY);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
	} catch (err) {
		console.error('Failed to save comparisons to localStorage:', err);
	}
}

// Helper to deserialize session dates
function deserializeSession(session: any): PlanningSession {
	return {
		...session,
		createdAt: new Date(session.createdAt),
		startedAt: session.startedAt ? new Date(session.startedAt) : null,
		completedAt: session.completedAt ? new Date(session.completedAt) : null,
		stages: session.stages.map((stage: any) => ({
			...stage,
			startedAt: stage.startedAt ? new Date(stage.startedAt) : null,
			completedAt: stage.completedAt ? new Date(stage.completedAt) : null
		}))
	};
}

// Helper to deserialize quality scores
function deserializeQualityScores(scores: any): any {
	if (scores.sessionA && scores.sessionB) {
		// Two-way comparison
		return {
			sessionA: {
				...scores.sessionA,
				scoredAt: new Date(scores.sessionA.scoredAt)
			},
			sessionB: {
				...scores.sessionB,
				scoredAt: new Date(scores.sessionB.scoredAt)
			}
		};
	} else {
		// Multi-way comparison (Map)
		const map = new Map();
		Object.entries(scores).forEach(([key, value]: [string, any]) => {
			map.set(key, {
				...value,
				scoredAt: new Date(value.scoredAt)
			});
		});
		return map;
	}
}

// Initialize state
const state = $state<ComparisonState>({
	currentComparison: null,
	comparisonHistory: loadFromStorage(),
	isComparing: false,
	isExporting: false,
	error: null
});

/**
 * Create two-way comparison
 */
function createTwoWayComparison(
	sessionA: PlanningSession,
	sessionB: PlanningSession,
	title?: string
): void {
	state.isComparing = true;
	state.error = null;

	try {
		const comparison = planComparisonService.comparePlans(sessionA, sessionB, title);

		// Set as current
		state.currentComparison = comparison;

		// Add to history
		state.comparisonHistory = [comparison, ...state.comparisonHistory].slice(0, MAX_HISTORY);

		// Save to localStorage
		saveToStorage(state.comparisonHistory);

		state.isComparing = false;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to create comparison';
		state.isComparing = false;
	}
}

/**
 * Create multi-way comparison (3+ sessions)
 */
function createMultiWayComparison(sessions: PlanningSession[], title: string): void {
	if (sessions.length < 3) {
		state.error = 'Multi-way comparison requires at least 3 sessions';
		return;
	}

	state.isComparing = true;
	state.error = null;

	try {
		const compId = `multicomp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Score all sessions
		const qualityScores = new Map<string, QualityAssessment>();
		for (const session of sessions) {
			const score = planComparisonService.scoreQuality(session);
			qualityScores.set(session.id, score);
		}

		// Generate pairwise diffs (for now, just compare with first session)
		const pairwiseDiffs = new Map<string, any[]>();
		// TODO: Implement pairwise diff generation

		// Build metrics table
		const metricsTable = sessions.map((session) => {
			const quality = qualityScores.get(session.id);
			const duration =
				session.completedAt && session.startedAt
					? session.completedAt.getTime() - session.startedAt.getTime()
					: 0;

			return {
				sessionId: session.id,
				pipeline: session.pipeline.type,
				totalTokens: session.totalTokens,
				totalCost: session.totalCost,
				durationMs: duration,
				qualityScore: quality?.overallScore || 0
			};
		});

		// Calculate rankings
		const byQuality = [...sessions]
			.sort((a, b) => {
				const scoreA = qualityScores.get(a.id)?.overallScore || 0;
				const scoreB = qualityScores.get(b.id)?.overallScore || 0;
				return scoreB - scoreA;
			})
			.map((s) => s.id);

		const byCost = [...sessions]
			.sort((a, b) => a.totalCost - b.totalCost)
			.map((s) => s.id);

		const bySpeed = [...sessions]
			.sort((a, b) => {
				const durationA =
					a.completedAt && a.startedAt
						? a.completedAt.getTime() - a.startedAt.getTime()
						: Infinity;
				const durationB =
					b.completedAt && b.startedAt
						? b.completedAt.getTime() - b.startedAt.getTime()
						: Infinity;
				return durationA - durationB;
			})
			.map((s) => s.id);

		// Combined ranking (weighted score)
		const maxCost = Math.max(...sessions.map((s) => s.totalCost));
		const maxDuration = Math.max(
			...sessions.map((s) => {
				return s.completedAt && s.startedAt
					? s.completedAt.getTime() - s.startedAt.getTime()
					: 0;
			})
		);

		const byCombined = [...sessions]
			.map((session) => {
				const quality = qualityScores.get(session.id)?.overallScore || 0;
				const duration =
					session.completedAt && session.startedAt
						? session.completedAt.getTime() - session.startedAt.getTime()
						: 0;

				const score = calculateCombinedScore(
					quality,
					session.totalCost,
					duration,
					maxCost,
					maxDuration
				);

				return { id: session.id, score };
			})
			.sort((a, b) => b.score - a.score)
			.map((s) => s.id);

		const comparison: MultiPlanComparison = {
			id: compId,
			title,
			sessions,
			qualityScores,
			pairwiseDiffs,
			metricsTable,
			rankings: {
				byQuality,
				byCost,
				bySpeed,
				byCombined
			},
			createdAt: new Date()
		};

		// Set as current
		state.currentComparison = comparison;

		// Add to history
		state.comparisonHistory = [comparison, ...state.comparisonHistory].slice(0, MAX_HISTORY);

		// Save to localStorage
		saveToStorage(state.comparisonHistory);

		state.isComparing = false;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to create multi-way comparison';
		state.isComparing = false;
	}
}

/**
 * Load comparison from history
 */
function loadComparison(comparisonId: string): void {
	const comparison = state.comparisonHistory.find((c) => c.id === comparisonId);
	if (comparison) {
		state.currentComparison = comparison;
		state.error = null;
	} else {
		state.error = 'Comparison not found';
	}
}

/**
 * Delete comparison from history
 */
function deleteComparison(comparisonId: string): void {
	state.comparisonHistory = state.comparisonHistory.filter((c) => c.id !== comparisonId);

	// Clear current if it's the deleted one
	if (state.currentComparison?.id === comparisonId) {
		state.currentComparison = null;
	}

	// Save to localStorage
	saveToStorage(state.comparisonHistory);
}

/**
 * Clear current comparison
 */
function clearCurrentComparison(): void {
	state.currentComparison = null;
	state.error = null;
}

/**
 * Clear all comparison history
 */
function clearAllComparisons(): void {
	state.comparisonHistory = [];
	state.currentComparison = null;

	// Remove the key rather than persisting an empty array, so a cleared
	// history leaves nothing behind.
	if (typeof window !== 'undefined') {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch (err) {
			console.error('Failed to clear comparisons from localStorage:', err);
		}
	}
}

/**
 * Export comparison as report
 */
async function exportComparison(format: ExportFormat): Promise<string> {
	if (!state.currentComparison) {
		throw new Error('No comparison to export');
	}

	state.isExporting = true;
	state.error = null;

	try {
		const report = generateComparisonReport(state.currentComparison, format);

		// Format based on export type
		let content: string;

		switch (format) {
			case 'markdown':
				content = formatAsMarkdown(report);
				break;
			case 'json':
				content = JSON.stringify(report, null, 2);
				break;
			case 'html':
				content = formatAsHtml(report);
				break;
			case 'pdf':
				// PDF generation would require additional library
				content = formatAsMarkdown(report);
				break;
			default:
				content = formatAsMarkdown(report);
		}

		state.isExporting = false;
		return content;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to export comparison';
		state.isExporting = false;
		throw err;
	}
}

/**
 * Generate comparison report
 */
function generateComparisonReport(
	comparison: PlanComparison | MultiPlanComparison,
	format: ExportFormat
): ComparisonReport {
	const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	// Determine if two-way or multi-way
	const isTwoWay = 'sessionA' in comparison;

	// Generate executive summary
	let summary: ComparisonReport['summary'];

	if (isTwoWay) {
		const comp = comparison as PlanComparison;
		const totalSessions = 2;
		const recommended = comp.winner?.sessionId || null;

		const keyFindings = [
			`Quality: Session A scored ${comp.qualityScores.sessionA.overallScore}%, Session B scored ${comp.qualityScores.sessionB.overallScore}%`,
			`Cost: Session A $${comp.metricsComparison.sessionA.totalCost.toFixed(4)}, Session B $${comp.metricsComparison.sessionB.totalCost.toFixed(4)}`,
			`Duration: Session A ${(comp.metricsComparison.sessionA.durationMs / 1000).toFixed(1)}s, Session B ${(comp.metricsComparison.sessionB.durationMs / 1000).toFixed(1)}s`
		];

		summary = {
			totalSessionsCompared: totalSessions,
			recommendedSession: recommended,
			keyFindings,
			quickStats: {
				avgCost:
					(comp.metricsComparison.sessionA.totalCost +
						comp.metricsComparison.sessionB.totalCost) /
					2,
				avgDuration:
					(comp.metricsComparison.sessionA.durationMs +
						comp.metricsComparison.sessionB.durationMs) /
					2,
				avgQualityScore:
					(comp.qualityScores.sessionA.overallScore +
						comp.qualityScores.sessionB.overallScore) /
					2
			}
		};
	} else {
		const comp = comparison as MultiPlanComparison;
		const totalSessions = comp.sessions.length;
		const recommended = comp.rankings.byCombined[0] || null;

		const avgCost =
			comp.metricsTable.reduce((sum, m) => sum + m.totalCost, 0) / totalSessions;
		const avgDuration =
			comp.metricsTable.reduce((sum, m) => sum + m.durationMs, 0) / totalSessions;
		const avgQuality =
			comp.metricsTable.reduce((sum, m) => sum + m.qualityScore, 0) / totalSessions;

		const keyFindings = [
			`Best quality: ${comp.rankings.byQuality[0]}`,
			`Lowest cost: ${comp.rankings.byCost[0]}`,
			`Fastest: ${comp.rankings.bySpeed[0]}`,
			`Best overall: ${comp.rankings.byCombined[0]}`
		];

		summary = {
			totalSessionsCompared: totalSessions,
			recommendedSession: recommended,
			keyFindings,
			quickStats: {
				avgCost,
				avgDuration,
				avgQualityScore: avgQuality
			}
		};
	}

	return {
		id: reportId,
		title: comparison.title,
		type: isTwoWay ? 'two-way' : 'multi-way',
		summary,
		comparisonData: comparison,
		generatedAt: new Date(),
		format
	};
}

/**
 * Format report as Markdown
 */
function formatAsMarkdown(report: ComparisonReport): string {
	let md = `# Plan Comparison\n\n## ${report.title}\n\n`;
	md += `**Generated:** ${report.generatedAt.toLocaleString()}\n\n`;

	// Executive Summary
	md += `## Executive Summary\n\n`;
	md += `- **Sessions Compared:** ${report.summary.totalSessionsCompared}\n`;
	md += `- **Recommended:** ${report.summary.recommendedSession || 'No clear winner'}\n`;
	md += `- **Average Quality Score:** ${report.summary.quickStats.avgQualityScore.toFixed(1)}%\n`;
	md += `- **Average Cost:** $${report.summary.quickStats.avgCost.toFixed(4)}\n`;
	md += `- **Average Duration:** ${(report.summary.quickStats.avgDuration / 1000).toFixed(1)}s\n\n`;

	// Key Findings
	md += `### Key Findings\n\n`;
	report.summary.keyFindings.forEach((finding) => {
		md += `- ${finding}\n`;
	});

	md += `\n---\n\n`;

	// Full comparison data (simplified)
	md += `## Detailed Comparison\n\n`;
	md += `*See JSON export for complete comparison data*\n\n`;

	return md;
}

/**
 * Format report as HTML
 */
function formatAsHtml(report: ComparisonReport): string {
	const md = formatAsMarkdown(report);
	// Simple markdown-to-HTML conversion
	let html = md
		.replace(/^# (.+)$/gm, '<h1>$1</h1>')
		.replace(/^## (.+)$/gm, '<h2>$1</h2>')
		.replace(/^### (.+)$/gm, '<h3>$1</h3>')
		.replace(/^\* (.+)$/gm, '<li>$1</li>')
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>${report.title}</title>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
		h1 { color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
		h2 { color: #374151; margin-top: 30px; }
		h3 { color: #6b7280; }
		li { margin: 5px 0; }
		hr { border: none; border-top: 1px solid #e5e7eb; margin: 30px 0; }
	</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Export the store
 */
export const comparisonStore = {
	// State
	get currentComparison() {
		return state.currentComparison;
	},
	get comparisonHistory() {
		return state.comparisonHistory;
	},
	get isComparing() {
		return state.isComparing;
	},
	get isExporting() {
		return state.isExporting;
	},
	get error() {
		return state.error;
	},

	// Actions
	createTwoWayComparison,
	createMultiWayComparison,
	loadComparison,
	deleteComparison,
	clearCurrentComparison,
	clearAllComparisons,
	exportComparison
};
