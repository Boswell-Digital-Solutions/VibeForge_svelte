<script lang="ts">
	/**
	 * StreamingText component - Render streaming text with markdown and syntax highlighting
	 * Supports token-by-token rendering with smooth visual feedback
	 */

	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import hljs from 'highlight.js/lib/common';
	import 'highlight.js/styles/github-dark.css';

	interface Props {
		/** The text content to render (can update as streaming progresses) */
		content: string;
		/** Whether the content is currently streaming */
		isStreaming?: boolean;
		/** Show streaming cursor indicator */
		showCursor?: boolean;
		/** Enable markdown rendering */
		enableMarkdown?: boolean;
		/** Class name for custom styling */
		class?: string;
	}

	const {
		content,
		isStreaming = false,
		showCursor = true,
		enableMarkdown = true,
		class: className = '',
	}: Props = $props();

	let renderedHtml = $state('');
	let highlightApplied = $state(false);

	// Configure marked for syntax highlighting
	onMount(() => {
		// marked dropped the `highlight` option in v5; code blocks are highlighted
		// after render by hljs.highlightElement in the $effect below.
		marked.setOptions({
			breaks: true,
			gfm: true,
		});
	});

	// Reactively render markdown when content changes
	$effect(() => {
		if (enableMarkdown) {
			try {
				renderedHtml = marked.parse(content) as string;
				highlightApplied = false;

				// Apply syntax highlighting to any new code blocks
				// Small delay to ensure DOM is updated
				setTimeout(() => {
					if (typeof document !== 'undefined') {
						document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
							hljs.highlightElement(block as HTMLElement);
						});
						highlightApplied = true;
					}
				}, 10);
			} catch (err) {
				console.error('Markdown parsing failed:', err);
				renderedHtml = content; // Fallback to plain text
			}
		} else {
			renderedHtml = content;
		}
	});
</script>

<div class="streaming-text {className}">
	{#if enableMarkdown}
		<!-- Rendered Markdown -->
		<div
			class="prose prose-invert prose-slate max-w-none
				prose-headings:text-slate-200 prose-headings:font-semibold
				prose-p:text-slate-300 prose-p:leading-relaxed
				prose-a:text-forge-ember prose-a:no-underline hover:prose-a:underline
				prose-code:text-forge-ember prose-code:bg-forge-gunmetal prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
				prose-pre:bg-forge-gunmetal prose-pre:border prose-pre:border-slate-700
				prose-blockquote:border-l-forge-ember prose-blockquote:text-slate-400
				prose-strong:text-slate-200 prose-strong:font-semibold
				prose-ul:text-slate-300 prose-ol:text-slate-300
				prose-li:text-slate-300
				prose-hr:border-slate-700
				prose-table:border prose-table:border-slate-700
				prose-th:bg-forge-gunmetal prose-th:text-slate-200
				prose-td:text-slate-300"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html renderedHtml}

			<!-- Streaming Cursor -->
			{#if isStreaming && showCursor}
				<span class="inline-block w-2 h-5 ml-0.5 bg-forge-ember animate-pulse align-middle"></span>
			{/if}
		</div>
	{:else}
		<!-- Plain Text Mode -->
		<pre
			class="whitespace-pre-wrap font-sans text-slate-200 text-base leading-relaxed"
		>{content}{#if isStreaming && showCursor}<span class="inline-block w-2 h-5 ml-0.5 bg-forge-ember animate-pulse"></span>{/if}</pre>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	.streaming-text {
		@apply relative;
	}

	/* Override highlight.js theme for better consistency */
	:global(.streaming-text pre code.hljs) {
		@apply bg-transparent;
		padding: 0;
	}

	:global(.streaming-text pre) {
		@apply overflow-x-auto;
	}

	/* Smooth transitions for content updates */
	.streaming-text :global(p),
	.streaming-text :global(li),
	.streaming-text :global(pre) {
		@apply transition-opacity duration-100;
	}

	/* Code block styling */
	:global(.streaming-text code:not(pre code)) {
		@apply font-mono text-sm;
	}

	:global(.streaming-text pre code) {
		@apply text-sm font-mono;
	}
</style>
