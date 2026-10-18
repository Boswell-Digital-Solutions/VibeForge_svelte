<script lang="ts">
/**
 * VF-321: Version Diff View Component
 *
 * Displays differences between two plan versions:
 * - Side-by-side comparison of metadata
 * - Section-level diffs (added/removed/changed)
 * - Token and cost differences
 * - Refinement requirements comparison
 */

import { planningStore } from '../stores/planning.svelte';
import SectionDiffView from './SectionDiffView.svelte';
import type { PlanDiff } from '../types';

interface Props {
	/** Version A (older) */
	versionA: number;
	/** Version B (newer) */
	versionB: number;
	/** Called when diff view is closed */
	onClose?: () => void;
}

let { versionA, versionB, onClose }: Props = $props();

// Compute diff
const diff = $derived.by(() => {
	return planningStore.compareVersions(versionA, versionB);
});

// Get version details
const versionAData = $derived.by(() => {
	const history = planningStore.versionHistory;
	return history.find((v) => v.version === versionA);
});

const versionBData = $derived.by(() => {
	const history = planningStore.versionHistory;
	return history.find((v) => v.version === versionB);
});

/**
 * Format number with sign
 */
function formatDelta(value: number): string {
	if (value > 0) return `+${value.toLocaleString()}`;
	if (value < 0) return value.toLocaleString();
	return '0';
}

/**
 * Format cost delta
 */
function formatCostDelta(value: number): string {
	if (value > 0) return `+$${value.toFixed(4)}`;
	if (value < 0) return `-$${Math.abs(value).toFixed(4)}`;
	return '$0.0000';
}

/**
 * Get delta color class
 */
function getDeltaClass(value: number, invertColors: boolean = false): string {
	if (value === 0) return 'neutral';
	if (invertColors) {
		return value > 0 ? 'negative' : 'positive';
	}
	return value > 0 ? 'positive' : 'negative';
}
</script>

{#if diff && versionAData && versionBData}
	<div class="version-diff-view">
		<!-- Header -->
		<div class="diff-header">
			<div class="header-content">
				<h3 class="diff-title">Version Comparison</h3>
				<p class="diff-summary">{diff.summary}</p>
			</div>

			{#if onClose}
				<button class="close-button" onclick={onClose} title="Close diff view">
					<span class="close-icon">×</span>
				</button>
			{/if}
		</div>

		<!-- Version Headers -->
		<div class="version-headers">
			<div class="version-header version-a">
				<div class="version-label">Version {versionA}</div>
				<div class="version-date">
					{versionAData.createdAt.toLocaleDateString()}
				</div>
			</div>

			<div class="version-divider">→</div>

			<div class="version-header version-b">
				<div class="version-label">Version {versionB}</div>
				<div class="version-date">
					{versionBData.createdAt.toLocaleDateString()}
				</div>
			</div>
		</div>

		<!-- Metrics Comparison -->
		<div class="metrics-comparison">
			<h4 class="section-title">Metrics Comparison</h4>

			<div class="metrics-grid">
				<!-- Tokens -->
				<div class="metric-card">
					<div class="metric-header">
						<span class="metric-icon">🔢</span>
						<span class="metric-name">Tokens</span>
					</div>
					<div class="metric-values">
						<div class="metric-value-row">
							<span class="value-label">v{versionA}:</span>
							<span class="value-number">{versionAData.totalTokens.toLocaleString()}</span>
						</div>
						<div class="metric-value-row">
							<span class="value-label">v{versionB}:</span>
							<span class="value-number">{versionBData.totalTokens.toLocaleString()}</span>
						</div>
						<div class="metric-delta delta-{getDeltaClass(diff.metricsChange.tokensDiff, true)}">
							<span class="delta-label">Δ</span>
							<span class="delta-value">{formatDelta(diff.metricsChange.tokensDiff)}</span>
						</div>
					</div>
				</div>

				<!-- Cost -->
				<div class="metric-card">
					<div class="metric-header">
						<span class="metric-icon">💰</span>
						<span class="metric-name">Cost</span>
					</div>
					<div class="metric-values">
						<div class="metric-value-row">
							<span class="value-label">v{versionA}:</span>
							<span class="value-number">${versionAData.totalCost.toFixed(4)}</span>
						</div>
						<div class="metric-value-row">
							<span class="value-label">v{versionB}:</span>
							<span class="value-number">${versionBData.totalCost.toFixed(4)}</span>
						</div>
						<div class="metric-delta delta-{getDeltaClass(diff.metricsChange.costDiff, true)}">
							<span class="delta-label">Δ</span>
							<span class="delta-value">{formatCostDelta(diff.metricsChange.costDiff)}</span>
						</div>
					</div>
				</div>

				<!-- Stages -->
				<div class="metric-card">
					<div class="metric-header">
						<span class="metric-icon">📊</span>
						<span class="metric-name">Stages</span>
					</div>
					<div class="metric-values">
						<div class="metric-value-row">
							<span class="value-label">v{versionA}:</span>
							<span class="value-number">{versionAData.stages.length}</span>
						</div>
						<div class="metric-value-row">
							<span class="value-label">v{versionB}:</span>
							<span class="value-number">{versionBData.stages.length}</span>
						</div>
						<div class="metric-delta delta-neutral">
							<span class="delta-label">Δ</span>
							<span class="delta-value">{formatDelta(diff.metricsChange.durationDiff)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Refinement Requirements -->
		{#if diff.addedRequirements.length > 0}
			<div class="requirements-section">
				<h4 class="section-title">Added Requirements (v{versionB})</h4>
				<ul class="requirements-list">
					{#each diff.addedRequirements as requirement}
						<li class="requirement-item">{requirement}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Section Diffs -->
		<div class="sections-diff">
			<h4 class="section-title">Section-by-Section Changes</h4>

			<div class="diff-stats">
				<div class="stat-item stat-added">
					<span class="stat-icon">+</span>
					<span class="stat-value">
						{diff.sectionDiffs.filter((d) => d.type === 'added').length}
					</span>
					<span class="stat-label">added</span>
				</div>

				<div class="stat-item stat-changed">
					<span class="stat-icon">~</span>
					<span class="stat-value">
						{diff.sectionDiffs.filter((d) => d.type === 'changed').length}
					</span>
					<span class="stat-label">changed</span>
				</div>

				<div class="stat-item stat-removed">
					<span class="stat-icon">−</span>
					<span class="stat-value">
						{diff.sectionDiffs.filter((d) => d.type === 'removed').length}
					</span>
					<span class="stat-label">removed</span>
				</div>

				<div class="stat-item stat-identical">
					<span class="stat-icon">=</span>
					<span class="stat-value">
						{diff.sectionDiffs.filter((d) => d.type === 'identical').length}
					</span>
					<span class="stat-label">identical</span>
				</div>
			</div>

			<div class="section-diffs-list">
				{#each diff.sectionDiffs as sectionDiff}
					<SectionDiffView diff={sectionDiff} />
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="error-state">
		<span class="error-icon">⚠️</span>
		<p class="error-text">Unable to compare versions {versionA} and {versionB}</p>
		<p class="error-subtext">One or both versions may not exist.</p>
	</div>
{/if}

<style>
	@reference "../../../../app.css";
	.version-diff-view {
		background: white;
		border: 1px solid theme('colors.gray.200');
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.diff-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.5rem;
		background: theme('colors.gray.50');
		border-bottom: 1px solid theme('colors.gray.200');
	}

	.header-content {
		flex: 1;
	}

	.diff-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: theme('colors.gray.800');
		margin: 0 0 0.5rem 0;
	}

	.diff-summary {
		font-size: 0.875rem;
		color: theme('colors.gray.600');
		margin: 0;
		line-height: 1.5;
	}

	.close-button {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: theme('colors.gray.500');
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.close-button:hover {
		background: theme('colors.gray.200');
		color: theme('colors.gray.700');
	}

	.close-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.version-headers {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: white;
		border-bottom: 1px solid theme('colors.gray.200');
	}

	.version-header {
		padding: 0.75rem;
		border-radius: 0.375rem;
		text-align: center;
	}

	.version-header.version-a {
		background: theme('colors.blue.50');
		border: 1px solid theme('colors.blue.200');
	}

	.version-header.version-b {
		background: theme('colors.purple.50');
		border: 1px solid theme('colors.purple.200');
	}

	.version-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: theme('colors.gray.800');
		margin-bottom: 0.25rem;
	}

	.version-date {
		font-size: 0.75rem;
		color: theme('colors.gray.600');
	}

	.version-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		color: theme('colors.gray.400');
	}

	.metrics-comparison,
	.requirements-section,
	.sections-diff {
		padding: 1.5rem;
		border-bottom: 1px solid theme('colors.gray.200');
	}

	.sections-diff {
		border-bottom: none;
	}

	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: theme('colors.gray.700');
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 1rem 0;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.metric-card {
		background: theme('colors.gray.50');
		border: 1px solid theme('colors.gray.200');
		border-radius: 0.375rem;
		padding: 1rem;
	}

	.metric-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.metric-icon {
		font-size: 1.25rem;
	}

	.metric-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: theme('colors.gray.700');
	}

	.metric-values {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.metric-value-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.813rem;
	}

	.value-label {
		color: theme('colors.gray.600');
		font-weight: 500;
	}

	.value-number {
		color: theme('colors.gray.800');
		font-weight: 600;
	}

	.metric-delta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.25rem;
		padding-top: 0.5rem;
		border-top: 1px solid theme('colors.gray.300');
		font-size: 0.813rem;
		font-weight: 600;
	}

	.metric-delta.delta-positive {
		color: theme('colors.green.600');
	}

	.metric-delta.delta-negative {
		color: theme('colors.red.600');
	}

	.metric-delta.delta-neutral {
		color: theme('colors.gray.600');
	}

	.delta-label {
		font-weight: 700;
	}

	.requirements-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.requirement-item {
		position: relative;
		padding: 0.75rem;
		padding-left: 2rem;
		background: theme('colors.green.50');
		border: 1px solid theme('colors.green.200');
		border-radius: 0.375rem;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		color: theme('colors.gray.700');
	}

	.requirement-item::before {
		content: '+';
		position: absolute;
		left: 0.75rem;
		font-weight: 700;
		color: theme('colors.green.600');
	}

	.requirement-item:last-child {
		margin-bottom: 0;
	}

	.diff-stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.813rem;
	}

	.stat-item.stat-added {
		background: theme('colors.green.50');
		border: 1px solid theme('colors.green.200');
		color: theme('colors.green.700');
	}

	.stat-item.stat-changed {
		background: theme('colors.yellow.50');
		border: 1px solid theme('colors.yellow.200');
		color: theme('colors.yellow.700');
	}

	.stat-item.stat-removed {
		background: theme('colors.red.50');
		border: 1px solid theme('colors.red.200');
		color: theme('colors.red.700');
	}

	.stat-item.stat-identical {
		background: theme('colors.gray.50');
		border: 1px solid theme('colors.gray.200');
		color: theme('colors.gray.700');
	}

	.stat-icon {
		font-weight: 700;
		font-size: 1rem;
	}

	.stat-value {
		font-weight: 700;
		font-size: 0.875rem;
	}

	.stat-label {
		font-weight: 500;
	}

	.section-diffs-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 2rem;
		text-align: center;
		background: white;
		border: 1px solid theme('colors.gray.200');
		border-radius: 0.5rem;
	}

	.error-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.error-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: theme('colors.gray.700');
		margin: 0 0 0.5rem 0;
	}

	.error-subtext {
		font-size: 0.813rem;
		color: theme('colors.gray.500');
		margin: 0;
	}

	:global(.dark) .version-diff-view {
		background: theme('colors.gray.800');
		border-color: theme('colors.gray.700');
	}

	:global(.dark) .diff-header {
		background: theme('colors.gray.900');
		border-bottom-color: theme('colors.gray.700');
	}

	:global(.dark) .diff-title {
		color: theme('colors.gray.100');
	}

	:global(.dark) .diff-summary {
		color: theme('colors.gray.400');
	}

	:global(.dark) .close-button:hover {
		background: theme('colors.gray.700');
		color: theme('colors.gray.300');
	}

	:global(.dark) .version-headers {
		background: theme('colors.gray.800');
		border-bottom-color: theme('colors.gray.700');
	}

	:global(.dark) .version-header.version-a {
		background: theme('colors.gray.900');
		border-color: theme('colors.blue.900');
	}

	:global(.dark) .version-header.version-b {
		background: theme('colors.gray.900');
		border-color: theme('colors.purple.900');
	}

	:global(.dark) .version-label {
		color: theme('colors.gray.200');
	}

	:global(.dark) .version-date {
		color: theme('colors.gray.500');
	}

	:global(.dark) .metrics-comparison,
	:global(.dark) .requirements-section,
	:global(.dark) .sections-diff {
		border-bottom-color: theme('colors.gray.700');
	}

	:global(.dark) .section-title {
		color: theme('colors.gray.300');
	}

	:global(.dark) .metric-card {
		background: theme('colors.gray.900');
		border-color: theme('colors.gray.700');
	}

	:global(.dark) .metric-name {
		color: theme('colors.gray.300');
	}

	:global(.dark) .value-label {
		color: theme('colors.gray.400');
	}

	:global(.dark) .value-number {
		color: theme('colors.gray.200');
	}

	:global(.dark) .metric-delta {
		border-top-color: theme('colors.gray.700');
	}

	:global(.dark) .requirement-item {
		background: theme('colors.gray.900');
		border-color: theme('colors.green.900');
		color: theme('colors.gray.300');
	}

	:global(.dark) .stat-item.stat-added {
		background: theme('colors.gray.900');
		border-color: theme('colors.green.900');
		color: theme('colors.green.400');
	}

	:global(.dark) .stat-item.stat-changed {
		background: theme('colors.gray.900');
		border-color: theme('colors.yellow.900');
		color: theme('colors.yellow.400');
	}

	:global(.dark) .stat-item.stat-removed {
		background: theme('colors.gray.900');
		border-color: theme('colors.red.900');
		color: theme('colors.red.400');
	}

	:global(.dark) .stat-item.stat-identical {
		background: theme('colors.gray.900');
		border-color: theme('colors.gray.700');
		color: theme('colors.gray.400');
	}

	:global(.dark) .error-state {
		background: theme('colors.gray.800');
		border-color: theme('colors.gray.700');
	}

	:global(.dark) .error-text {
		color: theme('colors.gray.300');
	}

	:global(.dark) .error-subtext {
		color: theme('colors.gray.500');
	}
</style>
