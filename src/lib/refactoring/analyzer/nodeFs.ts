/**
 * Filesystem access for the analyzer lane.
 *
 * The analyzers read a real repository from disk, so they only run where a
 * filesystem exists: the test suite, a server route, or the Tauri host. A
 * static `fs/promises` import would pull them into the browser graph and
 * break the build, so the specifier is held in a variable and marked
 * @vite-ignore to keep the bundler out of it.
 *
 * A browser caller that reaches this fails here, with a message naming the
 * reason, instead of on an opaque bundler shim.
 */

interface DirEntry {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
	isSymbolicLink(): boolean;
}

interface Stats {
	size: number;
	mtime: Date;
	isDirectory(): boolean;
	isFile(): boolean;
}

export interface AnalyzerFs {
	readdir(path: string, options: { withFileTypes: true }): Promise<DirEntry[]>;
	stat(path: string): Promise<Stats>;
	readFile(path: string, encoding: 'utf-8'): Promise<string>;
}

let cached: AnalyzerFs | null = null;

/**
 * Resolves the Node filesystem module, or throws if there is not one.
 */
export async function analyzerFs(): Promise<AnalyzerFs> {
	if (cached) {
		return cached;
	}

	const specifier = 'node:fs/promises';
	try {
		cached = (await import(/* @vite-ignore */ specifier)) as unknown as AnalyzerFs;
	} catch (cause) {
		throw new Error(
			'Codebase analysis needs filesystem access, which this context does not have.',
			{ cause }
		);
	}

	return cached;
}
