/**
 * Metrics Collector
 *
 * Collects metrics for test coverage, type safety, code quality, and size.
 */

import { analyzerFs } from './nodeFs';
import { join } from './posixPath';
import type {
	FileInfo,
	TestCoverageMetrics,
	TypeSafetyMetrics,
	CodeQualityMetrics,
	SizeMetrics
} from '../types/analysis';

/**
 * Test Coverage Collector
 *
 * Collects test coverage metrics from coverage reports
 */
export class CoverageCollector {
	/**
	 * Collects test coverage metrics
	 *
	 * @param rootPath - Root path of the project
	 * @param files - List of files from scan
	 * @returns Test coverage metrics
	 */
	async collect(rootPath: string, files: FileInfo[]): Promise<TestCoverageMetrics> {
		// Try to read coverage data from common locations
		const coverageData = await this.readCoverageData(rootPath);

		if (coverageData) {
			return coverageData;
		}

		// Fallback: Calculate from test files
		const testFiles = files.filter((f) => f.isTest);
		const totalTests = testFiles.length;

		return {
			lines: 0,
			statements: 0,
			branches: 0,
			functions: 0,
			uncoveredFiles: [],
			totalTests,
			passingTests: 0,
			failingTests: 0
		};
	}

	/**
	 * Attempts to read coverage data from common locations
	 */
	private async readCoverageData(rootPath: string): Promise<TestCoverageMetrics | null> {
		const coveragePaths = [
			join(rootPath, 'coverage', 'coverage-summary.json'),
			join(rootPath, 'coverage', 'coverage-final.json'),
			join(rootPath, '.coverage', 'coverage.json')
		];

		const fs = await analyzerFs();

		for (const path of coveragePaths) {
			try {
				const content = await fs.readFile(path, 'utf-8');
				const data = JSON.parse(content);

				// Parse coverage data (format varies by tool)
				if (data.total) {
					return {
						lines: data.total.lines?.pct || 0,
						statements: data.total.statements?.pct || 0,
						branches: data.total.branches?.pct || 0,
						functions: data.total.functions?.pct || 0,
						uncoveredFiles: [],
						totalTests: 0,
						passingTests: 0,
						failingTests: 0
					};
				}
			} catch (error) {
				// Continue to next path
				continue;
			}
		}

		return null;
	}
}

/**
 * Type Safety Collector
 *
 * Collects type safety metrics from TypeScript compilation
 */
export class TypeSafetyCollector {
	/**
	 * Collects type safety metrics
	 */
	async collect(rootPath: string, files: FileInfo[]): Promise<TypeSafetyMetrics> {
		const totalFiles = files.length;
		const typedFiles = files.filter(
			(f) => f.type === 'typescript' || f.extension === '.ts' || f.extension === '.tsx'
		).length;
		const jsFiles = files.filter((f) => f.type === 'javascript').length;

		// Try to detect TypeScript configuration
		const tsConfigExists = await this.checkTsConfig(rootPath);
		const strictMode = await this.checkStrictMode(rootPath);

		return {
			totalFiles,
			typedFiles,
			jsFiles,
			anyTypeCount: 0, // Would need static analysis
			typeErrorCount: 0, // Would need to run tsc
			strictMode,
			noImplicitAny: strictMode, // Assume strict mode enables this
			typeCheckPassed: true // Assume passing unless we run tsc
		};
	}

	/**
	 * Checks if tsconfig.json exists
	 */
	private async checkTsConfig(rootPath: string): Promise<boolean> {
		try {
			const fs = await analyzerFs();
			await fs.readFile(join(rootPath, 'tsconfig.json'), 'utf-8');
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Checks if strict mode is enabled in tsconfig
	 */
	private async checkStrictMode(rootPath: string): Promise<boolean> {
		try {
			const fs = await analyzerFs();
			const content = await fs.readFile(join(rootPath, 'tsconfig.json'), 'utf-8');
			const config = JSON.parse(content);
			return config.compilerOptions?.strict === true;
		} catch {
			return false;
		}
	}
}

/**
 * Code Quality Collector
 *
 * Collects code quality metrics (complexity, todos, linting)
 */
export class QualityCollector {
	/**
	 * Collects code quality metrics
	 */
	async collect(rootPath: string, files: FileInfo[]): Promise<CodeQualityMetrics> {
		// Calculate file size metrics
		const fileSizes = files.map((f) => f.lines);
		const avgFileSize = fileSizes.length > 0 ? fileSizes.reduce((a, b) => a + b, 0) / fileSizes.length : 0;
		const maxFileSize = Math.max(...fileSizes, 0);
		const largestFile = files.find((f) => f.lines === maxFileSize) || files[0];

		// Count TODO/FIXME comments
		const { todoCount, fixmeCount } = await this.countTodos(rootPath, files);

		return {
			avgFileSize: Math.round(avgFileSize),
			largestFile: largestFile
				? { path: largestFile.relativePath, lines: largestFile.lines }
				: { path: '', lines: 0 },
			avgFunctionLength: 0, // Would need static analysis
			maxComplexity: 0, // Would need static analysis
			todoCount,
			fixmeCount,
			eslintErrors: 0, // Would need to run ESLint
			eslintWarnings: 0 // Would need to run ESLint
		};
	}

	/**
	 * Counts TODO and FIXME comments in files
	 */
	private async countTodos(
		rootPath: string,
		files: FileInfo[]
	): Promise<{ todoCount: number; fixmeCount: number }> {
		let todoCount = 0;
		let fixmeCount = 0;

		// Only check source files (not node_modules, etc.)
		const sourceFiles = files.filter(
			(f) =>
				(f.type === 'typescript' || f.type === 'javascript' || f.type === 'svelte') && !f.isTest
		);

		const fs = await analyzerFs();

		for (const file of sourceFiles.slice(0, 100)) {
			// Limit to first 100 files for performance
			try {
				const content = await fs.readFile(file.path, 'utf-8');
				const todoMatches = content.match(/\/\/\s*TODO/gi) || [];
				const fixmeMatches = content.match(/\/\/\s*FIXME/gi) || [];
				todoCount += todoMatches.length;
				fixmeCount += fixmeMatches.length;
			} catch (error) {
				// Skip files that can't be read
				continue;
			}
		}

		return { todoCount, fixmeCount };
	}
}

/**
 * Size Metrics Collector
 *
 * Collects codebase size metrics
 */
export class SizeCollector {
	/**
	 * Collects size metrics
	 */
	async collect(rootPath: string, files: FileInfo[]): Promise<SizeMetrics> {
		const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

		// Estimate code vs comment vs blank lines
		// This is a rough estimate; actual counting would need file content parsing
		const estimatedCodeLines = Math.round(totalLines * 0.75);
		const estimatedCommentLines = Math.round(totalLines * 0.15);
		const estimatedBlankLines = Math.round(totalLines * 0.1);

		return {
			totalLines,
			codeLines: estimatedCodeLines,
			commentLines: estimatedCommentLines,
			blankLines: estimatedBlankLines
		};
	}
}

/**
 * Metrics Collector
 *
 * Orchestrates collection of all metrics types
 */
export class MetricsCollector {
	private coverageCollector = new CoverageCollector();
	private typeSafetyCollector = new TypeSafetyCollector();
	private qualityCollector = new QualityCollector();
	private sizeCollector = new SizeCollector();

	/**
	 * Collects all metrics for a codebase
	 */
	async collect(rootPath: string, files: FileInfo[]) {
		const [testCoverage, typeSafety, quality, size] = await Promise.all([
			this.coverageCollector.collect(rootPath, files),
			this.typeSafetyCollector.collect(rootPath, files),
			this.qualityCollector.collect(rootPath, files),
			this.sizeCollector.collect(rootPath, files)
		]);

		return {
			testCoverage,
			typeSafety,
			quality,
			size
		};
	}
}
