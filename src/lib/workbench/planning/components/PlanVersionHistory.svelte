<script lang="ts">
/**
 * VF-321: Plan Version History Component
 *
 * Timeline view of all plan versions showing:
 * - Version number and creation date
 * - Refinement requests that led to each version
 * - Token usage and cost per version
 * - Status indicators
 * - Quick actions (view, compare, rollback)
 */

import { planningStore } from '../stores/planning.svelte';
import type { PlanVersion } from '../types';

interface Props {
	/** Called when a version is selected for viewing */
	onVersionSelect?: (versionNumber: number) => void;
	/** Called when compare is requested */
	onCompare?: (versionA: number, versionB: number) => void;
	/** Called when rollback is requested */
	onRollback?: (versionNumber: number) => void;
}

let { onVersionSelect, onCompare, onRollback }: Props = $props();

// Derived state
const versionHistory = $derived(planningStore.versionHistory);
const currentVersion = $derived(planningStore.currentVersion);
const selectedVersion = $derived(planningStore.selectedVersion);

// Comparison state
let compareMode = $state(false);
let selectedForCompare = $state<number[]>([]);

/**
 * Handle version click
 */
function handleVersionClick(versionNumber: number) {
	if (compareMode) {
		toggleCompareSelection(versionNumber);
	} else {
		planningStore.loadVersion(versionNumber);
		onVersionSelect?.(versionNumber);
	}
}

/**
 * Toggle version for comparison
 */
function toggleCompareSelection(versionNumber: number) {
	if (selectedForCompare.includes(versionNumber)) {
		selectedForCompare = selectedForCompare.filter((v) => v !== versionNumber);
	} else if (selectedForCompare.length < 2) {
		selectedForCompare = [...selectedForCompare, versionNumber];
	}

	// If 2 versions selected, trigger comparison
	if (selectedForCompare.length === 2) {
		const [vA, vB] = selectedForCompare.sort((a, b) => a - b);
		onCompare?.(vA, vB);
	}
}

/**
 * Start comparison mode
 */
function startCompareMode() {
	compareMode = true;
	selectedForCompare = [];
}

/**
 * Cancel comparison mode
 */
function cancelCompareMode() {
	compareMode = false;
	selectedForCompare = [];
}

/**
 * Handle rollback
 */
async function handleRollback(versionNumber: number) {
	const confirmed = confirm(
		`Are you sure you want to rollback to version ${versionNumber}? This will create a new version with the content from v${versionNumber}.`
	);

	if (confirmed) {
		await planningStore.rollbackToVersion(versionNumber);
		onRollback?.(versionNumber);
	}
}

/**
 * Format timestamp
 */
function formatTimestamp(date: Date): string {
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

/**
 * Get version indicator color
 */
function getVersionColor(version: PlanVersion): string {
	if (version.version === currentVersion) return 'current';
	if (version.status === 'failed') return 'failed';
	if (version.status === 'cancelled') return 'cancelled';
	return 'default';
}
</script>

<div class="version-history">
	<!-- Header -->
	<div class="history-header">
		<div class="header-left">
			<h3 class="history-title">Version History</h3>
			<span class="version-count">{versionHistory.length} version{versionHistory.length > 1 ? 's' : ''}</span>
		</div>

		<div class="header-actions">
			{#if !compareMode}
				<button
					class="action-button compare-button"
					onclick={startCompareMode}
					disabled={versionHistory.length < 2}
					title="Compare versions"
				>
					<span class="button-icon">⚖️</span>
					<span>Compare</span>
				</button>
			{:else}
				<div class="compare-mode-header">
					<span class="compare-label">
						Select 2 versions to compare ({selectedForCompare.length}/2)
					</span>
					<button class="action-button cancel-button" onclick={cancelCompareMode}>
						Cancel
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Timeline -->
	{#if versionHistory.length > 0}
		<div class="timeline">
			{#each versionHistory.toReversed() as version, index}
				{@const isSelected = selectedVersion === version.version}
				{@const isCurrent = version.version === currentVersion}
				{@const isCompareSelected = selectedForCompare.includes(version.version)}
				{@const color = getVersionColor(version)}

				<div
					class="timeline-item"
					class:selected={isSelected}
					class:current={isCurrent}
					class:compare-selected={isCompareSelected}
					class:compare-mode={compareMode}
				>
					<!-- Timeline Marker -->
					<div class="timeline-marker">
						<div class="marker-dot marker-{color}"></div>
						{#if index < versionHistory.length - 1}
							<div class="marker-line"></div>
						{/if}
					</div>

					<!-- Version Card -->
					<div class="version-card" onclick={() => handleVersionClick(version.version)}>
						<!-- Card Header -->
						<div class="card-header">
							<div class="version-label">
								<span class="version-number">Version {version.version}</span>
								{#if isCurrent}
									<span class="current-badge">Current</span>
								{/if}
								{#if isCompareSelected}
									<span class="compare-badge">
										{selectedForCompare.indexOf(version.version) + 1}
									</span>
								{/if}
							</div>

							<div class="version-timestamp">{formatTimestamp(version.createdAt)}</div>
						</div>

						<!-- Card Content -->
						<div class="card-content">
							<!-- Refinement Info -->
							{#if version.refinementRequest}
								<div class="refinement-section">
									<div class="refinement-title">
										<span class="refinement-icon">🔄</span>
										<span class="refinement-text">Refinements Applied</span>
									</div>
									<ul class="refinement-list">
										{#each version.refinementRequest.requirements as req}
											<li class="refinement-item">{req}</li>
										{/each}
									</ul>
									{#if version.refinementRequest.additionalContext}
										<div class="additional-context">
											<strong>Context:</strong>
											{version.refinementRequest.additionalContext}
										</div>
									{/if}
								</div>
							{:else}
								<div class="initial-version">
									<span class="initial-icon">🚀</span>
									<span class="initial-text">Initial implementation plan</span>
								</div>
							{/if}

							<!-- Metrics -->
							<div class="metrics">
								<div class="metric-item">
									<span class="metric-label">Tokens:</span>
									<span class="metric-value">{version.totalTokens.toLocaleString()}</span>
								</div>
								<div class="metric-item">
									<span class="metric-label">Cost:</span>
									<span class="metric-value">${version.totalCost.toFixed(4)}</span>
								</div>
								<div class="metric-item">
									<span class="metric-label">Stages:</span>
									<span class="metric-value">{version.stages.length}</span>
								</div>
								<div class="metric-item">
									<span class="metric-label">Status:</span>
									<span class="metric-value status-{version.status}">{version.status}</span>
								</div>
							</div>
						</div>

						<!-- Card Actions -->
						{#if !compareMode}
							<div class="card-actions">
								<button
									class="card-action-button"
									onclick={(e) => {
										e.stopPropagation();
										handleVersionClick(version.version);
									}}
									disabled={isSelected}
									title="View this version"
								>
									<span class="action-icon">👁️</span>
									<span>View</span>
								</button>

								<button
									class="card-action-button"
									onclick={(e) => {
										e.stopPropagation();
										handleRollback(version.version);
									}}
									disabled={isCurrent}
									title="Rollback to this version"
								>
									<span class="action-icon">↩️</span>
									<span>Rollback</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<span class="empty-icon">📋</span>
			<p class="empty-text">No version history available yet</p>
			<p class="empty-subtext">
				Complete a planning session to create the first version, then refine to create more
				versions.
			</p>
		</div>
	{/if}
</div>

<style>
	.version-history {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-gray-200);
		background: var(--color-gray-50);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.history-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin: 0;
	}

	.version-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem 0.5rem;
		background: var(--color-blue-100);
		color: var(--color-blue-700);
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.375rem;
		background: white;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-button:hover:not(:disabled) {
		background: var(--color-gray-50);
		border-color: var(--color-gray-400);
	}

	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.compare-button {
		color: var(--color-blue-700);
		border-color: var(--color-blue-300);
	}

	.compare-button:hover:not(:disabled) {
		background: var(--color-blue-50);
		border-color: var(--color-blue-400);
	}

	.cancel-button {
		color: var(--color-red-700);
		border-color: var(--color-red-300);
	}

	.cancel-button:hover {
		background: var(--color-red-50);
		border-color: var(--color-red-400);
	}

	.compare-mode-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.compare-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-gray-700);
	}

	.button-icon {
		font-size: 1rem;
	}

	.timeline {
		padding: 1.5rem;
	}

	.timeline-item {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		position: relative;
	}

	.timeline-item:last-child {
		margin-bottom: 0;
	}

	.timeline-item.compare-mode {
		cursor: pointer;
	}

	.timeline-marker {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-dot {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		border: 2px solid white;
		box-shadow: 0 0 0 2px var(--color-gray-400);
		background: var(--color-gray-400);
		flex-shrink: 0;
	}

	.marker-dot.marker-current {
		box-shadow: 0 0 0 2px var(--color-blue-500);
		background: var(--color-blue-500);
	}

	.marker-dot.marker-failed {
		box-shadow: 0 0 0 2px var(--color-red-500);
		background: var(--color-red-500);
	}

	.marker-dot.marker-cancelled {
		box-shadow: 0 0 0 2px var(--color-gray-300);
		background: var(--color-gray-300);
	}

	.marker-line {
		width: 2px;
		flex: 1;
		background: var(--color-gray-300);
		min-height: 2rem;
	}

	.version-card {
		flex: 1;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.5rem;
		padding: 1rem;
		background: white;
		transition: all 0.15s;
	}

	.timeline-item.selected .version-card {
		border-color: var(--color-blue-400);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.timeline-item.current .version-card {
		background: var(--color-blue-50);
		border-color: var(--color-blue-300);
	}

	.timeline-item.compare-selected .version-card {
		border-color: var(--color-purple-400);
		box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.1);
	}

	.timeline-item.compare-mode:hover .version-card {
		border-color: var(--color-gray-400);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.version-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.version-number {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.current-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		background: var(--color-blue-100);
		color: var(--color-blue-700);
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.compare-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		background: var(--color-purple-100);
		color: var(--color-purple-700);
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.version-timestamp {
		font-size: 0.75rem;
		color: var(--color-gray-500);
	}

	.card-content {
		margin-bottom: 0.75rem;
	}

	.refinement-section {
		margin-bottom: 0.75rem;
	}

	.refinement-title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.813rem;
		font-weight: 600;
		color: var(--color-gray-700);
		margin-bottom: 0.5rem;
	}

	.refinement-icon,
	.initial-icon {
		font-size: 1rem;
	}

	.refinement-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.refinement-item {
		position: relative;
		padding-left: 1rem;
		font-size: 0.813rem;
		color: var(--color-gray-600);
		margin-bottom: 0.25rem;
	}

	.refinement-item::before {
		content: '•';
		position: absolute;
		left: 0;
		color: var(--color-blue-500);
		font-weight: bold;
	}

	.refinement-item:last-child {
		margin-bottom: 0;
	}

	.additional-context {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: var(--color-gray-50);
		border-radius: 0.25rem;
		font-size: 0.813rem;
		color: var(--color-gray-600);
	}

	.initial-version {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem;
		background: var(--color-green-50);
		border-radius: 0.25rem;
		margin-bottom: 0.75rem;
	}

	.initial-text {
		font-size: 0.813rem;
		color: var(--color-green-700);
		font-weight: 500;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.metric-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.375rem 0.5rem;
		background: var(--color-gray-50);
		border-radius: 0.25rem;
	}

	.metric-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-gray-600);
	}

	.metric-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.metric-value.status-completed {
		color: var(--color-green-600);
	}

	.metric-value.status-failed {
		color: var(--color-red-600);
	}

	.metric-value.status-cancelled {
		color: var(--color-gray-500);
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.card-action-button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.375rem;
		background: white;
		font-size: 0.813rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.card-action-button:hover:not(:disabled) {
		background: var(--color-gray-50);
		border-color: var(--color-gray-400);
	}

	.card-action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-icon {
		font-size: 0.875rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 2rem;
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-gray-700);
		margin: 0 0 0.5rem 0;
	}

	.empty-subtext {
		font-size: 0.813rem;
		color: var(--color-gray-500);
		max-width: 400px;
		margin: 0;
		line-height: 1.5;
	}

	:global(.dark) .version-history {
		background: var(--color-gray-800);
		border-color: var(--color-gray-700);
	}

	:global(.dark) .history-header {
		background: var(--color-gray-900);
		border-bottom-color: var(--color-gray-700);
	}

	:global(.dark) .history-title {
		color: var(--color-gray-100);
	}

	:global(.dark) .version-count {
		background: var(--color-blue-900);
		color: var(--color-blue-300);
	}

	:global(.dark) .action-button {
		background: var(--color-gray-700);
		border-color: var(--color-gray-600);
		color: var(--color-gray-200);
	}

	:global(.dark) .action-button:hover:not(:disabled) {
		background: var(--color-gray-600);
	}

	:global(.dark) .version-card {
		background: var(--color-gray-800);
		border-color: var(--color-gray-700);
	}

	:global(.dark) .timeline-item.current .version-card {
		background: var(--color-gray-900);
		border-color: var(--color-blue-700);
	}

	:global(.dark) .version-number {
		color: var(--color-gray-200);
	}

	:global(.dark) .current-badge {
		background: var(--color-blue-900);
		color: var(--color-blue-300);
	}

	:global(.dark) .version-timestamp {
		color: var(--color-gray-500);
	}

	:global(.dark) .refinement-title {
		color: var(--color-gray-300);
	}

	:global(.dark) .refinement-item {
		color: var(--color-gray-400);
	}

	:global(.dark) .additional-context {
		background: var(--color-gray-900);
		color: var(--color-gray-400);
	}

	:global(.dark) .initial-version {
		background: var(--color-gray-900);
	}

	:global(.dark) .initial-text {
		color: var(--color-green-400);
	}

	:global(.dark) .metric-item {
		background: var(--color-gray-900);
	}

	:global(.dark) .metric-label {
		color: var(--color-gray-400);
	}

	:global(.dark) .metric-value {
		color: var(--color-gray-200);
	}

	:global(.dark) .card-actions {
		border-top-color: var(--color-gray-700);
	}

	:global(.dark) .card-action-button {
		background: var(--color-gray-700);
		border-color: var(--color-gray-600);
		color: var(--color-gray-300);
	}

	:global(.dark) .card-action-button:hover:not(:disabled) {
		background: var(--color-gray-600);
	}

	:global(.dark) .empty-text {
		color: var(--color-gray-300);
	}

	:global(.dark) .empty-subtext {
		color: var(--color-gray-500);
	}
</style>
