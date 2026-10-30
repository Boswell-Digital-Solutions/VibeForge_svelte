/**
 * POSIX path helpers for the analyzer lane.
 *
 * These stand in for the four `path` functions the analyzers use. Importing
 * `path` by name pulls the analyzer chain into the browser graph, where Vite
 * substitutes a shim that exports nothing and the build fails to resolve the
 * named imports. These are pure string operations, so a local copy keeps the
 * sync call sites sync and behaves identically in both contexts.
 *
 * Analyzer paths are repository paths, so POSIX separators are the only case
 * handled; a Windows drive path is out of scope here.
 */

function segments(p: string): string[] {
	return p.split('/').filter((segment) => segment.length > 0 && segment !== '.');
}

/**
 * Joins path parts with a single separator, preserving a leading slash.
 */
export function join(...parts: string[]): string {
	const present = parts.filter((part) => part.length > 0);
	const absolute = present[0]?.startsWith('/') ?? false;
	// A trailing separator is meaningful to callers that append to the result,
	// so carry it through the way `path.posix.join` does.
	const trailing = present[present.length - 1]?.endsWith('/') ?? false;

	const resolved: string[] = [];
	for (const segment of present.join('/').split('/')) {
		if (segment.length === 0 || segment === '.') {
			continue;
		}
		if (segment === '..') {
			const last = resolved[resolved.length - 1];
			if (resolved.length > 0 && last !== '..') {
				resolved.pop();
			} else if (!absolute) {
				resolved.push('..');
			}
			continue;
		}
		resolved.push(segment);
	}

	if (resolved.length === 0) {
		return absolute ? '/' : '.';
	}

	return `${absolute ? '/' : ''}${resolved.join('/')}${trailing ? '/' : ''}`;
}

/**
 * Returns the path of `to` relative to `from`.
 */
export function relative(from: string, to: string): string {
	const fromParts = segments(from);
	const toParts = segments(to);

	let shared = 0;
	while (shared < fromParts.length && shared < toParts.length && fromParts[shared] === toParts[shared]) {
		shared += 1;
	}

	const up = Array<string>(fromParts.length - shared).fill('..');
	return [...up, ...toParts.slice(shared)].join('/');
}

/**
 * Returns the final segment of a path.
 */
export function basename(p: string): string {
	const parts = segments(p);
	return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * Returns the extension of a path, including the leading dot, or '' if none.
 *
 * A leading dot on the final segment is a prefix, not an extension, so
 * '.gitignore' has none.
 */
export function extname(p: string): string {
	const name = basename(p);
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot) : '';
}
