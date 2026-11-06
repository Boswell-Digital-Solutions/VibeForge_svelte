/**
 * File System Scanner
 *
 * Scans directories recursively and collects file information.
 * Detects file types and gathers metadata.
 */

import { analyzerFs } from './nodeFs';
import { join, relative, extname, basename } from './posixPath';
import type { FileInfo, FileType, FileScanResult } from '../types/analysis';

/**
 * Configuration for file system scanning
 */
export interface ScanConfig {
	/**
	 * Directories to exclude from scanning
	 */
	excludeDirs?: string[];

	/**
	 * File patterns to exclude (e.g., '*.log', 'coverage/*')
	 */
	excludePatterns?: string[];

	/**
	 * Maximum depth to scan (default: unlimited)
	 */
	maxDepth?: number;

	/**
	 * Whether to follow symbolic links (default: false)
	 */
	followSymlinks?: boolean;
}

/**
 * Default scan configuration
 */
const DEFAULT_CONFIG: Required<ScanConfig> = {
	excludeDirs: [
		'node_modules',
		'.git',
		'.svelte-kit',
		'build',
		'dist',
		'coverage',
		'.cache',
		'tmp',
		'temp'
	],
	excludePatterns: ['*.log', '*.lock', '.DS_Store', 'Thumbs.db'],
	maxDepth: Infinity,
	followSymlinks: false
};

/**
 * Detects file type from extension
 */
function detectFileType(extension: string): FileType {
	const ext = extension.toLowerCase();

	switch (ext) {
		case '.ts':
		case '.tsx':
		case '.mts':
		case '.cts':
			return 'typescript';
		case '.js':
		case '.jsx':
		case '.mjs':
		case '.cjs':
			return 'javascript';
		case '.svelte':
			return 'svelte';
		case '.css':
		case '.scss':
		case '.sass':
		case '.less':
			return 'css';
		case '.html':
		case '.htm':
			return 'html';
		case '.json':
		case '.jsonc':
			return 'json';
		case '.md':
		case '.markdown':
			return 'markdown';
		default:
			return 'other';
	}
}

/**
 * Counts lines in file content
 */
function countLines(content: string): number {
	if (content.length === 0) return 0;
	return content.split('\n').length;
}

/**
 * Determines if a file is a test file
 */
function isTestFile(filePath: string): boolean {
	const baseName = basename(filePath);
	return (
		baseName.includes('.test.') ||
		baseName.includes('.spec.') ||
		baseName.includes('_test.') ||
		baseName.includes('_spec.') ||
		filePath.includes('__tests__') ||
		filePath.includes('/tests/') ||
		filePath.includes('/test/')
	);
}

/**
 * Checks if a path should be excluded based on config
 */
function shouldExclude(
	relativePath: string,
	config: Required<ScanConfig>,
	isDirectory: boolean
): boolean {
	const parts = relativePath.split('/');

	// Check excluded directories
	if (isDirectory && config.excludeDirs.some((dir) => parts.includes(dir))) {
		return true;
	}

	// Check excluded patterns
	for (const pattern of config.excludePatterns) {
		if (pattern.includes('*')) {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'));
			if (regex.test(relativePath)) {
				return true;
			}
		} else if (relativePath.includes(pattern)) {
			return true;
		}
	}

	return false;
}

/**
 * File System Scanner
 *
 * Scans directories and collects file information
 */
export class FileSystemScanner {
	private config: Required<ScanConfig>;

	constructor(config: ScanConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Scans a directory and returns file information
	 */
	async scan(rootPath: string): Promise<FileScanResult> {
		const files: FileInfo[] = [];
		const directories: string[] = [];
		let totalSize = 0;

		await this.scanDirectory(rootPath, rootPath, files, directories, 0);

		// Calculate totals
		for (const file of files) {
			totalSize += file.size;
		}

		// Count by type
		const filesByType: Record<FileType, number> = {
			typescript: 0,
			javascript: 0,
			svelte: 0,
			css: 0,
			html: 0,
			json: 0,
			markdown: 0,
			other: 0
		};

		for (const file of files) {
			filesByType[file.type]++;
		}

		const testFiles = files.filter((f) => f.isTest).length;
		const sourceFiles = files.length - testFiles;

		return {
			files,
			totalFiles: files.length,
			totalDirectories: directories.length,
			totalSize,
			filesByType,
			testFiles,
			sourceFiles
		};
	}

	/**
	 * Recursively scans a directory
	 */
	private async scanDirectory(
		rootPath: string,
		currentPath: string,
		files: FileInfo[],
		directories: string[],
		depth: number
	): Promise<void> {
		// Check max depth
		if (depth > this.config.maxDepth) {
			return;
		}

		// Resolved outside the try: the catch below turns a failure into an empty
		// branch, and a missing filesystem must not read as a scan of no files.
		const fs = await analyzerFs();

		try {
			const entries = await fs.readdir(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentPath, entry.name);
				const relativePath = relative(rootPath, fullPath);

				// Check if should exclude
				if (shouldExclude(relativePath, this.config, entry.isDirectory())) {
					continue;
				}

				if (entry.isDirectory()) {
					directories.push(relativePath);
					await this.scanDirectory(rootPath, fullPath, files, directories, depth + 1);
				} else if (entry.isFile()) {
					const fileInfo = await this.getFileInfo(rootPath, fullPath, relativePath);
					files.push(fileInfo);
				} else if (entry.isSymbolicLink() && this.config.followSymlinks) {
					// Handle symlinks if configured
					const stats = await fs.stat(fullPath);
					if (stats.isDirectory()) {
						directories.push(relativePath);
						await this.scanDirectory(rootPath, fullPath, files, directories, depth + 1);
					} else if (stats.isFile()) {
						const fileInfo = await this.getFileInfo(rootPath, fullPath, relativePath);
						files.push(fileInfo);
					}
				}
			}
		} catch (error) {
			console.error(`Error scanning directory ${currentPath}:`, error);
		}
	}

	/**
	 * Gets detailed file information
	 */
	private async getFileInfo(
		rootPath: string,
		fullPath: string,
		relativePath: string
	): Promise<FileInfo> {
		const fs = await analyzerFs();
		const stats = await fs.stat(fullPath);
		const extension = extname(fullPath);
		const type = detectFileType(extension);

		// Read file content to count lines
		let lines = 0;
		try {
			const content = await fs.readFile(fullPath, 'utf-8');
			lines = countLines(content);
		} catch (error) {
			// If file can't be read as text, skip line counting
			console.warn(`Could not read file ${relativePath}:`, error);
		}

		return {
			path: fullPath,
			relativePath,
			type,
			extension,
			size: stats.size,
			lines,
			isTest: isTestFile(relativePath),
			lastModified: stats.mtime.toISOString()
		};
	}

	/**
	 * Updates scan configuration
	 */
	setConfig(config: Partial<ScanConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Gets current configuration
	 */
	getConfig(): ScanConfig {
		return { ...this.config };
	}
}
