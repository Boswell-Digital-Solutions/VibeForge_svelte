import { describe, it, expect, beforeEach } from 'vitest';
import { analysisStore } from '$lib/workbench/stores/analysis.svelte';
import type { CodebaseAnalysis, DetectedIssue } from '$lib/refactoring/types/analysis';

describe('Analysis Store', () => {
	const mockIssue: DetectedIssue = {
		id: 'issue-1',
		title: 'Test Issue',
		description: 'This is a test issue',
		severity: 'warning',
		category: 'code-quality',
		files: ['test.ts'],
		lineNumbers: [10, 11],
		suggestion: 'Fix this',
		autoFixable: false
	};

	const mockAnalysis: CodebaseAnalysis = {
		id: 'analysis-1',
		path: '/test/project',
		analyzedAt: new Date().toISOString(),
		structure: {
			totalFiles: 10,
			totalDirectories: 3,
			totalSize: 50000,
			files: [],
			filesByType: {
				typescript: 5,
				javascript: 2,
				svelte: 2,
				json: 1,
				css: 0,
				html: 0,
				markdown: 0,
				other: 0
			},
			testFiles: 2,
			sourceFiles: 8
		},
		techStack: { framework: 'sveltekit', language: 'typescript', stateManagement: 'svelte-runes', dependencies: [] },
		metrics: {
			testCoverage: {
				lines: 80,
				branches: 75,
				functions: 85,
				statements: 80,
				uncoveredFiles: [],
				totalTests: 10,
				passingTests: 10,
				failingTests: 0
			},
			typeSafety: {
				totalFiles: 10,
				typedFiles: 10,
				jsFiles: 0,
				anyTypeCount: 0,
				typeErrorCount: 0,
				strictMode: true,
				noImplicitAny: true,
				typeCheckPassed: true
			},
			quality: {
				avgFileSize: 100,
				largestFile: { path: 'src/big.ts', lines: 300 },
				avgFunctionLength: 12,
				maxComplexity: 5,
				todoCount: 0,
				fixmeCount: 0,
				eslintErrors: 0,
				eslintWarnings: 0
			},
			size: { totalLines: 1000, codeLines: 800, commentLines: 120, blankLines: 80 }
		},
		patterns: [],
		issues: [mockIssue],
		summary: {
			health: 'good',
			score: 85,
			highlights: ['No critical issues'],
			concerns: ['1 warning found']
		}
	};

	beforeEach(() => {
		// Reset store state before each test
		analysisStore.clearAnalysis();
		analysisStore.setAnalyzing(false);
		analysisStore.setError(null);
	});

	// ============================================================================
	// INITIALIZATION
	// ============================================================================

	describe('Initialization', () => {
		it('should initialize with null current analysis', () => {
			expect(analysisStore.current).toBeNull();
		});

		it('should initialize with isAnalyzing false', () => {
			expect(analysisStore.isAnalyzing).toBe(false);
		});

		it('should initialize with no error', () => {
			expect(analysisStore.error).toBeNull();
		});

		it('should initialize with drawer closed', () => {
			expect(analysisStore.drawerOpen).toBe(false);
		});

		it('should initialize with drawer not minimized', () => {
			expect(analysisStore.drawerMinimized).toBe(false);
		});

		it('should initialize with no selected issue', () => {
			expect(analysisStore.selectedIssue).toBeNull();
		});

		it('should initialize with empty issues array', () => {
			expect(analysisStore.issues).toEqual([]);
		});

		it('should initialize with zero issue counts', () => {
			const counts = analysisStore.issueCount;
			expect(counts.errors).toBe(0);
			expect(counts.warnings).toBe(0);
			expect(counts.suggestions).toBe(0);
		});
	});

	// ============================================================================
	// ANALYSIS STATE
	// ============================================================================

	describe('setAnalyzing', () => {
		it('should set analyzing state to true', () => {
			analysisStore.setAnalyzing(true);
			expect(analysisStore.isAnalyzing).toBe(true);
		});

		it('should set analyzing state to false', () => {
			analysisStore.setAnalyzing(true);
			analysisStore.setAnalyzing(false);
			expect(analysisStore.isAnalyzing).toBe(false);
		});

		it('should clear error when starting analysis', () => {
			analysisStore.setError('Previous error');
			analysisStore.setAnalyzing(true);
			expect(analysisStore.error).toBeNull();
		});

		it('should not clear error when stopping analysis', () => {
			analysisStore.setError('Error message');
			analysisStore.setAnalyzing(false);
			expect(analysisStore.error).toBe('Error message');
		});
	});

	describe('setAnalysis', () => {
		it('should set current analysis', () => {
			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.current).toEqual(mockAnalysis);
		});

		it('should set isAnalyzing to false', () => {
			analysisStore.setAnalyzing(true);
			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.isAnalyzing).toBe(false);
		});

		it('should open drawer', () => {
			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.drawerOpen).toBe(true);
		});

		it('should un-minimize drawer', () => {
			analysisStore.openDrawer();
			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);

			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.drawerMinimized).toBe(false);
		});

		it('should replace previous analysis', () => {
			const firstAnalysis: CodebaseAnalysis = {
				...mockAnalysis,
				summary: { ...mockAnalysis.summary, score: 70 }
			};
			const secondAnalysis: CodebaseAnalysis = {
				...mockAnalysis,
				summary: { ...mockAnalysis.summary, score: 90 }
			};

			analysisStore.setAnalysis(firstAnalysis);
			expect(analysisStore.current?.summary.score).toBe(70);

			analysisStore.setAnalysis(secondAnalysis);
			expect(analysisStore.current?.summary.score).toBe(90);
		});
	});

	describe('clearAnalysis', () => {
		beforeEach(() => {
			analysisStore.setAnalysis(mockAnalysis);
			analysisStore.selectIssue(mockIssue);
		});

		it('should clear current analysis', () => {
			analysisStore.clearAnalysis();
			expect(analysisStore.current).toBeNull();
		});

		it('should close drawer', () => {
			analysisStore.clearAnalysis();
			expect(analysisStore.drawerOpen).toBe(false);
		});

		it('should clear selected issue', () => {
			analysisStore.clearAnalysis();
			expect(analysisStore.selectedIssue).toBeNull();
		});
	});

	describe('setError', () => {
		it('should set error message', () => {
			analysisStore.setError('Test error');
			expect(analysisStore.error).toBe('Test error');
		});

		it('should clear analyzing state', () => {
			analysisStore.setAnalyzing(true);
			analysisStore.setError('Error occurred');
			expect(analysisStore.isAnalyzing).toBe(false);
		});

		it('should replace previous error', () => {
			analysisStore.setError('First error');
			analysisStore.setError('Second error');
			expect(analysisStore.error).toBe('Second error');
		});

		it('should allow clearing error by passing empty string', () => {
			analysisStore.setError('Error message');
			analysisStore.setError('');
			expect(analysisStore.error).toBe('');
		});
	});

	// ============================================================================
	// DRAWER STATE
	// ============================================================================

	describe('openDrawer', () => {
		it('should open drawer', () => {
			analysisStore.openDrawer();
			expect(analysisStore.drawerOpen).toBe(true);
		});

		it('should un-minimize drawer', () => {
			analysisStore.openDrawer();
			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);

			analysisStore.openDrawer();
			expect(analysisStore.drawerMinimized).toBe(false);
		});
	});

	describe('closeDrawer', () => {
		it('should close drawer', () => {
			analysisStore.openDrawer();
			analysisStore.closeDrawer();
			expect(analysisStore.drawerOpen).toBe(false);
		});
	});

	describe('toggleMinimize', () => {
		it('should minimize when not minimized', () => {
			analysisStore.openDrawer();
			expect(analysisStore.drawerMinimized).toBe(false);

			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);
		});

		it('should un-minimize when minimized', () => {
			analysisStore.openDrawer();
			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);

			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(false);
		});

		it('should toggle multiple times', () => {
			analysisStore.openDrawer();

			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);

			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(false);

			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);
		});
	});

	// ============================================================================
	// ISSUE SELECTION
	// ============================================================================

	describe('selectIssue', () => {
		beforeEach(() => {
			analysisStore.setAnalysis(mockAnalysis);
		});

		it('should select an issue', () => {
			analysisStore.selectIssue(mockIssue);
			expect(analysisStore.selectedIssue).toEqual(mockIssue);
		});

		it('should replace previous selection', () => {
			const issue1: DetectedIssue = { ...mockIssue, id: 'issue-1' };
			const issue2: DetectedIssue = { ...mockIssue, id: 'issue-2' };

			analysisStore.selectIssue(issue1);
			expect(analysisStore.selectedIssue?.id).toBe('issue-1');

			analysisStore.selectIssue(issue2);
			expect(analysisStore.selectedIssue?.id).toBe('issue-2');
		});

		it('should allow clearing selection by passing null', () => {
			analysisStore.selectIssue(mockIssue);
			expect(analysisStore.selectedIssue).not.toBeNull();

			analysisStore.selectIssue(null);
			expect(analysisStore.selectedIssue).toBeNull();
		});
	});

	// ============================================================================
	// DERIVED STATE - ISSUES
	// ============================================================================

	describe('issues getter', () => {
		it('should return empty array when no analysis', () => {
			expect(analysisStore.issues).toEqual([]);
		});

		it('should return issues from current analysis', () => {
			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.issues).toEqual(mockAnalysis.issues);
		});

		it('should update when analysis changes', () => {
			const analysis1: CodebaseAnalysis = {
				...mockAnalysis,
				issues: [mockIssue]
			};
			const analysis2: CodebaseAnalysis = {
				...mockAnalysis,
				issues: [mockIssue, { ...mockIssue, id: 'issue-2' }]
			};

			analysisStore.setAnalysis(analysis1);
			expect(analysisStore.issues.length).toBe(1);

			analysisStore.setAnalysis(analysis2);
			expect(analysisStore.issues.length).toBe(2);
		});
	});

	// ============================================================================
	// DERIVED STATE - ISSUE COUNTS
	// ============================================================================

	describe('issueCount getter', () => {
		it('should count errors correctly', () => {
			const analysis: CodebaseAnalysis = {
				...mockAnalysis,
				issues: [
					{ ...mockIssue, severity: 'error' },
					{ ...mockIssue, severity: 'error' },
					{ ...mockIssue, severity: 'warning' }
				]
			};

			analysisStore.setAnalysis(analysis);
			expect(analysisStore.issueCount.errors).toBe(2);
		});

		it('should count warnings correctly', () => {
			const analysis: CodebaseAnalysis = {
				...mockAnalysis,
				issues: [
					{ ...mockIssue, severity: 'warning' },
					{ ...mockIssue, severity: 'warning' },
					{ ...mockIssue, severity: 'warning' },
					{ ...mockIssue, severity: 'error' }
				]
			};

			analysisStore.setAnalysis(analysis);
			expect(analysisStore.issueCount.warnings).toBe(3);
		});

		it('should count suggestions (info) correctly', () => {
			const analysis: CodebaseAnalysis = {
				...mockAnalysis,
				issues: [
					{ ...mockIssue, severity: 'info' },
					{ ...mockIssue, severity: 'info' },
					{ ...mockIssue, severity: 'error' }
				]
			};

			analysisStore.setAnalysis(analysis);
			expect(analysisStore.issueCount.suggestions).toBe(2);
		});

		it('should count all severity types correctly', () => {
			const analysis: CodebaseAnalysis = {
				...mockAnalysis,
				issues: [
					{ ...mockIssue, severity: 'error' },
					{ ...mockIssue, severity: 'error' },
					{ ...mockIssue, severity: 'warning' },
					{ ...mockIssue, severity: 'warning' },
					{ ...mockIssue, severity: 'warning' },
					{ ...mockIssue, severity: 'info' },
					{ ...mockIssue, severity: 'info' },
					{ ...mockIssue, severity: 'info' },
					{ ...mockIssue, severity: 'info' }
				]
			};

			analysisStore.setAnalysis(analysis);
			const counts = analysisStore.issueCount;

			expect(counts.errors).toBe(2);
			expect(counts.warnings).toBe(3);
			expect(counts.suggestions).toBe(4);
		});

		it('should return zeros when no analysis', () => {
			const counts = analysisStore.issueCount;

			expect(counts.errors).toBe(0);
			expect(counts.warnings).toBe(0);
			expect(counts.suggestions).toBe(0);
		});
	});

	// ============================================================================
	// INTEGRATION TESTS
	// ============================================================================

	describe('Integration - Complete Workflow', () => {
		it('should handle full analysis workflow', () => {
			// Start analysis
			analysisStore.setAnalyzing(true);
			expect(analysisStore.isAnalyzing).toBe(true);
			expect(analysisStore.error).toBeNull();

			// Complete analysis with results
			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.isAnalyzing).toBe(false);
			expect(analysisStore.drawerOpen).toBe(true);
			expect(analysisStore.current).toEqual(mockAnalysis);

			// Select an issue
			analysisStore.selectIssue(mockIssue);
			expect(analysisStore.selectedIssue).toEqual(mockIssue);

			// Minimize drawer
			analysisStore.toggleMinimize();
			expect(analysisStore.drawerMinimized).toBe(true);

			// Clear analysis
			analysisStore.clearAnalysis();
			expect(analysisStore.current).toBeNull();
			expect(analysisStore.drawerOpen).toBe(false);
			expect(analysisStore.selectedIssue).toBeNull();
		});

		it('should handle analysis error workflow', () => {
			// Start analysis
			analysisStore.setAnalyzing(true);
			expect(analysisStore.isAnalyzing).toBe(true);

			// Error occurs
			analysisStore.setError('Analysis failed');
			expect(analysisStore.isAnalyzing).toBe(false);
			expect(analysisStore.error).toBe('Analysis failed');

			// Retry analysis
			analysisStore.setAnalyzing(true);
			expect(analysisStore.error).toBeNull(); // Error should be cleared

			// Success this time
			analysisStore.setAnalysis(mockAnalysis);
			expect(analysisStore.current).toEqual(mockAnalysis);
		});

		it('should handle multiple analyses in sequence', () => {
			// First analysis
			const analysis1: CodebaseAnalysis = {
				...mockAnalysis,
				summary: { ...mockAnalysis.summary, score: 70 }
			};
			analysisStore.setAnalysis(analysis1);
			expect(analysisStore.current?.summary.score).toBe(70);

			// Second analysis
			const analysis2: CodebaseAnalysis = {
				...mockAnalysis,
				summary: { ...mockAnalysis.summary, score: 85 }
			};
			analysisStore.setAnalysis(analysis2);
			expect(analysisStore.current?.summary.score).toBe(85);

			// Third analysis
			const analysis3: CodebaseAnalysis = {
				...mockAnalysis,
				summary: { ...mockAnalysis.summary, score: 95 }
			};
			analysisStore.setAnalysis(analysis3);
			expect(analysisStore.current?.summary.score).toBe(95);
		});
	});
});
