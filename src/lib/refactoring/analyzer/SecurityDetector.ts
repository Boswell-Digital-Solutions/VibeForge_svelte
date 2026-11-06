/**
 * SecurityDetector - Detects common security vulnerabilities
 *
 * Detects:
 * - Hardcoded credentials and secrets
 * - SQL injection vulnerabilities
 * - XSS (Cross-Site Scripting) risks
 * - Unsafe eval/exec usage
 * - Insecure random number generation
 * - Path traversal vulnerabilities
 */

import type { DetectedIssue } from '../types/analysis';

export class SecurityDetector {
	/**
	 * Detect all security issues in code
	 */
	detectIssues(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];

		issues.push(...this.detectHardcodedSecrets(content, filename));
		issues.push(...this.detectSQLInjection(content, filename, language));
		issues.push(...this.detectXSS(content, filename, language));
		issues.push(...this.detectUnsafeEval(content, filename, language));
		issues.push(...this.detectWeakCrypto(content, filename, language));
		issues.push(...this.detectPathTraversal(content, filename, language));

		return issues;
	}

	/**
	 * Detect hardcoded passwords, API keys, tokens
	 */
	private detectHardcodedSecrets(content: string, filename: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const secretPatterns = [
			{ pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']+["']/i, name: 'password' },
			{ pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']+["']/i, name: 'API key' },
			{ pattern: /(?:secret|token)\s*[:=]\s*["'][^"']+["']/i, name: 'secret/token' },
			{ pattern: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI API key' },
			{ pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub token' },
			{ pattern: /xox[baprs]-[a-zA-Z0-9-]+/, name: 'Slack token' },
			{ pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS access key' }
		];

		secretPatterns.forEach(({ pattern, name }) => {
			lines.forEach((line, index) => {
				if (pattern.test(line)) {
					// Exclude common false positives
					if (
						line.includes('process.env') ||
						line.includes('import.meta.env') ||
						line.includes('config.') ||
						line.includes('placeholder') ||
						line.includes('example') ||
						line.includes('YOUR_')
					) {
						return;
					}

					issues.push({
						id: `hardcoded-secret-${filename}-${index}`,
						severity: 'error',
						category: 'security',
						title: `Potential hardcoded ${name} detected`,
						description: 'Hardcoded credentials should never be committed to source control',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Use environment variables or a secure secrets manager',
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}

	/**
	 * Detect SQL injection vulnerabilities
	 */
	private detectSQLInjection(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		// String concatenation in SQL queries
		const sqlConcatPatterns = [
			/(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)[\s\S]*?\+\s*(?:req\.|params\.|query\.|body\.|input)/gi,
			/(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]*?\$\{[^}]+\}/gi, // Template literals
			/\.query\s*\(\s*["'].*\+/gi, // query("SELECT * FROM users WHERE id=" + userId)
			/\.execute\s*\(\s*["'].*\+/gi
		];

		sqlConcatPatterns.forEach(pattern => {
			lines.forEach((line, index) => {
				if (pattern.test(line) && !line.includes('// SQL injection protected')) {
					issues.push({
						id: `sql-injection-${filename}-${index}`,
						severity: 'error',
						category: 'security',
						title: 'Potential SQL injection vulnerability',
						description: 'SQL query uses string concatenation with user input',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Use parameterized queries or prepared statements',
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}

	/**
	 * Detect XSS (Cross-Site Scripting) vulnerabilities
	 */
	private detectXSS(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];

		if (!['javascript', 'typescript'].includes(language)) {
			return issues;
		}

		const lines = content.split('\n');

		const xssPatterns = [
			/\.innerHTML\s*=\s*(?!["'`])/gi, // innerHTML = userInput
			/\.outerHTML\s*=\s*(?!["'`])/gi,
			/document\.write\s*\(/gi,
			/dangerouslySetInnerHTML/g, // React
			/{@html\s+[^}]+}/g // Svelte
		];

		xssPatterns.forEach(pattern => {
			lines.forEach((line, index) => {
				if (pattern.test(line)) {
					// Check if it's using a sanitization function
					if (
						line.includes('sanitize') ||
						line.includes('escape') ||
						line.includes('DOMPurify') ||
						line.includes('textContent')
					) {
						return;
					}

					issues.push({
						id: `xss-${filename}-${index}`,
						severity: 'error',
						category: 'security',
						title: 'Potential XSS vulnerability',
						description: 'Direct HTML injection without sanitization can lead to XSS attacks',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Sanitize user input with DOMPurify or use textContent instead',
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}

	/**
	 * Detect unsafe eval/exec usage
	 */
	private detectUnsafeEval(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const unsafePatterns = [
			{ pattern: /\beval\s*\(/, name: 'eval()' },
			{ pattern: /new\s+Function\s*\(/, name: 'new Function()' },
			{ pattern: /setTimeout\s*\(\s*["'`]/, name: 'setTimeout with string' },
			{ pattern: /setInterval\s*\(\s*["'`]/, name: 'setInterval with string' }
		];

		if (language === 'python') {
			unsafePatterns.push(
				{ pattern: /\bexec\s*\(/, name: 'exec()' },
				{ pattern: /\beval\s*\(/, name: 'eval()' }
			);
		}

		unsafePatterns.forEach(({ pattern, name }) => {
			lines.forEach((line, index) => {
				if (pattern.test(line)) {
					issues.push({
						id: `unsafe-eval-${filename}-${index}`,
						severity: 'error',
						category: 'security',
						title: `Unsafe ${name} usage detected`,
						description: `${name} can execute arbitrary code and is a major security risk`,
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Avoid dynamic code execution; use safer alternatives',
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}

	/**
	 * Detect weak cryptography
	 */
	private detectWeakCrypto(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const weakPatterns = [
			{ pattern: /Math\.random\(\)/, name: 'Math.random()' },
			{ pattern: /\bMD5\b/i, name: 'MD5 hashing' },
			{ pattern: /\bSHA1\b/i, name: 'SHA1 hashing' },
			{ pattern: /createHash\s*\(\s*["']md5["']\s*\)/i, name: 'MD5 in crypto' }
		];

		weakPatterns.forEach(({ pattern, name }) => {
			lines.forEach((line, index) => {
				if (pattern.test(line)) {
					// `random` is deliberately absent: Math.random() contains it, so
					// including it made this gate always true.
					const isCryptoContext = /crypto|password|token|key|secret/i.test(line);

					if (isCryptoContext || name.includes('MD5') || name.includes('SHA1')) {
						issues.push({
							id: `weak-crypto-${filename}-${index}`,
							severity: 'warning',
							category: 'security',
							title: `Weak cryptography: ${name}`,
							description: `${name} is not cryptographically secure`,
							files: [filename],
							lineNumbers: [index + 1],
							suggestion: name.includes('random')
								? 'Use crypto.randomBytes() or crypto.getRandomValues()'
								: 'Use SHA-256 or stronger hashing algorithms',
							autoFixable: false
						});
					}
				}
			});
		});

		return issues;
	}

	/**
	 * Detect path traversal vulnerabilities
	 */
	private detectPathTraversal(content: string, filename: string, language: string): DetectedIssue[] {
		const issues: DetectedIssue[] = [];
		const lines = content.split('\n');

		const pathPatterns = [
			/(?:fs\.readFile|fs\.readFileSync|fs\.writeFile|fs\.writeFileSync)\s*\(\s*(?:req\.|params\.|query\.)/gi,
			/__dirname\s*\+\s*(?:req\.|params\.|query\.)/gi,
			/path\.join\s*\([^)]*(?:req\.|params\.|query\.)[^)]*\)/gi
		];

		pathPatterns.forEach(pattern => {
			lines.forEach((line, index) => {
				if (pattern.test(line)) {
					// Check for path sanitization
					if (
						line.includes('path.normalize') ||
						line.includes('path.resolve') ||
						line.includes('sanitize') ||
						line.includes('basename')
					) {
						return;
					}

					issues.push({
						id: `path-traversal-${filename}-${index}`,
						severity: 'error',
						category: 'security',
						title: 'Potential path traversal vulnerability',
						description: 'File operations using unsanitized user input can allow directory traversal',
						files: [filename],
						lineNumbers: [index + 1],
						suggestion: 'Validate and sanitize file paths; use path.basename() to strip directory components',
						autoFixable: false
					});
				}
			});
		});

		return issues;
	}
}

export const securityDetector = new SecurityDetector();
