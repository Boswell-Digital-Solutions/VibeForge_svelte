/**
 * Tech Stack Detector
 *
 * Detects framework, language, and dependencies from codebase analysis.
 */

import { analyzerFs } from './nodeFs';
import { join } from './posixPath';
import type { FileInfo, Framework, TechStack } from '../types/analysis';

/**
 * Tech Stack Detector
 *
 * Analyzes files and package.json to detect technology stack
 */
export class TechStackDetector {
	/**
	 * Detects tech stack from root path and files
	 */
	async detect(rootPath: string, files: FileInfo[]): Promise<TechStack> {
		const [framework, language, stateManagement, dependencies] = await Promise.all([
			this.detectFramework(rootPath, files),
			this.detectLanguage(files),
			this.detectStateManagement(rootPath, files),
			this.detectDependencies(rootPath)
		]);

		return {
			framework,
			language,
			stateManagement,
			dependencies
		};
	}

	/**
	 * Detects framework from package.json and file structure
	 */
	private async detectFramework(rootPath: string, files: FileInfo[]): Promise<Framework> {
		try {
			const packageJsonPath = join(rootPath, 'package.json');
			const fs = await analyzerFs();
			const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
			const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

			// Check for SvelteKit
			if (deps['@sveltejs/kit']) {
				return 'sveltekit';
			}

			// Check for Svelte
			if (deps['svelte']) {
				return 'svelte';
			}

			// Check for React frameworks
			if (deps['next']) {
				return 'nextjs';
			}

			if (deps['react']) {
				return 'react';
			}

			// Check for Vue
			if (deps['vue']) {
				return 'vue';
			}

			// No framework detected
			return 'unknown';
		} catch (error) {
			console.warn('Could not read package.json:', error);
			return 'unknown';
		}
	}

	/**
	 * Detects primary language from file distribution
	 */
	private detectLanguage(files: FileInfo[]): 'typescript' | 'javascript' {
		const tsFiles = files.filter((f) => f.type === 'typescript').length;
		const jsFiles = files.filter((f) => f.type === 'javascript').length;

		// If more than 50% of files are TypeScript, it's a TypeScript project
		if (tsFiles > jsFiles) {
			return 'typescript';
		}

		return 'javascript';
	}

	/**
	 * Detects state management approach
	 */
	private async detectStateManagement(
		rootPath: string,
		files: FileInfo[]
	): Promise<import('../types/analysis').StateManagement> {
		try {
			const packageJsonPath = join(rootPath, 'package.json');
			const fs = await analyzerFs();
			const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
			const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

			// Check for common state management libraries
			if (deps['redux'] || deps['@reduxjs/toolkit']) {
				return 'redux';
			}

			if (deps['zustand']) {
				return 'zustand';
			}

			if (deps['pinia']) {
				return 'pinia';
			}

			if (deps['vuex']) {
				return 'vuex';
			}

			// Check for Svelte-specific patterns
			const svelteFiles = files.filter((f) => f.extension === '.svelte');
			if (svelteFiles.length > 0) {
				// Check if using Svelte 5 runes by looking for .svelte.ts files
				const runeStores = files.filter((f) => f.relativePath.endsWith('.svelte.ts'));
				if (runeStores.length > 0) {
					return 'svelte-runes';
				}

				// Check for Svelte stores
				const storeFiles = files.filter(
					(f) =>
						f.relativePath.includes('store') &&
						(f.type === 'typescript' || f.type === 'javascript')
				);
				if (storeFiles.length > 0) {
					return 'svelte-stores';
				}
			}

			// No specific state management detected
			return 'none';
		} catch (error) {
			console.warn('Could not detect state management:', error);
			return 'none';
		}
	}

	/**
	 * Reads dependencies from package.json
	 */
	private async detectDependencies(
		rootPath: string
	): Promise<{ name: string; version: string; type: 'dependency' | 'devDependency' }[]> {
		try {
			const packageJsonPath = join(rootPath, 'package.json');
			const fs = await analyzerFs();
			const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

			const dependencies: { name: string; version: string; type: 'dependency' | 'devDependency' }[] =
				[];

			// Add regular dependencies
			if (packageJson.dependencies) {
				for (const [name, version] of Object.entries(packageJson.dependencies)) {
					dependencies.push({ name, version: version as string, type: 'dependency' });
				}
			}

			// Add dev dependencies
			if (packageJson.devDependencies) {
				for (const [name, version] of Object.entries(packageJson.devDependencies)) {
					dependencies.push({ name, version: version as string, type: 'devDependency' });
				}
			}

			return dependencies;
		} catch (error) {
			console.warn('Could not read dependencies:', error);
			return [];
		}
	}
}
