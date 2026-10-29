<script lang="ts">
/**
 * VF-320: Plan Comparison View Component
 *
 * Main component for displaying plan comparisons:
 * - Two-way side-by-side comparison
 * - Multi-way comparison with rankings
 * - Quality scores, metrics, section diffs
 * - Export functionality
 */

import type { PlanComparison, MultiPlanComparison } from '../types';
import { comparisonStore } from '../stores';
import QualityScoreCard from './QualityScoreCard.svelte';
import SectionDiffView from './SectionDiffView.svelte';
import MetricsComparison from './MetricsComparison.svelte';

interface Props {
	/** Show export button */
	showExport?: boolean;
}

let { showExport = true }: Props = $props();

// Subscribe to store
const comparison = $derived(comparisonStore.currentComparison);
const isExporting = $derived(comparisonStore.isExporting);
const error = $derived(comparisonStore.error);

// Determine comparison type
const isTwoWay = $derived(comparison && 'sessionA' in comparison);
const isMultiWay = $derived(comparison && 'sessions' in comparison);

// Active tab for two-way comparison
let activeTab = $state<'overview' | 'quality' | 'sections' | 'metrics'>('overview');

// Handle export
async function handleExport(format: 'markdown' | 'json' | 'html') {
	try {
		const content = await comparisonStore.exportComparison(format);

		// Create download
		const blob = new Blob([content], {
			type: format === 'json' ? 'application/json' : 'text/plain'
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `comparison_${Date.now()}.${format === 'html' ? 'html' : format === 'json' ? 'json' : 'md'}`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (err) {
		console.error('Export failed:', err);
	}
}

// Handle close
function handleClose() {
	comparisonStore.clearCurrentComparison();
}
</script>

{#if !comparison}
	<!-- Empty State -->
	<div class="flex flex-col items-center justify-center h-full p-8 text-center">
		<span class="text-6xl mb-4">📊</span>
		<h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
			No Comparison Selected
		</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 max-w-md">
			Create a comparison from the planning sessions to see detailed analysis, quality scores, and recommendations.
		</p>
	</div>
{:else if isTwoWay}
	<!-- Two-Way Comparison -->
	{@const comp = comparison as PlanComparison}
	<div class="plan-comparison-view h-full flex flex-col bg-gray-50 dark:bg-gray-900">
		<!-- Header -->
		<div class="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
						{comp.title}
					</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Created {comp.createdAt.toLocaleString()}
					</p>
				</div>

				<div class="flex items-center gap-2">
					{#if showExport}
						<div class="flex gap-1">
							<button
								onclick={() => handleExport('markdown')}
								disabled={isExporting}
								class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
								title="Export as Markdown"
							>
								📄 MD
							</button>
							<button
								onclick={() => handleExport('json')}
								disabled={isExporting}
								class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
								title="Export as JSON"
							>
								{'{}'} JSON
							</button>
							<button
								onclick={() => handleExport('html')}
								disabled={isExporting}
								class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
								title="Export as HTML"
							>
								🌐 HTML
							</button>
						</div>
					{/if}

					<button
						onclick={handleClose}
						class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
					>
						✕ Close
					</button>
				</div>
			</div>

			<!-- Winner Badge -->
			{#if comp.winner}
				{@const winnerSession = comp.winner.sessionId === comp.sessionA.id ? comp.sessionA : comp.sessionB}
				<div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
					<div class="flex items-center gap-2">
						<span class="text-green-600 dark:text-green-400 text-lg">🏆</span>
						<div>
							<span class="font-medium text-green-800 dark:text-green-300">
								Recommended: {winnerSession.title}
							</span>
							<span class="text-sm text-green-600 dark:text-green-400 ml-2">
								({comp.winner.reason} • {comp.winner.score}% score)
							</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Error Display -->
			{#if error}
				<div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
					<p class="text-red-700 dark:text-red-400 text-sm">{error}</p>
				</div>
			{/if}
		</div>

		<!-- Tabs -->
		<div class="px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
			<div class="flex gap-4">
				<button
					onclick={() => (activeTab = 'overview')}
					class="px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'overview'
						? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
						: 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
				>
					Overview
				</button>
				<button
					onclick={() => (activeTab = 'quality')}
					class="px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'quality'
						? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
						: 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
				>
					Quality Scores
				</button>
				<button
					onclick={() => (activeTab = 'sections')}
					class="px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'sections'
						? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
						: 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
				>
					Section Diffs ({comp.sectionDiffs.length})
				</button>
				<button
					onclick={() => (activeTab = 'metrics')}
					class="px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'metrics'
						? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
						: 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
				>
					Metrics
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			{#if activeTab === 'overview'}
				<!-- Overview: Side-by-side session info -->
				<div class="grid grid-cols-2 gap-6">
					<!-- Session A -->
					<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
						<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
							{comp.sessionA.title}
						</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Pipeline:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.sessionA.pipeline.type}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Status:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.sessionA.status}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Stages:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.metricsComparison.sessionA.stageCount}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Quality:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.qualityScores.sessionA.overallScore}%
								</span>
							</div>
						</div>
					</div>

					<!-- Session B -->
					<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
						<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
							{comp.sessionB.title}
						</h3>
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Pipeline:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.sessionB.pipeline.type}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Status:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.sessionB.status}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Stages:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.metricsComparison.sessionB.stageCount}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600 dark:text-gray-400">Quality:</span>
								<span class="font-medium text-gray-800 dark:text-gray-200">
									{comp.qualityScores.sessionB.overallScore}%
								</span>
							</div>
						</div>
					</div>
				</div>
			{:else if activeTab === 'quality'}
				<!-- Quality Scores -->
				<div class="grid grid-cols-2 gap-6">
					<QualityScoreCard
						assessment={comp.qualityScores.sessionA}
						title={comp.sessionA.title}
					/>
					<QualityScoreCard
						assessment={comp.qualityScores.sessionB}
						title={comp.sessionB.title}
					/>
				</div>
			{:else if activeTab === 'sections'}
				<!-- Section Diffs -->
				<SectionDiffView diffs={comp.sectionDiffs} />
			{:else if activeTab === 'metrics'}
				<!-- Metrics Comparison -->
				<MetricsComparison comparison={comp.metricsComparison} />
			{/if}
		</div>
	</div>
{:else if isMultiWay}
	<!-- Multi-Way Comparison -->
	{@const comp = comparison as MultiPlanComparison}
	<div class="plan-comparison-view h-full flex flex-col bg-gray-50 dark:bg-gray-900">
		<!-- Header -->
		<div class="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
						{comp.title}
					</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Comparing {comp.sessions.length} sessions • Created {comp.createdAt.toLocaleString()}
					</p>
				</div>

				<button
					onclick={handleClose}
					class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
				>
					✕ Close
				</button>
			</div>
		</div>

		<!-- Content: Rankings Table -->
		<div class="flex-1 overflow-y-auto p-6">
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-900">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Session
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Pipeline
							</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Quality
							</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Cost
							</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Duration
							</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Tokens
							</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
						{#each comp.metricsTable as metric}
							{@const session = comp.sessions.find(s => s.id === metric.sessionId)}
							{@const isWinner = comp.rankings.byCombined[0] === metric.sessionId}
							<tr class={isWinner ? 'bg-green-50 dark:bg-green-900/20' : ''}>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center">
										{#if isWinner}
											<span class="mr-2">🏆</span>
										{/if}
										<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
											{session?.title || metric.sessionId}
										</span>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
									{metric.pipeline}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
									{metric.qualityScore}%
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
									${metric.totalCost.toFixed(4)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
									{(metric.durationMs / 1000).toFixed(1)}s
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
									{metric.totalTokens.toLocaleString()}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Rankings -->
			<div class="grid grid-cols-4 gap-4 mt-6">
				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
						By Quality
					</h4>
					<ol class="space-y-2 text-sm">
						{#each comp.rankings.byQuality.slice(0, 3) as sessionId, index}
							{@const session = comp.sessions.find(s => s.id === sessionId)}
							<li class="flex items-center gap-2">
								<span class="text-gray-500 dark:text-gray-400">{index + 1}.</span>
								<span class="text-gray-800 dark:text-gray-200 truncate">
									{session?.title || sessionId}
								</span>
							</li>
						{/each}
					</ol>
				</div>

				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
						By Cost
					</h4>
					<ol class="space-y-2 text-sm">
						{#each comp.rankings.byCost.slice(0, 3) as sessionId, index}
							{@const session = comp.sessions.find(s => s.id === sessionId)}
							<li class="flex items-center gap-2">
								<span class="text-gray-500 dark:text-gray-400">{index + 1}.</span>
								<span class="text-gray-800 dark:text-gray-200 truncate">
									{session?.title || sessionId}
								</span>
							</li>
						{/each}
					</ol>
				</div>

				<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
					<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
						By Speed
					</h4>
					<ol class="space-y-2 text-sm">
						{#each comp.rankings.bySpeed.slice(0, 3) as sessionId, index}
							{@const session = comp.sessions.find(s => s.id === sessionId)}
							<li class="flex items-center gap-2">
								<span class="text-gray-500 dark:text-gray-400">{index + 1}.</span>
								<span class="text-gray-800 dark:text-gray-200 truncate">
									{session?.title || sessionId}
								</span>
							</li>
						{/each}
					</ol>
				</div>

				<div class="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-4 bg-green-50 dark:bg-green-900/20">
					<h4 class="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">
						🏆 Combined
					</h4>
					<ol class="space-y-2 text-sm">
						{#each comp.rankings.byCombined.slice(0, 3) as sessionId, index}
							{@const session = comp.sessions.find(s => s.id === sessionId)}
							<li class="flex items-center gap-2">
								<span class="text-green-600 dark:text-green-400">{index + 1}.</span>
								<span class="text-green-800 dark:text-green-200 font-medium truncate">
									{session?.title || sessionId}
								</span>
							</li>
						{/each}
					</ol>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.plan-comparison-view {
		@apply min-h-full;
	}

	.truncate {
		max-width: 150px;
	}
</style>
