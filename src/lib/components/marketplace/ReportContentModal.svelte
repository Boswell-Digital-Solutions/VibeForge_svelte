<script lang="ts">
/**
 * VF-312: Report Content Modal
 *
 * Modal for reporting inappropriate patterns:
 * - Select report reason
 * - Add details
 * - Submit report
 */

import type { ReportReason } from '$lib/core/types';
import { marketplaceStore } from '$lib/core/stores';

interface Props {
	/** Pattern ID being reported */
	patternId: string;
	/** Pattern name (for display) */
	patternName: string;
	/** Callback when modal should close */
	onClose: () => void;
	/** Callback when report submitted successfully */
	onReported?: () => void;
}

let { patternId, patternName, onClose, onReported }: Props = $props();

// Local state
let reason = $state<ReportReason>('spam');
let details = $state('');
let isSubmitting = $state(false);
let error = $state<string | null>(null);

// Report reasons
const reasons: Array<{ value: ReportReason; label: string; description: string }> = [
	{
		value: 'spam',
		label: 'Spam',
		description: 'Promotional content or repetitive submissions'
	},
	{
		value: 'inappropriate',
		label: 'Inappropriate Content',
		description: 'Offensive, harmful, or unsuitable content'
	},
	{
		value: 'copyright',
		label: 'Copyright Violation',
		description: 'Unauthorized use of copyrighted material'
	},
	{
		value: 'malicious',
		label: 'Malicious Content',
		description: 'Attempts to harm users or systems'
	},
	{
		value: 'duplicate',
		label: 'Duplicate',
		description: 'Already exists in the marketplace'
	},
	{
		value: 'other',
		label: 'Other',
		description: 'Other issues not listed above'
	}
];

// Handle submit
async function handleSubmit() {
	if (!details.trim() && reason === 'other') {
		error = 'Please provide details for "Other" reports';
		return;
	}

	isSubmitting = true;
	error = null;

	try {
		await marketplaceStore.reportPattern(patternId, reason, details);
		onReported?.();
		onClose();
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to submit report';
	} finally {
		isSubmitting = false;
	}
}
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
	<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
		<div class="p-6">
			<!-- Header -->
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Report Pattern</h2>
				<button onclick={onClose} class="text-gray-400 hover:text-gray-600 text-2xl">
					×
				</button>
			</div>

			<!-- Pattern Info -->
			<div class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
				<p class="text-sm text-gray-600 mb-1">Reporting pattern:</p>
				<p class="font-medium text-gray-800">{patternName}</p>
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded">
					<p class="text-red-700 text-sm">{error}</p>
				</div>
			{/if}

			<!-- Reason Selection -->
			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-700 mb-3">
					Reason for Report <span class="text-red-500">*</span>
				</label>
				<div class="space-y-3">
					{#each reasons as reasonOption}
						<label class="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition-colors {reason === reasonOption.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
							<input
								type="radio"
								bind:group={reason}
								value={reasonOption.value}
								class="mt-1"
							/>
							<div class="flex-1">
								<div class="font-medium text-gray-800">{reasonOption.label}</div>
								<div class="text-sm text-gray-600">{reasonOption.description}</div>
							</div>
						</label>
					{/each}
				</div>
			</div>

			<!-- Details -->
			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-700 mb-2">
					Additional Details {#if reason === 'other'}<span class="text-red-500">*</span>{:else}(optional){/if}
				</label>
				<textarea
					bind:value={details}
					rows="4"
					placeholder="Please provide specific details about the issue..."
					class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
				></textarea>
				<p class="text-xs text-gray-500 mt-1">{details.length} / 500 characters</p>
			</div>

			<!-- Notice -->
			<div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
				<div class="flex gap-2">
					<span class="text-yellow-600 text-xl">⚠️</span>
					<div class="flex-1 text-sm text-yellow-700">
						<p class="font-medium mb-1">Important</p>
						<p>
							False reports may result in restrictions on your account. Reports are reviewed by our
							moderation team. You will be notified of the outcome via email.
						</p>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<button
					onclick={onClose}
					class="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
					disabled={isSubmitting}
				>
					Cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={isSubmitting || (reason === 'other' && !details.trim())}
					class="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isSubmitting ? 'Submitting...' : 'Submit Report'}
				</button>
			</div>
		</div>
	</div>
</div>
