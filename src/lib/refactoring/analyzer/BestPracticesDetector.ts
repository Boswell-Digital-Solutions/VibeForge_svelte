/**
 * BestPracticesDetector - Detects code quality and best practice violations
 *
 * Detects:
 * - Missing error handling
 * - Magic numbers
 * - Dead code (unreachable, unused)
 * - Inconsistent naming
 * - Missing documentation
 * - TODO/FIXME comments
 */

import type { DetectedIssue } from '../types/analysis';

export class BestPracticesDetector {
	/**
	 * Detect all best practice violations
	 */
	detectIssues(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];

		issues.push(...this.detectMissingErrorHandling(content, filename, language));
		issues.push(...this.detectMagicNumbers(content, filename, language));
		issues.push(...this.detectDeadCode(content, filename, language));
		issues.push(...this.detectInconsistentNaming(content, filename, language));
		issues.push(...this.detectTODOComments(content, filename));
		issues.push(...this.detectEmptyBlocks(content, filename, language));

		return issues;
	}

	/**
	 * Detect missing try-catch or error handling
	 */
	private detectMissingErrorHandling(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		let hasAsyncFunction = false;
		let hasTryCatch = false;
		let asyncFunctionLines: number[] = [];

		lines.forEach((line, index) => {
			// Detect async functions
			if (/async\s+function|\basync\s*\(/.test(line)) {
				hasAsyncFunction = true;
				asyncFunctionLines.push(index + 1);
			}

			// Detect try-catch blocks
			if (/\btry\s*{/.test(line)) {
				hasTryCatch = true;
			}

			// Detect Promise without .catch()
			if (/\.then\(/.test(line) && !line.includes('.catch(') && !hasTryCatch) {
				issues.push({
					id: `missing-catch-${filename}-${index}`,
					severity: 'warning',
					category: 'code-quality',
					title: 'Promise without error handling',
					description: 'Unhandled promise rejections can cause silent failures',
					files: [filename],
					lineNumbers: [index + 1],
					suggestion: 'Add .catch() or use try-catch with await',
					autoFixable: false
				});
			}

			// Detect fetch without error handling
			if (/\bfetch\(/.test(line)) {
				const nextLines = lines.slice(index, index + 5).join('\n');
				// The forward window only saw a try that follows the call, so a fetch
				// inside a try block was still flagged. hasTryCatch covers an
				// enclosing try opened above, as the .then() rule already does.
				if (!hasTryCatch && !nextLines.includes('.catch(') && !nextLines.includes('try')) {
					issues.push({
						id: `missing-fetch-error-${filename}-${index}`,
						severity: 'warning',
						category: 'code-quality',
						title: 'fetch() without error handling',
						description: 'Network requests should handle errors',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Add .catch() or wrap in try-catch',
						autoFixable: false
					});
				}
			}
		});

		// Check if async function has try-catch
		if (hasAsyncFunction && !hasTryCatch && asyncFunctionLines.length > 0) {
			issues.push({
				id: `async-no-try-${filename}`,
				severity: 'warning',
				category: 'code-quality',
				title: 'Async function without try-catch',
				description: 'Async functions should handle potential errors',
				files: [filename],
				lineNumbers: asyncFunctionLines.slice(0, 3),
				suggestion: 'Wrap await calls in try-catch blocks',
				autoFixable: false
			});
		}

		return issues;
	}

	/**
	 * Detect magic numbers (hardcoded numbers without context)
	 */
	private detectMagicNumbers(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		lines.forEach((line, index) => {
			// Exclude common acceptable numbers and declarations
			if (
				// Allows an optional type annotation: `const x: number = 10`.
				/const\s+\w+\s*(?::[^=]+)?=/.test(line) || // Constant declaration
				/\b[01]\b/.test(line) ||        // 0 and 1 are acceptable
				line.includes('Math.') ||
				line.trim().startsWith('//')
			) {
				return;
			}

			// Find hardcoded numbers > 1 that aren't part of variable names
			const magicNumberPattern = /[^\w](\d{2,})[^\w]/g;
			const matches = [...line.matchAll(magicNumberPattern)];

			if (matches.length > 0) {
				const numbers = matches.map(m => m[1]).join(', ');
				issues.push({
					id: `magic-number-${filename}-${index}`,
					severity: 'info',
					category: 'code-quality',
					title: `Magic number(s) detected: ${numbers}`,
					description: 'Hardcoded numbers should be named constants for clarity',
					files: [filename],
					lineNumbers: [index + 1],
					suggestion: 'Extract to a named constant (e.g., const MAX_RETRIES = 3)',
					autoFixable: false
				});
			}
		});

		return issues;
	}

	/**
	 * Detect dead code (unreachable or commented out)
	 */
	private detectDeadCode(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		let afterReturn = false;
		const unreachableLines: number[] = [];

		lines.forEach((line, index) => {
			const trimmed = line.trim();

			// Reset on new function/block
			if (/^(?:function|const\s+\w+\s*=|class\s+)/.test(trimmed)) {
				afterReturn = false;
			}

			// Detect return statement
			if (/^return\b/.test(trimmed)) {
				afterReturn = true;
				return;
			}

			// Code after return (before next function)
			if (afterReturn && trimmed && !trimmed.startsWith('}') && !trimmed.startsWith('//')) {
				unreachableLines.push(index + 1);
			}

			// Any line that closes a block ends the region. This has to cover
			// `} catch (e) {`, `} else {` and `} finally {`, not just a bare `}`,
			// or the block that follows is wrongly reported as unreachable.
			if (trimmed.startsWith('}') || /^(?:catch|else|finally)\b/.test(trimmed)) {
				afterReturn = false;
			}
		});

		if (unreachableLines.length > 0) {
			issues.push({
				id: `unreachable-code-${filename}`,
				severity: 'warning',
				category: 'code-quality',
				title: 'Unreachable code detected',
				description: 'Code after return statement will never execute',
				files: [filename],
				lineNumbers: unreachableLines.slice(0, 5),
				suggestion: 'Remove unreachable code',
				autoFixable: true
			});
		}

		// Detect large blocks of commented code
		let commentBlock = 0;
		let commentBlockStart = 0;

		lines.forEach((line, index) => {
			const trimmed = line.trim();

			if (trimmed.startsWith('//') && !trimmed.includes('TODO') && !trimmed.includes('FIXME')) {
				if (commentBlock === 0) {
					commentBlockStart = index + 1;
				}
				commentBlock++;
			} else {
				if (commentBlock >= 5) {
					issues.push({
						id: `commented-code-${filename}-${commentBlockStart}`,
						severity: 'info',
						category: 'code-quality',
						title: `Large commented block (${commentBlock} lines)`,
						description: 'Consider removing commented code or documenting why it\'s kept',
						files: [filename],
						lineNumbers: [commentBlockStart],
						suggestion: 'Remove dead code or add explanation comment',
						autoFixable: false
					});
				}
				commentBlock = 0;
			}
		});

		return issues;
	}

	/**
	 * Detect inconsistent naming conventions
	 */
	private detectInconsistentNaming(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const variableNames: string[] = [];

		lines.forEach((line) => {
			// Extract variable declarations
			const varMatches = [
				...line.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g)
			];
			varMatches.forEach(match => variableNames.push(match[1]));
		});

		if (variableNames.length > 5) {
			const camelCase = variableNames.filter(name => /^[a-z][a-zA-Z0-9]*$/.test(name)).length;
			const snake_case = variableNames.filter(name => /^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')).length;
			const PascalCase = variableNames.filter(name => /^[A-Z][a-zA-Z0-9]*$/.test(name)).length;

			const total = camelCase + snake_case + PascalCase;
			const mostCommon = Math.max(camelCase, snake_case, PascalCase);

			// If naming is inconsistent (no style has >70% usage)
			if (total > 0 && (mostCommon / total) < 0.7) {
				issues.push({
					id: `inconsistent-naming-${filename}`,
					severity: 'info',
					category: 'code-quality',
					title: 'Inconsistent naming conventions',
					description: `Mix of camelCase (${camelCase}), snake_case (${snake_case}), and PascalCase (${PascalCase})`,
					files: [filename],
					suggestion: 'Use consistent naming convention (camelCase recommended for JS/TS)',
					autoFixable: false
				});
			}
		}

		return issues;
	}

	/**
	 * Detect TODO and FIXME comments
	 */
	private detectTODOComments(content: string, filename: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const todoLines: number[] = [];
		const fixmeLines: number[] = [];

		lines.forEach((line, index) => {
			if (/\/\/\s*TODO/i.test(line) || /\/\*\s*TODO/i.test(line)) {
				todoLines.push(index + 1);
			}
			if (/\/\/\s*FIXME/i.test(line) || /\/\*\s*FIXME/i.test(line)) {
				fixmeLines.push(index + 1);
			}
		});

		if (todoLines.length > 0) {
			issues.push({
				id: `todo-comments-${filename}`,
				severity: 'info',
				category: 'code-quality',
				title: `${todoLines.length} TODO comment(s) found`,
				description: 'TODO comments indicate incomplete work',
				files: [filename],
				lineNumbers: todoLines.slice(0, 10),
				suggestion: 'Address TODOs or create issue tickets',
				autoFixable: false
			});
		}

		if (fixmeLines.length > 0) {
			issues.push({
				id: `fixme-comments-${filename}`,
				severity: 'warning',
				category: 'code-quality',
				title: `${fixmeLines.length} FIXME comment(s) found`,
				description: 'FIXME comments indicate code that needs fixing',
				files: [filename],
				lineNumbers: fixmeLines.slice(0, 10),
				suggestion: 'Address FIXMEs before production deployment',
				autoFixable: false
			});
		}

		return issues;
	}

	/**
	 * Detect empty code blocks
	 */
	private detectEmptyBlocks(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		lines.forEach((line, index) => {
			const trimmed = line.trim();

			// Empty function bodies
			// Matches `function name() {}` and `() => {}`; the previous pattern
			// required `{}` directly after `function`, so declarations never hit.
			if (/(?:\bfunction\b[^(){}]*\([^()]*\)\s*|=>\s*)\{\s*\}\s*;?\s*$/.test(trimmed)) {
				issues.push({
					id: `empty-function-${filename}-${index}`,
					severity: 'warning',
					category: 'code-quality',
					title: 'Empty function body',
					description: 'Empty functions serve no purpose and should be removed or implemented',
					files: [filename],
					lineNumbers: [index + 1],
					suggestion: 'Implement function or remove if not needed',
					autoFixable: false
				});
			}

			// Empty catch blocks
			// Any binding name, or none, with the try's closing brace on the
			// same line as it is normally written.
			if (/\bcatch\s*(?:\([^()]*\)\s*)?\{\s*\}/.test(trimmed)) {
				issues.push({
					id: `empty-catch-${filename}-${index}`,
					severity: 'error',
					category: 'code-quality',
					title: 'Empty catch block',
					description: 'Silently swallowing errors makes debugging difficult',
					files: [filename],
					lineNumbers: [index + 1],
					suggestion: 'At minimum, log the error',
					autoFixable: false
				});
			}
		});

		return issues;
	}
}

export const bestPracticesDetector = new BestPracticesDetector();
