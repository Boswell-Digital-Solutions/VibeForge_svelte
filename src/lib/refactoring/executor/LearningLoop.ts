/**
 * Learning Loop
 *
 * Integrates with NeuroForge to record outcomes and retrieve recommendations
 */

import type {
	RefactoringOutcome,
	EstimationFeedback,
	RecommendationRequest,
	TaskRecommendation,
	PlanRecommendation,
	LearningMetrics
} from '../types/learning';
import type { CodebaseAnalysis } from '../types/analysis';
import type { AIExecutionMetrics } from '../types/execution';
import { NEUROFORGE_URL } from '$lib/core/api/endpoints';

/**
 * Learning Loop
 *
 * Manages continuous learning from refactoring outcomes
 */
export class LearningLoop {
	private baseUrl: string;
	private enabled: boolean;

	constructor(config?: { baseUrl?: string; enabled?: boolean }) {
		this.baseUrl = config?.baseUrl || `${NEUROFORGE_URL}/api`;
		this.enabled = config?.enabled ?? true;
	}

	/**
	 * Records refactoring outcome to NeuroForge
	 */
	async recordOutcome(outcome: RefactoringOutcome): Promise<void> {
		if (!this.enabled) {
			console.log('[LearningLoop] Recording disabled, skipping outcome');
			return;
		}

		try {
			const response = await fetch(`${this.baseUrl}/learning/outcomes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(outcome)
			});

			if (!response.ok) {
				throw new Error(`Failed to record outcome: ${response.statusText}`);
			}

			console.log(`[LearningLoop] Recorded outcome: ${outcome.id}`);
		} catch (error) {
			console.error('[LearningLoop] Error recording outcome:', error);
			// Don't throw - learning failures shouldn't break execution
		}
	}

	/**
	 * Records estimation feedback to NeuroForge
	 */
	async recordEstimationFeedback(feedback: EstimationFeedback[]): Promise<void> {
		if (!this.enabled || feedback.length === 0) {
			return;
		}

		try {
			const response = await fetch(`${this.baseUrl}/learning/estimation-feedback`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ feedback })
			});

			if (!response.ok) {
				throw new Error(`Failed to record feedback: ${response.statusText}`);
			}

			console.log(`[LearningLoop] Recorded ${feedback.length} estimation feedback entries`);
		} catch (error) {
			console.error('[LearningLoop] Error recording feedback:', error);
		}
	}

	/**
	 * Gets task recommendations from NeuroForge
	 */
	async getTaskRecommendations(
		request: RecommendationRequest
	): Promise<TaskRecommendation[]> {
		if (!this.enabled) {
			return [];
		}

		try {
			const response = await fetch(`${this.baseUrl}/learning/recommendations/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			});

			if (!response.ok) {
				throw new Error(`Failed to get recommendations: ${response.statusText}`);
			}

			const data = await response.json();
			return data.recommendations || [];
		} catch (error) {
			console.error('[LearningLoop] Error getting recommendations:', error);
			return [];
		}
	}

	/**
	 * Gets plan recommendation from NeuroForge
	 */
	async getPlanRecommendation(
		request: RecommendationRequest
	): Promise<PlanRecommendation | null> {
		if (!this.enabled) {
			return null;
		}

		try {
			const response = await fetch(`${this.baseUrl}/learning/recommendations/plan`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			});

			if (!response.ok) {
				throw new Error(`Failed to get plan recommendation: ${response.statusText}`);
			}

			const data = await response.json();
			return data.recommendation || null;
		} catch (error) {
			console.error('[LearningLoop] Error getting plan recommendation:', error);
			return null;
		}
	}

	/**
	 * Gets learning metrics from NeuroForge
	 */
	async getLearningMetrics(): Promise<LearningMetrics | null> {
		if (!this.enabled) {
			return null;
		}

		try {
			const response = await fetch(`${this.baseUrl}/learning/metrics`);

			if (!response.ok) {
				throw new Error(`Failed to get metrics: ${response.statusText}`);
			}

			const data = await response.json();
			return data.metrics || null;
		} catch (error) {
			console.error('[LearningLoop] Error getting metrics:', error);
			return null;
		}
	}

	/**
	 * Converts task recommendations to estimation format
	 */
	convertRecommendationsToEstimates(
		recommendations: TaskRecommendation[]
	): Array<{
		taskPattern: string;
		taskCategory: string;
		suggestedEstimateHours: number;
		confidence: number;
	}> {
		return recommendations.map((rec) => ({
			taskPattern: rec.task.title,
			taskCategory: rec.task.category,
			suggestedEstimateHours: rec.estimate.hours,
			confidence: rec.estimate.confidence
		}));
	}

	/**
	 * Checks if learning is enabled and NeuroForge is available
	 */
	async healthCheck(): Promise<boolean> {
		if (!this.enabled) {
			return false;
		}

		try {
			const response = await fetch(`${this.baseUrl}/health`, {
				method: 'GET',
				signal: AbortSignal.timeout(5000) // 5 second timeout
			});

			return response.ok;
		} catch (error) {
			console.warn('[LearningLoop] NeuroForge health check failed:', error);
			return false;
		}
	}

	/**
	 * Enables/disables learning
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		console.log(`[LearningLoop] Learning ${enabled ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Gets current configuration
	 */
	getConfig(): { baseUrl: string; enabled: boolean } {
		return {
			baseUrl: this.baseUrl,
			enabled: this.enabled
		};
	}

	/**
	 * Records AI execution metrics for analytics
	 * Provides detailed logging and optional separate tracking of AI-specific data
	 */
	async recordAIExecutionMetrics(
		taskId: string,
		metrics: AIExecutionMetrics,
		context?: {
			taskCategory: string;
			taskTitle: string;
			codebaseSize: number;
		}
	): Promise<void> {
		if (!this.enabled) {
			return;
		}

		// Log AI metrics for visibility
		console.log('[LearningLoop] AI Execution Metrics:', {
			taskId,
			executor: metrics.executorType,
			estimatedMinutes: metrics.estimatedMinutes,
			actualMinutes: metrics.actualMinutes,
			accuracy: metrics.actualMinutes
				? `${((metrics.estimatedMinutes / metrics.actualMinutes) * 100).toFixed(1)}%`
				: 'N/A',
			tokens: metrics.totalTokens,
			cost: `$${metrics.actualCost?.toFixed(4) || 'N/A'}`,
			firstPassSuccess: metrics.firstPassSuccess,
			iterations: metrics.iterationCount,
			...context
		});

		// Optionally send to dedicated AI metrics endpoint
		// This allows NeuroForge to track AI performance separately
		try {
			const response = await fetch(`${this.baseUrl}/learning/ai-metrics`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					taskId,
					metrics,
					context,
					recordedAt: new Date().toISOString()
				})
			});

			if (!response.ok) {
				console.warn('[LearningLoop] Failed to record AI metrics (non-critical)');
			}
		} catch (error) {
			// Silent fail - AI metrics recording is supplementary
			console.debug('[LearningLoop] AI metrics endpoint not available (optional feature)');
		}
	}
}
