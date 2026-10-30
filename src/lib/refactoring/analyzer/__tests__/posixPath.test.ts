import { describe, it, expect } from 'vitest';
import * as nodePath from 'node:path';
import { join, relative, basename, extname } from '../posixPath';

/**
 * These helpers replaced `path` so the analyzer chain stays out of the browser
 * bundle. Pinning them against `node:path/posix` is what keeps the replacement
 * honest: a divergence here is a behavior change for every analyzer call site.
 */
describe('posixPath', () => {
	const joinCases: string[][] = [
		['/repo', 'src', 'a.ts'],
		['/repo', 'coverage', 'coverage-summary.json'],
		['/repo', 'package.json'],
		['repo', 'src'],
		['/repo', '', 'src'],
		['/repo/', '/src/'],
		['/repo/', 'src'],
		['repo/', 'sub/'],
		['/', 'a'],
		['a'],
		['/'],
		['/repo', './src'],
		['/repo', 'src/'],
		['', 'a'],
		['a', ''],
		['/repo', '../src'],
		['/', '../a'],
		['a', '../..'],
		['/repo', 'src/../lib'],
		['/repo', '.'],
		['.', 'a']
	];

	it.each(joinCases)('joins %# the way node does', (...parts) => {
		expect(join(...parts)).toBe(nodePath.posix.join(...parts));
	});

	const relativeCases: [string, string][] = [
		['/repo', '/repo/src/a.ts'],
		['/repo', '/repo'],
		['/repo', '/repo/'],
		['/repo/src', '/repo/lib/b.ts'],
		['/repo', '/other/x'],
		['/repo/a/b', '/repo'],
		['/a/b/c', '/a/b/c/d/e']
	];

	it.each(relativeCases)('relativizes %s -> %s the way node does', (from, to) => {
		expect(relative(from, to)).toBe(nodePath.posix.relative(from, to));
	});

	const nameCases = ['/repo/src/a.test.ts', 'a.ts', '/repo/src/', '.gitignore', '/repo'];

	it.each(nameCases)('takes the basename of %s the way node does', (p) => {
		expect(basename(p)).toBe(nodePath.posix.basename(p));
	});

	const extCases = ['/repo/src/a.test.ts', 'a.ts', '.gitignore', '/repo/src/noext', '/repo/a.b.c'];

	it.each(extCases)('takes the extension of %s the way node does', (p) => {
		expect(extname(p)).toBe(nodePath.posix.extname(p));
	});

	it('treats a leading dot as a prefix rather than an extension', () => {
		expect(extname('.gitignore')).toBe('');
	});
});
