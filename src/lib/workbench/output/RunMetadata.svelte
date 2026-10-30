<script lang="ts">
	/**
	 * RunMetadata component - Display run metrics (tokens, latency, cost)
	 */

	import type { PromptRun } from '$lib/core/types';
	import Tag from '$lib/ui/primitives/Tag.svelte';
	import Panel from '$lib/ui/primitives/Panel.svelte';

	interface Props {
		run: PromptRun;
	}

	const { run }: Props = $props();

	// Format numbers with commas
	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	// Format duration
	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	}

	// Format timestamp
	function formatTime(date: Date | string | undefined): string {
		if (!date) return 'N/A';
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		return dateObj.toLocaleTimeString();
	}

	// Get status variant
	const statusVariant = $derived(
		run.status === 'completed'
			? 'success'
			: run.status === 'failed'
				? 'error'
				: run.status === 'running'
					? 'warning'
					: 'default'
	);
</script>

<Panel variant="bordered" padding="sm" class="run-metadata">
	<div class="space-y-3">
		<!-- Run Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-md border capitalize
					{run.status === 'completed'
						? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
						: run.status === 'failed'
							? 'bg-red-500/20 text-red-400 border-red-500/30'
							: run.status === 'running'
								? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
								: 'bg-forge-steel text-slate-300 border-slate-600'}"
				>
					{run.status}
				</span>
				<span class="text-xs text-slate-400">{run.modelId}</span>
			</div>
			<span class="text-xs text-slate-500">{formatTime(run.createdAt)}</span>
		</div>

		<!-- Metrics Grid -->
		{#if run.metrics}
			<div class="grid grid-cols-2 gap-3">
				<!-- Total Tokens -->
				{#if run.metrics.totalTokens}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							></path>
						</svg>
						<div>
							<div class="text-slate-400 text-xs">Tokens</div>
							<div class="text-slate-200 font-medium">{formatNumber(run.metrics.totalTokens)}</div>
						</div>
					</div>
				{/if}

				<!-- Duration/Latency -->
				{#if run.metrics.duration}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<div>
							<div class="text-slate-400 text-xs">Duration</div>
							<div class="text-slate-200 font-medium">{formatDuration(run.metrics.duration)}</div>
						</div>
					</div>
				{/if}

				<!-- Input Tokens -->
				{#if run.metrics.inputTokens}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16l-4-4m0 0l4-4m-4 4h18"
							></path>
						</svg>
						<div>
							<div class="text-slate-400 text-xs">Input</div>
							<div class="text-slate-200 font-medium">{formatNumber(Number(run.metrics.inputTokens ?? 0))}</div>
						</div>
					</div>
				{/if}

				<!-- Output Tokens -->
				{#if run.metrics.outputTokens}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 8l4 4m0 0l-4 4m4-4H3"
							></path>
						</svg>
						<div>
							<div class="text-slate-400 text-xs">Output</div>
							<div class="text-slate-200 font-medium">{formatNumber(Number(run.metrics.outputTokens ?? 0))}</div>
						</div>
					</div>
				{/if}

				<!-- Latency -->
				{#if run.metrics.latency}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							></path>
						</svg>
						<div>
							<div class="text-slate-400 text-xs">Latency</div>
							<div class="text-slate-200 font-medium">{run.metrics.latency}ms</div>
						</div>
					</div>
				{/if}

				<!-- Cost -->
				{#if run.metrics.cost}
					<div class="flex items-center gap-2 text-sm">
						<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<div>
							<div class="text-slate-400 text-xs">Cost</div>
							<div class="text-slate-200 font-medium">${run.metrics.cost.toFixed(4)}</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Error Message -->
		{#if run.status === 'failed' && run.error}
			<div class="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
				<strong>Error:</strong>
				{run.error}
			</div>
		{/if}
	</div>
</Panel>
