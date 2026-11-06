<script lang="ts">
/**
 * VF-320: Metrics Comparison Component
 *
 * Displays side-by-side metrics comparison:
 * - Total tokens, cost, duration, stages
 * - Delta indicators (▲ ▼) with color coding
 * - Visual bars for comparison
 * - Percentage differences
 */

import type { PlanComparison } from '../types/planComparison';

interface Props {
	/** Metrics comparison data */
	comparison: PlanComparison['metricsComparison'];
	/** Show visual bars (default: true) */
	showBars?: boolean;
}

let { comparison, showBars = true }: Props = $props();

/**
 * Format duration in ms to human-readable string
 */
function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format cost to USD with 2 decimals
 */
function formatCost(cost: number): string {
	return `$${cost.toFixed(4)}`;
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Get delta color class (green=better, red=worse)
 * For tokens and cost: lower is better
 * For duration: lower is better
 * For stages: neutral (gray)
 */
function getDeltaColor(diff: number, metric: 'tokens' | 'cost' | 'duration' | 'stages'): string {
	if (diff === 0) return 'text-gray-500';

	if (metric === 'stages') {
		// Stages: neutral indicator
		return 'text-gray-600';
	}

	// For tokens, cost, duration: negative diff means Session A is better (lower)
	if (diff < 0) {
		return 'text-green-600 dark:text-green-400';
	} else {
		return 'text-red-600 dark:text-red-400';
	}
}

/**
 * Get delta icon (▲ worse, ▼ better, = equal)
 */
function getDeltaIcon(diff: number, metric: 'tokens' | 'cost' | 'duration' | 'stages'): string {
	if (diff === 0) return '=';

	if (metric === 'stages') {
		// Stages: just show direction
		return diff > 0 ? '▲' : '▼';
	}

	// For tokens, cost, duration: negative diff means Session A is better
	if (diff < 0) {
		return '▼'; // Session A has less (better)
	} else {
		return '▲'; // Session A has more (worse)
	}
}

/**
 * Calculate percentage difference
 */
function calculatePercentage(diff: number, base: number): string {
	if (base === 0) return '0%';
	const pct = Math.abs((diff / base) * 100);
	return `${pct.toFixed(1)}%`;
}

/**
 * Get bar width percentage for visual comparison
 */
function getBarWidth(value: number, max: number): number {
	if (max === 0) return 0;
	return (value / max) * 100;
}

// Calculate max values for bar scaling
const maxTokens = Math.max(comparison.sessionA.totalTokens, comparison.sessionB.totalTokens);
const maxCost = Math.max(comparison.sessionA.totalCost, comparison.sessionB.totalCost);
const maxDuration = Math.max(comparison.sessionA.durationMs, comparison.sessionB.durationMs);
</script>

<div class="metrics-comparison space-y-6">
	<!-- Metrics Table -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
		<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
			Metrics Comparison
		</h3>

		<div class="space-y-4">
			<!-- Total Tokens -->
			<div class="metric-row">
				<div class="metric-label">
					<span class="text-xs font-medium text-gray-600 dark:text-gray-400">Total Tokens</span>
				</div>

				<div class="metric-values grid grid-cols-3 gap-4 items-center">
					<!-- Session A -->
					<div class="text-right">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{formatNumber(comparison.sessionA.totalTokens)}
						</div>
						{#if showBars}
							<div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									class="h-2 rounded-full bg-blue-500"
									style="width: {getBarWidth(comparison.sessionA.totalTokens, maxTokens)}%"
								></div>
							</div>
						{/if}
					</div>

					<!-- Delta -->
					<div class="text-center">
						<span
							class="text-xs font-mono {getDeltaColor(
								comparison.differences.tokenDiff,
								'tokens'
							)}"
						>
							{getDeltaIcon(comparison.differences.tokenDiff, 'tokens')}
							{formatNumber(Math.abs(comparison.differences.tokenDiff))}
						</span>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{calculatePercentage(
								comparison.differences.tokenDiff,
								comparison.sessionB.totalTokens
							)}
						</div>
					</div>

					<!-- Session B -->
					<div class="text-left">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{formatNumber(comparison.sessionB.totalTokens)}
						</div>
						{#if showBars}
							<div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									class="h-2 rounded-full bg-purple-500"
									style="width: {getBarWidth(comparison.sessionB.totalTokens, maxTokens)}%"
								></div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Total Cost -->
			<div class="metric-row">
				<div class="metric-label">
					<span class="text-xs font-medium text-gray-600 dark:text-gray-400">Total Cost</span>
				</div>

				<div class="metric-values grid grid-cols-3 gap-4 items-center">
					<!-- Session A -->
					<div class="text-right">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{formatCost(comparison.sessionA.totalCost)}
						</div>
						{#if showBars}
							<div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									class="h-2 rounded-full bg-blue-500"
									style="width: {getBarWidth(comparison.sessionA.totalCost, maxCost)}%"
								></div>
							</div>
						{/if}
					</div>

					<!-- Delta -->
					<div class="text-center">
						<span
							class="text-xs font-mono {getDeltaColor(comparison.differences.costDiff, 'cost')}"
						>
							{getDeltaIcon(comparison.differences.costDiff, 'cost')}
							{formatCost(Math.abs(comparison.differences.costDiff))}
						</span>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{calculatePercentage(comparison.differences.costDiff, comparison.sessionB.totalCost)}
						</div>
					</div>

					<!-- Session B -->
					<div class="text-left">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{formatCost(comparison.sessionB.totalCost)}
						</div>
						{#if showBars}
							<div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									class="h-2 rounded-full bg-purple-500"
									style="width: {getBarWidth(comparison.sessionB.totalCost, maxCost)}%"
								></div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Duration -->
			<div class="metric-row">
				<div class="metric-label">
					<span class="text-xs font-medium text-gray-600 dark:text-gray-400">Duration</span>
				</div>

				<div class="metric-values grid grid-cols-3 gap-4 items-center">
					<!-- Session A -->
					<div class="text-right">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{formatDuration(comparison.sessionA.durationMs)}
						</div>
						{#if showBars}
							<div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									class="h-2 rounded-full bg-blue-500"
									style="width: {getBarWidth(comparison.sessionA.durationMs, maxDuration)}%"
								></div>
							</div>
						{/if}
					</div>

					<!-- Delta -->
					<div class="text-center">
						<span
							class="text-xs font-mono {getDeltaColor(
								comparison.differences.durationDiff,
								'duration'
							)}"
						>
							{getDeltaIcon(comparison.differences.durationDiff, 'duration')}
							{formatDuration(Math.abs(comparison.differences.durationDiff))}
						</span>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{calculatePercentage(
								comparison.differences.durationDiff,
								comparison.sessionB.durationMs
							)}
						</div>
					</div>

					<!-- Session B -->
					<div class="text-left">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{formatDuration(comparison.sessionB.durationMs)}
						</div>
						{#if showBars}
							<div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
								<div
									class="h-2 rounded-full bg-purple-500"
									style="width: {getBarWidth(comparison.sessionB.durationMs, maxDuration)}%"
								></div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Stage Count -->
			<div class="metric-row">
				<div class="metric-label">
					<span class="text-xs font-medium text-gray-600 dark:text-gray-400">Stages</span>
				</div>

				<div class="metric-values grid grid-cols-3 gap-4 items-center">
					<!-- Session A -->
					<div class="text-right">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{comparison.sessionA.stageCount}
						</div>
					</div>

					<!-- Delta -->
					<div class="text-center">
						<span
							class="text-xs font-mono {getDeltaColor(
								comparison.differences.stageDiff,
								'stages'
							)}"
						>
							{getDeltaIcon(comparison.differences.stageDiff, 'stages')}
							{Math.abs(comparison.differences.stageDiff)}
						</span>
					</div>

					<!-- Session B -->
					<div class="text-left">
						<div class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							{comparison.sessionB.stageCount}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Summary Legend -->
	<div class="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
		<div class="flex items-center justify-center gap-6 text-xs">
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded bg-blue-500"></div>
				<span class="text-gray-600 dark:text-gray-400">Session A</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded bg-purple-500"></div>
				<span class="text-gray-600 dark:text-gray-400">Session B</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-green-600 dark:text-green-400">▼</span>
				<span class="text-gray-600 dark:text-gray-400">Better (Lower)</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-red-600 dark:text-red-400">▲</span>
				<span class="text-gray-600 dark:text-gray-400">Worse (Higher)</span>
			</div>
		</div>
	</div>
</div>

<style>
	.metric-row {
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-gray-100);
	}

	.metric-row:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	:global(.dark) .metric-row {
		border-bottom-color: var(--color-gray-700);
	}
</style>
