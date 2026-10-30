<script lang="ts">
/**
 * VF-321: Refinement Request Form
 *
 * Form for refining a completed plan with new requirements.
 * Allows users to:
 * - Add multiple requirements (array of strings)
 * - Provide additional context (optional)
 * - Specify focus sections (optional)
 * - Submit for refinement execution
 */

import { planningStore } from '../stores/planning.svelte';

interface Props {
	/** Called when refinement starts */
	onRefinementStart?: () => void;
	/** Called when refinement completes */
	onRefinementComplete?: () => void;
}

let { onRefinementStart, onRefinementComplete }: Props = $props();

// Form state
let requirements = $state<string[]>(['']);
let newRequirement = $state('');
let additionalContext = $state('');
let focusSections = $state('');
let isSubmitting = $state(false);

/**
 * Add a new requirement to the list
 */
function addRequirement() {
	if (newRequirement.trim()) {
		requirements = [...requirements, newRequirement.trim()];
		newRequirement = '';
	}
}

/**
 * Remove a requirement from the list
 */
function removeRequirement(index: number) {
	requirements = requirements.filter((_, i) => i !== index);
}

/**
 * Submit refinement request
 */
async function handleSubmit() {
	if (requirements.filter((r) => r.trim()).length === 0) {
		return;
	}

	isSubmitting = true;
	onRefinementStart?.();

	try {
		const focusSectionsArray = focusSections
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s);

		await planningStore.refineCurrentSession(
			requirements.filter((r) => r.trim()),
			additionalContext.trim() || undefined,
			focusSectionsArray.length > 0 ? focusSectionsArray : undefined
		);

		// Reset form on success
		requirements = [''];
		newRequirement = '';
		additionalContext = '';
		focusSections = '';

		onRefinementComplete?.();
	} finally {
		isSubmitting = false;
	}
}

/**
 * Handle Enter key in new requirement input
 */
function handleKeyPress(event: KeyboardEvent) {
	if (event.key === 'Enter') {
		event.preventDefault();
		addRequirement();
	}
}
</script>

<div class="refinement-request-form">
	<!-- Header -->
	<div class="form-header">
		<h3 class="form-title">Refine Plan with New Requirements</h3>
		<p class="form-subtitle">
			Add new features or changes to your implementation plan. The orchestrator will update the
			plan and create a new version.
		</p>
	</div>

	<!-- Requirements List -->
	<div class="form-section">
		<label class="form-label">
			Requirements <span class="text-red-500">*</span>
		</label>

		<div class="requirements-list">
			{#each requirements as requirement, index}
				<div class="requirement-item">
					<span class="requirement-number">{index + 1}.</span>
					<span class="requirement-text">{requirement}</span>
					<button
						type="button"
						class="remove-button"
						onclick={() => removeRequirement(index)}
						aria-label="Remove requirement"
					>
						×
					</button>
				</div>
			{/each}
		</div>

		<!-- Add New Requirement -->
		<div class="add-requirement">
			<input
				type="text"
				class="form-input"
				placeholder="Add a new requirement..."
				bind:value={newRequirement}
				onkeypress={handleKeyPress}
			/>
			<button
				type="button"
				class="add-button"
				onclick={addRequirement}
				disabled={!newRequirement.trim()}
			>
				Add
			</button>
		</div>
	</div>

	<!-- Additional Context (Optional) -->
	<div class="form-section">
		<label class="form-label"> Additional Context <span class="text-gray-500">(optional)</span> </label>
		<textarea
			class="form-textarea"
			placeholder="Provide any additional context or constraints..."
			rows="3"
			bind:value={additionalContext}
		></textarea>
	</div>

	<!-- Focus Sections (Optional) -->
	<div class="form-section">
		<label class="form-label">
			Focus Sections <span class="text-gray-500">(optional, comma-separated)</span>
		</label>
		<input
			type="text"
			class="form-input"
			placeholder="e.g., Overview, Testing Strategy, Deployment"
			bind:value={focusSections}
		/>
		<p class="form-help">
			Specify which sections to update. Leave empty to update all relevant sections.
		</p>
	</div>

	<!-- Error Display -->
	{#if planningStore.error}
		<div class="error-banner">
			<span class="error-icon">⚠</span>
			<span class="error-message">{planningStore.error}</span>
		</div>
	{/if}

	<!-- Submit Button -->
	<div class="form-actions">
		<button
			type="button"
			class="submit-button"
			onclick={handleSubmit}
			disabled={requirements.filter((r) => r.trim()).length === 0 ||
				isSubmitting ||
				!planningStore.canRefine}
		>
			{#if isSubmitting}
				<span class="spinner"></span>
				<span>Refining Plan...</span>
			{:else}
				<span>Refine Plan</span>
			{/if}
		</button>

		{#if !planningStore.canRefine}
			<p class="help-text">
				Refinement is only available for completed versioned sessions with orchestrator permission.
			</p>
		{/if}
	</div>
</div>

<style>
	.refinement-request-form {
		background: white;
		border: 1px solid var(--color-gray-200);
		border-radius: 0.5rem;
		padding: 1.5rem;
		max-width: 600px;
	}

	.form-header {
		margin-bottom: 1.5rem;
	}

	.form-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-gray-800);
		margin-bottom: 0.5rem;
	}

	.form-subtitle {
		font-size: 0.875rem;
		color: var(--color-gray-600);
		line-height: 1.5;
	}

	.form-section {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-gray-700);
		margin-bottom: 0.5rem;
	}

	.requirements-list {
		background: var(--color-gray-50);
		border: 1px solid var(--color-gray-200);
		border-radius: 0.375rem;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.requirement-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: white;
		border-radius: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.requirement-item:last-child {
		margin-bottom: 0;
	}

	.requirement-number {
		font-weight: 600;
		color: var(--color-blue-600);
		min-width: 1.5rem;
	}

	.requirement-text {
		flex: 1;
		font-size: 0.875rem;
		color: var(--color-gray-800);
	}

	.remove-button {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--color-red-100);
		color: var(--color-red-600);
		border: none;
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
	}

	.remove-button:hover {
		background: var(--color-red-200);
	}

	.add-requirement {
		display: flex;
		gap: 0.5rem;
	}

	.form-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--color-blue-500);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-gray-300);
		border-radius: 0.375rem;
		font-size: 0.875rem;
		resize: vertical;
		font-family: inherit;
	}

	.form-textarea:focus {
		outline: none;
		border-color: var(--color-blue-500);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.add-button {
		padding: 0.5rem 1rem;
		background: var(--color-blue-600);
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.add-button:hover:not(:disabled) {
		background: var(--color-blue-700);
	}

	.add-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.form-help {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		margin-top: 0.25rem;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-red-50);
		border: 1px solid var(--color-red-200);
		border-radius: 0.375rem;
		margin-bottom: 1rem;
	}

	.error-icon {
		font-size: 1.25rem;
		color: var(--color-red-500);
	}

	.error-message {
		flex: 1;
		font-size: 0.875rem;
		color: var(--color-red-700);
	}

	.form-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.submit-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--color-green-600);
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.submit-button:hover:not(:disabled) {
		background: var(--color-green-700);
	}

	.submit-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid white;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.help-text {
		font-size: 0.75rem;
		color: var(--color-gray-500);
		text-align: center;
	}

	:global(.dark) .refinement-request-form {
		background: var(--color-gray-800);
		border-color: var(--color-gray-700);
	}

	:global(.dark) .form-title {
		color: var(--color-gray-100);
	}

	:global(.dark) .form-subtitle,
	:global(.dark) .form-label {
		color: var(--color-gray-300);
	}

	:global(.dark) .requirements-list {
		background: var(--color-gray-900);
		border-color: var(--color-gray-700);
	}

	:global(.dark) .requirement-item {
		background: var(--color-gray-800);
	}

	:global(.dark) .requirement-text {
		color: var(--color-gray-100);
	}

	:global(.dark) .form-input,
	:global(.dark) .form-textarea {
		background: var(--color-gray-700);
		border-color: var(--color-gray-600);
		color: var(--color-gray-100);
	}
</style>
