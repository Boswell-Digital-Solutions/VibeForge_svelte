<script lang="ts">
/**
 * VF-320: Quality Score Card Component
 *
 * Displays quality assessment for a planning session:
 * - Overall score with visual gauge
 * - Individual criterion scores
 * - Strengths and weaknesses
 * - Recommendations
 */

import type { QualityAssessment } from '../types';

interface Props {
	/** Quality assessment to display */
	assessment: QualityAssessment;
	/** Optional title */
	title?: string;
}

let { assessment, title }: Props = $props();

// Get color based on score
function getScoreColor(score: number): string {
	if (score >= 80) return 'text-green-600 dark:text-green-400';
	if (score >= 60) return 'text-blue-600 dark:text-blue-400';
	if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
	return 'text-red-600 dark:text-red-400';
}

// Get background color based on score
function getScoreBg(score: number): string {
	if (score >= 80) return 'bg-green-500';
	if (score >= 60) return 'bg-blue-500';
	if (score >= 40) return 'bg-yellow-500';
	return 'bg-red-500';
}

// Format criterion name
function formatCriterion(criterion: string): string {
	return criterion
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
</script>

<div class="quality-score-card bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
	{#if title}
		<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
			{title}
		</h3>
	{/if}

	<!-- Overall Score -->
	<div class="mb-6">
		<div class="flex items-center justify-between mb-2">
			<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Quality</span>
			<span class="text-2xl font-bold {getScoreColor(assessment.overallScore)}">
				{assessment.overallScore}%
			</span>
		</div>

		<!-- Progress Bar -->
		<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
			<div
				class="h-3 rounded-full transition-all duration-300 {getScoreBg(assessment.overallScore)}"
				style="width: {assessment.overallScore}%"
			></div>
		</div>
	</div>

	<!-- Criterion Scores -->
	<div class="mb-6">
		<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
			Criterion Breakdown
		</h4>
		<div class="space-y-3">
			{#each assessment.criterionScores as criterion}
				<div>
					<div class="flex items-center justify-between mb-1">
						<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
							{formatCriterion(criterion.criterion)}
						</span>
						<span class="text-sm font-semibold {getScoreColor(criterion.score)}">
							{criterion.score}%
						</span>
					</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="h-2 rounded-full {getScoreBg(criterion.score)}"
							style="width: {criterion.score}%"
						></div>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						{criterion.explanation}
					</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Strengths -->
	{#if assessment.strengths.length > 0}
		<div class="mb-4">
			<h4 class="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
				<span>✓</span>
				Strengths
			</h4>
			<ul class="space-y-1">
				{#each assessment.strengths as strength}
					<li class="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
						<span class="text-green-600 dark:text-green-400 mt-0.5">•</span>
						<span>{strength}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Weaknesses -->
	{#if assessment.weaknesses.length > 0}
		<div class="mb-4">
			<h4 class="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
				<span>⚠</span>
				Weaknesses
			</h4>
			<ul class="space-y-1">
				{#each assessment.weaknesses as weakness}
					<li class="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
						<span class="text-red-600 dark:text-red-400 mt-0.5">•</span>
						<span>{weakness}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Recommendations -->
	{#if assessment.recommendations.length > 0}
		<div>
			<h4 class="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
				<span>💡</span>
				Recommendations
			</h4>
			<ul class="space-y-1">
				{#each assessment.recommendations as recommendation}
					<li class="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
						<span class="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
						<span>{recommendation}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.quality-score-card {
		@apply min-h-0;
	}
</style>
