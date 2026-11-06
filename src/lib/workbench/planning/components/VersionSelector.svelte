<script lang="ts">
/**
 * VF-321: Version Selector Component
 *
 * Dropdown selector for plan versions with:
 * - List of all versions (v1, v2, v3, etc.)
 * - Current version indicator
 * - Refinement markers
 * - Load version on select
 */

import { planningStore } from '../stores/planning.svelte';
import type { PlanVersion } from '../types';

interface Props {
	/** Called when version is loaded */
	onVersionLoad?: (versionNumber: number) => void;
}

let { onVersionLoad }: Props = $props();

// Derived state
const versionHistory = $derived(planningStore.versionHistory);
const currentVersion = $derived(planningStore.currentVersion);
const selectedVersion = $derived(planningStore.selectedVersion);

/**
 * Handle version selection
 */
function handleVersionSelect(versionNumber: number) {
	planningStore.loadVersion(versionNumber);
	onVersionLoad?.(versionNumber);
}

/**
 * Format version label
 */
function formatVersionLabel(version: PlanVersion): string {
	if (version.refinementRequest) {
		const reqCount = version.refinementRequest.requirements.length;
		return `v${version.version} - ${reqCount} refinement${reqCount > 1 ? 's' : ''}`;
	}
	return `v${version.version} - Initial plan`;
}

/**
 * Format version timestamp
 */
function formatTimestamp(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString();
}
</script>

{#if versionHistory.length > 0}
	<div class="version-selector">
		<label class="selector-label">Plan Version:</label>

		<div class="selector-dropdown">
			<select
				class="version-select"
				value={selectedVersion || currentVersion}
				onchange={(e) => handleVersionSelect(Number(e.currentTarget.value))}
			>
				{#each versionHistory.toReversed() as version}
					<option value={version.version}>
						{formatVersionLabel(version)} - {formatTimestamp(version.createdAt)}
						{version.version === currentVersion ? ' (current)' : ''}
					</option>
				{/each}
			</select>

			<!-- Version Count Badge -->
			<div class="version-count">
				<span class="count-badge">{versionHistory.length}</span>
				<span class="count-label">version{versionHistory.length > 1 ? 's' : ''}</span>
			</div>
		</div>

		<!-- Version Details -->
		{#if selectedVersion}
			{@const version = versionHistory.find((v) => v.version === selectedVersion)}
			{#if version}
				<div class="version-details">
					<div class="detail-item">
						<span class="detail-label">Tokens:</span>
						<span class="detail-value">{version.totalTokens.toLocaleString()}</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">Cost:</span>
						<span class="detail-value">${version.totalCost.toFixed(4)}</span>
					</div>
					<div class="detail-item">
						<span class="detail-label">Status:</span>
						<span class="detail-value status-{version.status}">{version.status}</span>
					</div>

					{#if version.refinementRequest}
						<div class="refinement-info">
							<div class="refinement-header">Refinements:</div>
							<ul class="refinement-list">
								{#each version.refinementRequest.requirements as req}
									<li class="refinement-item">{req}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div class="no-versions">
		<span class="no-versions-icon">📋</span>
		<span class="no-versions-text">No version history available</span>
	</div>
{/if}

<style>
	.version-selector {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.selector-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-gray-700);
		margin-bottom: 0.5rem;
	}

	.selector-dropdown {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.version-select {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.375rem;
		font-size: 0.875rem;
		background: white;
		cursor: pointer;
	}

	.version-select:focus {
		outline: none;
		border-color: var(--color-blue-500);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.version-count {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.count-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.375rem;
		background: var(--color-blue-100);
		color: var(--color-blue-700);
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.count-label {
		font-size: 0.75rem;
		color: var(--color-gray-600);
	}

	.version-details {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-gray-200);
	}

	.detail-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.detail-label {
		font-weight: 500;
		color: var(--color-gray-600);
	}

	.detail-value {
		font-weight: 600;
		color: var(--color-gray-800);
	}

	.detail-value.status-completed {
		color: var(--color-green-600);
	}

	.detail-value.status-failed {
		color: var(--color-red-600);
	}

	.detail-value.status-cancelled {
		color: var(--color-gray-600);
	}

	.refinement-info {
		margin-top: 0.75rem;
		padding: 0.75rem;
		background: var(--color-blue-50);
		border-radius: 0.375rem;
	}

	.refinement-header {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-blue-700);
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		color: var(--color-gray-700);
		margin-bottom: 0.25rem;
	}

	.refinement-item::before {
		content: '•';
		position: absolute;
		left: 0;
		color: var(--color-blue-600);
		font-weight: bold;
	}

	.refinement-item:last-child {
		margin-bottom: 0;
	}

	.no-versions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		background: var(--color-gray-50);
		border: 1px dashed var(--color-gray-300);
		border-radius: 0.5rem;
	}

	.no-versions-icon {
		font-size: 1.5rem;
	}

	.no-versions-text {
		font-size: 0.875rem;
		color: var(--color-gray-500);
	}

	:global(.dark) .version-selector {
		background: var(--color-gray-800);
		border-color: var(--color-gray-700);
	}

	:global(.dark) .selector-label {
		color: var(--color-gray-300);
	}

	:global(.dark) .version-select {
		background: var(--color-gray-700);
		border-color: var(--color-gray-600);
		color: var(--color-gray-100);
	}

	:global(.dark) .count-badge {
		background: var(--color-blue-900);
		color: var(--color-blue-300);
	}

	:global(.dark) .count-label {
		color: var(--color-gray-400);
	}

	:global(.dark) .version-details {
		border-top-color: var(--color-gray-700);
	}

	:global(.dark) .detail-label {
		color: var(--color-gray-400);
	}

	:global(.dark) .detail-value {
		color: var(--color-gray-200);
	}

	:global(.dark) .refinement-info {
		background: var(--color-gray-900);
	}

	:global(.dark) .refinement-header {
		color: var(--color-blue-400);
	}

	:global(.dark) .refinement-item {
		color: var(--color-gray-300);
	}

	:global(.dark) .no-versions {
		background: var(--color-gray-900);
		border-color: var(--color-gray-700);
	}

	:global(.dark) .no-versions-text {
		color: var(--color-gray-500);
	}
</style>
