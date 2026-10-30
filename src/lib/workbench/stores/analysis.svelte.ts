/**
 * Analysis Store (Svelte 5)
 *
 * Manages code analysis state for editor content and GitHub repositories.
 */

import type { CodebaseAnalysis } from '$lib/refactoring/types/analysis';
import type { DetectedIssue } from '$lib/refactoring/types/analysis';

interface AnalysisState {
	current: CodebaseAnalysis | null;
	isAnalyzing: boolean;
	error: string | null;
	drawerOpen: boolean;
	drawerMinimized: boolean;
	selectedIssue: DetectedIssue | null;
}

function createAnalysisStore() {
	let state = $state<AnalysisState>({
		current: null,
		isAnalyzing: false,
		error: null,
		drawerOpen: false,
		drawerMinimized: false,
		selectedIssue: null
	});

	return {
		// Getters
		get current() {
			return state.current;
		},
		get isAnalyzing() {
			return state.isAnalyzing;
		},
		get error() {
			return state.error;
		},
		get drawerOpen() {
			return state.drawerOpen;
		},
		get drawerMinimized() {
			return state.drawerMinimized;
		},
		get selectedIssue() {
			return state.selectedIssue;
		},

		get issues() {
			return state.current?.issues || [];
		},

		get issueCount() {
			if (!state.current) return { errors: 0, warnings: 0, suggestions: 0 };
			const issues = state.current.issues;
			return {
				errors: issues.filter((i) => i.severity === 'error').length,
				warnings: issues.filter((i) => i.severity === 'warning').length,
				suggestions: issues.filter((i) => i.severity === 'info').length
			};
		},

		// Actions
		setAnalyzing(value: boolean) {
			state.isAnalyzing = value;
			if (value) state.error = null;
		},

		setAnalysis(analysis: CodebaseAnalysis) {
			state.current = analysis;
			state.isAnalyzing = false;
			state.drawerOpen = true;
			state.drawerMinimized = false;
		},

		setError(error: string | null) {
			state.error = error;
			state.isAnalyzing = false;
		},

		clearAnalysis() {
			state.current = null;
			state.drawerOpen = false;
			state.selectedIssue = null;
		},

		openDrawer() {
			state.drawerOpen = true;
			state.drawerMinimized = false;
		},

		closeDrawer() {
			state.drawerOpen = false;
		},

		toggleMinimize() {
			state.drawerMinimized = !state.drawerMinimized;
		},

		selectIssue(issue: DetectedIssue | null) {
			state.selectedIssue = issue;
		}
	};
}

export const analysisStore = createAnalysisStore();
