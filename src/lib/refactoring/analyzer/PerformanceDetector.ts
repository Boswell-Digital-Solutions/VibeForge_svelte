/**
 * PerformanceDetector - Detects performance anti-patterns
 *
 * Detects:
 * - Inefficient loops and O(n²) operations
 * - Memory leaks (unclosed resources, unremoved listeners)
 * - Blocking operations
 * - Unnecessary re-renders
 * - Large bundle/import issues
 */

import type { DetectedIssue } from '../types/analysis';

export class PerformanceDetector {
	/**
	 * Detect all performance issues in code
	 */
	detectIssues(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];

		issues.push(...this.detectInefficientLoops(content, filename, language));
		issues.push(...this.detectMemoryLeaks(content, filename, language));
		issues.push(...this.detectBlockingOperations(content, filename, language));
		issues.push(...this.detectUnnecessaryReRenders(content, filename, language));
		issues.push(...this.detectLargeImports(content, filename, language));

		return issues;
	}

	/**
	 * Detect inefficient loop patterns and nested loops
	 */
	private detectInefficientLoops(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		// Detect nested loops (O(n²) complexity)
		let loopDepth = 0;
		const nestedLoopLines: number[] = [];

		lines.forEach((line, index) => {
			const trimmed = line.trim();

			// Detect loop starts
			if (
				/\bfor\s*\(/.test(trimmed) ||
				/\bwhile\s*\(/.test(trimmed) ||
				/\.forEach\(/.test(trimmed) ||
				/\.map\(/.test(trimmed)
			) {
				loopDepth++;
				if (loopDepth >= 2) {
					nestedLoopLines.push(index + 1);
				}
			}

			// Detect loop ends (approximate)
			if (trimmed === '}' && loopDepth > 0) {
				loopDepth--;
			}
		});

		if (nestedLoopLines.length > 0) {
			issues.push({
				id: `nested-loops-${filename}`,
				severity: 'warning',
				category: 'performance',
				title: 'Nested loops detected (potential O(n²) complexity)',
				description: 'Nested loops can cause performance issues with large datasets',
				files: [filename],
				lineNumbers: nestedLoopLines.slice(0, 5),
				suggestion: 'Consider using hash maps, Set, or preprocessing data structures',
				autoFixable: false
			});
		}

		// Detect array mutation inside loop bodies. The mutation normally sits on a
		// line below the loop header, so track where each body opens instead of
		// demanding both on the same line.
		//
		// Brace counting is load-bearing. Matching only a bare `}` never closed a
		// callback body, which ends `});`, and a single-line `.map(...)` opened a
		// level that nothing closed, so the depth leaked over the rest of the file
		// and reported mutations that were in no loop at all.
		let braceDepth = 0;
		const loopBodyDepths: number[] = [];

		lines.forEach((line, index) => {
			const trimmed = line.trim();
			const opensLoop =
				/\bfor\s*\(/.test(trimmed) ||
				/\bwhile\s*\(/.test(trimmed) ||
				/\.forEach\(/.test(trimmed) ||
				/\.map\(/.test(trimmed);
			const hasArrayMethod = /\.(?:push|concat|splice|shift|unshift)\(/.test(trimmed);

			const opens = (line.match(/\{/g) ?? []).length;
			const closes = (line.match(/\}/g) ?? []).length;

			// Close every body this line ends before judging the line itself.
			const depthAfterCloses = braceDepth - closes;
			while (
				loopBodyDepths.length > 0 &&
				depthAfterCloses <= loopBodyDepths[loopBodyDepths.length - 1]
			) {
				loopBodyDepths.pop();
			}

			const insideLoopBody = loopBodyDepths.length > 0;

			// A loop whose body opens on this line governs the lines below it, not
			// this one. A single-line loop opens no body and governs nothing.
			if (opensLoop && opens > closes) {
				loopBodyDepths.push(braceDepth);
			}
			braceDepth += opens - closes;

			if (insideLoopBody && hasArrayMethod) {
				issues.push({
					id: `loop-array-mutation-${filename}-${index}`,
					severity: 'info',
					category: 'performance',
					title: 'Array mutation inside loop',
					description: 'Repeatedly mutating arrays can be inefficient',
					files: [filename],
					lineNumbers: [index + 1],
					suggestion: 'Consider building a new array or using array methods like map/filter',
					autoFixable: false
				});
			}
		});

		return issues;
	}

	/**
	 * Detect potential memory leaks
	 */
	private detectMemoryLeaks(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];

		if (!['javascript', 'typescript'].includes(language)) {
			return issues;
		}

		const lines = content.split('\n');

		// Event listeners without removal
		let hasAddEventListener = false;
		let hasRemoveEventListener = false;

		lines.forEach((line, index) => {
			if (/addEventListener\(/.test(line)) {
				hasAddEventListener = true;
			}
			if (/removeEventListener\(/.test(line)) {
				hasRemoveEventListener = true;
			}

			// Detect setInterval without clearInterval
			if (/setInterval\(/.test(line)) {
				const hasClearing = content.includes('clearInterval');
				if (!hasClearing) {
					issues.push({
						id: `memory-leak-interval-${filename}-${index}`,
						severity: 'warning',
						category: 'performance',
						title: 'setInterval without clearInterval',
						description: 'Uncancelled intervals can cause memory leaks',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Store interval ID and call clearInterval in cleanup',
						autoFixable: false
					});
				}
			}

			// Detect setTimeout without cleanup
			if (/setTimeout\(/.test(line) && /useEffect|componentDidMount/.test(content)) {
				const hasClearing = content.includes('clearTimeout');
				if (!hasClearing) {
					issues.push({
						id: `memory-leak-timeout-${filename}-${index}`,
						severity: 'info',
						category: 'performance',
						title: 'setTimeout in effect without cleanup',
						description: 'Timeouts should be cleared when component unmounts',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Return cleanup function to clear timeout',
						autoFixable: false
					});
				}
			}
		});

		if (hasAddEventListener && !hasRemoveEventListener) {
			issues.push({
				id: `memory-leak-listeners-${filename}`,
				severity: 'warning',
				category: 'performance',
				title: 'Event listeners added but never removed',
				description: 'Unremoved event listeners can cause memory leaks',
				files: [filename],
				suggestion: 'Remove event listeners in cleanup/unmount',
				autoFixable: false
			});
		}

		return issues;
	}

	/**
	 * Detect blocking operations
	 */
	private detectBlockingOperations(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const blockingPatterns = [
			{ pattern: /fs\.readFileSync\(/, name: 'fs.readFileSync' },
			{ pattern: /fs\.writeFileSync\(/, name: 'fs.writeFileSync' },
			{ pattern: /execSync\(/, name: 'execSync' },
			{ pattern: /crypto\.pbkdf2Sync\(/, name: 'crypto.pbkdf2Sync' }
		];

		blockingPatterns.forEach(({ pattern, name }) => {
			lines.forEach((line, index) => {
				if (pattern.test(line)) {
					issues.push({
						id: `blocking-op-${filename}-${index}`,
						severity: 'warning',
						category: 'performance',
						title: `Blocking ${name} call`,
						description: 'Synchronous operations block the event loop and hurt performance',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: `Use async ${name.replace('Sync', '')} instead`,
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}

	/**
	 * Detect unnecessary re-renders in React/Svelte
	 */
	private detectUnnecessaryReRenders(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		// React: object/array literals in JSX
		if (content.includes('import React') || content.includes('from "react"')) {
			lines.forEach((line, index) => {
				// Detect inline object/array creation in props
				if (/\s+\w+\s*=\s*{[{[]/.test(line) && line.includes('=')) {
					issues.push({
						id: `react-inline-object-${filename}-${index}`,
						severity: 'info',
						category: 'performance',
						title: 'Inline object/array in JSX',
						description: 'Creating new object/array references on each render can cause unnecessary re-renders',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Define object/array outside component or use useMemo',
						autoFixable: false
					});
				}

				// Detect inline function definitions
				if (/onClick\s*=\s*{(?:\(\)|\w+)\s*=>/.test(line)) {
					issues.push({
						id: `react-inline-function-${filename}-${index}`,
						severity: 'info',
						category: 'performance',
						title: 'Inline function in JSX',
						description: 'Inline functions create new references on each render',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Use useCallback or define function outside render',
						autoFixable: false
					});
				}
			});
		}

		// Svelte: reactive statements overuse
		if (language === 'svelte') {
			let reactiveCount = 0;
			lines.forEach((line) => {
				if (/^\s*\$:/.test(line)) {
					reactiveCount++;
				}
			});

			if (reactiveCount > 10) {
				issues.push({
					id: `svelte-reactive-overuse-${filename}`,
					severity: 'info',
					category: 'performance',
					title: `Many reactive statements (${reactiveCount})`,
					description: 'Excessive reactive statements can impact performance',
					files: [filename],
					suggestion: 'Consider consolidating related reactive logic',
					autoFixable: false
				});
			}
		}

		return issues;
	}

	/**
	 * Detect large imports that could increase bundle size
	 */
	private detectLargeImports(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const largeLibraries = ['lodash', 'moment', 'jquery', 'rxjs'];

		lines.forEach((line, index) => {
			largeLibraries.forEach(lib => {
				// Default import of large library
				// [\w$] so `import $ from 'jquery'` and `import _ from 'lodash'` match.
				if (new RegExp(`import\\s+[\\w$]+\\s+from\\s+["']${lib}["']`).test(line)) {
					issues.push({
						id: `large-import-${filename}-${index}`,
						severity: 'info',
						category: 'performance',
						title: `Full ${lib} import detected`,
						description: `Importing entire ${lib} library increases bundle size`,
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: `Import specific functions: import { method } from '${lib}/method'`,
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}
}

export const performanceDetector = new PerformanceDetector();
