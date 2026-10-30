<script lang="ts">
/**
 * VF-313: Pattern Suggestions Component
 *
 * Displays AI-powered pattern suggestions based on prompt text with:
 * - Confidence score indicators
 * - One-click pattern application
 * - Dismiss functionality
 * - Detected intent display
 * - Matching keywords highlighting
 */

import type { PatternSuggestion } from '$lib/core/types';
import { patternsStore } from '$lib/core/stores';

interface Props {
	/** Callback when pattern applied */
	onApply?: (pattern: import('$lib/core/types').PromptPattern) => void;
	/** Show compact view (default: false) */
	compact?: boolean;
	/** Maximum height for suggestions panel */
	maxHeight?: string;
}

let { onApply, compact = false, maxHeight = '400px' }: Props = $props();

// Subscribe to store
const suggestions = $derived(patternsStore.currentSuggestions);
const isAnalyzing = $derived(patternsStore.isAnalyzing);
const lastMatchResult = $derived(patternsStore.lastMatchResult);

// Handle apply suggestion
function handleApply(suggestion: PatternSuggestion): void {
	patternsStore.acceptSuggestion(suggestion.pattern.id);
	onApply?.(suggestion.pattern);
}

// Handle dismiss suggestion
function handleDismiss(suggestion: PatternSuggestion): void {
	patternsStore.rejectSuggestion(suggestion.pattern.id);
}

// Get confidence color based on score
function getConfidenceColor(confidence: number): string {
	if (confidence >= 80) return 'bg-green-500';
	if (confidence >= 60) return 'bg-blue-500';
	if (confidence >= 40) return 'bg-yellow-500';
	return 'bg-gray-400';
}

// Get confidence label
function getConfidenceLabel(confidence: number): string {
	if (confidence >= 80) return 'Excellent match';
	if (confidence >= 60) return 'Good match';
	if (confidence >= 40) return 'Moderate match';
	return 'Weak match';
}

// Format intent for display
function formatIntent(intent: string): string {
	return intent
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
</script>

<div class="pattern-suggestions" style="max-height: {maxHeight}">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div>
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
				💡 Suggested Patterns
			</h3>
			{#if lastMatchResult}
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
					Detected intent: <span class="font-medium"
						>{formatIntent(lastMatchResult.detectedIntent)}</span
					>
					({lastMatchResult.intentConfidence}% confidence)
				</p>
			{/if}
		</div>

		{#if suggestions.length > 0}
			<button
				onclick={() => patternsStore.clearSuggestions()}
				class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				Clear all
			</button>
		{/if}
	</div>

	<!-- Loading State -->
	{#if isAnalyzing}
		<div class="flex items-center justify-center py-8">
			<div class="text-center">
				<div
					class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"
				></div>
				<p class="text-sm text-gray-500 dark:text-gray-400">Analyzing prompt...</p>
			</div>
		</div>

		<!-- Suggestions List -->
	{:else if suggestions.length > 0}
		<div class="space-y-3 overflow-y-auto" style="max-height: calc({maxHeight} - 80px)">
			{#each suggestions as suggestion, index (suggestion.pattern.id)}
				<div
					class="suggestion-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow"
				>
					<!-- Confidence Bar -->
					<div class="flex items-center gap-2 mb-2">
						<div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
							<div
								class="h-2 rounded-full transition-all duration-300 {getConfidenceColor(
									suggestion.confidence
								)}"
								style="width: {suggestion.confidence}%"
							></div>
						</div>
						<span
							class="text-xs font-medium {suggestion.confidence >= 60
								? 'text-green-600 dark:text-green-400'
								: 'text-gray-500 dark:text-gray-400'}"
						>
							{suggestion.confidence}%
						</span>
					</div>

					<!-- Pattern Info -->
					<div class="mb-3">
						<div class="flex items-start justify-between mb-1">
							<h4 class="font-medium text-gray-800 dark:text-gray-200 text-sm">
								{suggestion.pattern.name}
							</h4>
							{#if suggestion.pattern.isBuiltIn}
								<span
									class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded"
								>
									Built-in
								</span>
							{/if}
						</div>

						{#if !compact}
							<p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
								{suggestion.pattern.description}
							</p>
						{/if}

						<!-- Reason -->
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
							<span class="font-medium">Why:</span>
							{suggestion.reason}
						</p>

						<!-- Matching Keywords -->
						{#if suggestion.matchingKeywords.length > 0}
							<div class="flex flex-wrap gap-1 mb-2">
								{#each suggestion.matchingKeywords.slice(0, 5) as keyword}
									<span
										class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
									>
										{keyword}
									</span>
								{/each}
								{#if suggestion.matchingKeywords.length > 5}
									<span class="text-xs text-gray-400 self-center">
										+{suggestion.matchingKeywords.length - 5} more
									</span>
								{/if}
							</div>
						{/if}

						<!-- Category & Tags -->
						{#if !compact}
							<div class="flex items-center gap-2 text-xs">
								<span
									class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded"
								>
									{suggestion.pattern.category}
								</span>
								{#if suggestion.pattern.tags.length > 0}
									{#each suggestion.pattern.tags.slice(0, 3) as tag}
										<span class="text-gray-500 dark:text-gray-400">#{tag}</span>
									{/each}
								{/if}
							</div>
						{/if}
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2">
						<button
							onclick={() => handleApply(suggestion)}
							class="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
						>
							✓ Apply Pattern
						</button>
						<button
							onclick={() => handleDismiss(suggestion)}
							class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded transition-colors"
							title="Dismiss this suggestion"
						>
							×
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Footer Info -->
		{#if lastMatchResult}
			<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Analyzed {lastMatchResult.keywords.length} keywords in {lastMatchResult.analysisDurationMs}ms
				</p>
			</div>
		{/if}

		<!-- Empty State -->
	{:else}
		<div class="flex flex-col items-center justify-center py-8 text-center">
			<span class="text-4xl mb-2">🔍</span>
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">No pattern suggestions yet</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
				Start typing in the prompt editor and we'll suggest relevant patterns based on your input.
			</p>
		</div>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.pattern-suggestions {
		@apply overflow-hidden;
	}

	.suggestion-card {
		@apply relative;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Smooth fade-in animation */
	.suggestion-card {
		animation: fadeIn 0.2s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
