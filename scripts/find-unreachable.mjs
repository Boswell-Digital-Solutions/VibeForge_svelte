#!/usr/bin/env node
/**
 * Reports which files under `src/lib` nothing live can reach.
 *
 * Builds an import graph from the route entry points and follows it
 * transitively. A grep per candidate cannot answer this: barrels re-export, so
 * a component can be reached by a live route through two hops of `index.ts`
 * and never appear in a grep near a route.
 *
 * WHAT "UNREACHABLE" DOES AND DOES NOT MEAN
 *
 * Unreachable from a route does **not** mean dead. `src/lib/core/neuronforge/`
 * is reachable only from its own tests, deliberately: the local inference lane
 * ships its contract and transport ahead of the UI that will consume them. A
 * sweep that deleted everything in the `orphan` bucket would have destroyed
 * it. Read the buckets as questions to answer, not as a delete list.
 *
 * SAFE-TO-DELETE IS A NARROWER TEST THAN UNREACHABLE
 *
 * `tsconfig.json` excludes `**\/archive\/**` but nothing else, so `svelte-check`
 * checks every other file under `src/` whether a route reaches it or not.
 * Deleting a file that an unreachable-but-still-checked file imports therefore
 * breaks `pnpm run check`. That is not theoretical: it happened during the
 * 2026-10-30 sweep, when removing `src/lib/api/runtimeClient.ts` broke
 * `src/lib/components/dev-environment/ToolchainsConfig.svelte`, a file nothing
 * imports at all. So the `deletable` bucket below requires both that nothing
 * live reaches a file and that nothing type-checked imports it.
 *
 * A THIRD WAY A FILE CAN BE REACHED
 *
 * Not every entry point is an import. `src/tests/setup.ts` is named in
 * `vitest.config.ts` and nothing imports it, so a pure import graph calls it
 * unreachable and a sweep would delete the test harness. The config files
 * below are therefore scanned for paths and anything they name is treated as a
 * root. This was learned from PR #17, which hit the same case by hand.
 *
 * Usage: node scripts/find-unreachable.mjs [--deletable]
 *   (no flag)    full report, grouped by what can reach each file
 *   --deletable  only the files that are safe to delete today, one per line
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const SRC = resolve('src');
const LIB = join(SRC, 'lib');
const ARCHIVE = join(SRC, 'archive');
const ROUTES = join(SRC, 'routes');
const deletableOnly = process.argv.includes('--deletable');

function walk(dir, out = []) {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (/\.(svelte|ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
	}
	return out;
}

const all = walk(SRC);
const isTest = (f) =>
	f.startsWith(join(SRC, 'tests')) || f.includes('/__tests__/') || /\.(test|spec)\.[tj]s$/.test(f);
const isArchive = (f) => f.startsWith(ARCHIVE);

/** Resolve an import specifier to a file on disk, or null for a package. */
function resolveImport(spec, fromFile) {
	let base;
	if (spec === '$lib') base = LIB;
	else if (spec.startsWith('$lib/')) base = join(LIB, spec.slice('$lib/'.length));
	else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec);
	else return null;

	for (const candidate of [
		base,
		`${base}.ts`,
		`${base}.js`,
		`${base}.svelte`,
		join(base, 'index.ts'),
		join(base, 'index.js'),
		join(base, 'index.svelte')
	]) {
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

/** Static, type-only, dynamic and re-export specifiers in one file. */
function importsOf(file) {
	const source = readFileSync(file, 'utf8');
	const specs = [];
	for (const re of [
		/\bfrom\s+["'`]([^"'`]+)["'`]/g,
		/\bimport\s*\(\s*["'`]([^"'`]+)["'`]/g,
		/\bimport\s+["'`]([^"'`]+)["'`]/g
	]) {
		for (const match of source.matchAll(re)) specs.push(match[1]);
	}
	return specs;
}

function reachFrom(roots) {
	const seen = new Set();
	const queue = [...roots];
	while (queue.length) {
		const file = queue.pop();
		if (seen.has(file)) continue;
		seen.add(file);
		for (const spec of importsOf(file)) {
			const target = resolveImport(spec, file);
			if (target && !seen.has(target)) queue.push(target);
		}
	}
	return seen;
}

/**
 * Files named in a configuration file rather than imported by code.
 *
 * Scanned rather than hard-coded, so adding a setup file to a config does not
 * silently make it look dead.
 */
const CONFIG_FILES = [
	'vite.config.ts',
	'vitest.config.ts',
	'svelte.config.js',
	'playwright.config.ts',
	'tailwind.config.js',
	'postcss.config.js'
];
function configNamedRoots() {
	const roots = [];
	for (const config of CONFIG_FILES) {
		if (!existsSync(config)) continue;
		const source = readFileSync(config, 'utf8');
		for (const match of source.matchAll(/["'`]([^"'`\n]*\/[^"'`\n]*)["'`]/g)) {
			const spec = match[1];
			if (!spec.includes('src/') && !spec.startsWith('./')) continue;
			const direct = resolve(spec.replace(/^\.\//, ''));
			for (const candidate of [direct, `${direct}.ts`, `${direct}.js`]) {
				if (existsSync(candidate) && statSync(candidate).isFile() && candidate.startsWith(SRC)) {
					roots.push(candidate);
				}
			}
		}
	}
	return [...new Set(roots)];
}

const configRoots = configNamedRoots();
const fromRoutes = reachFrom([
	...all.filter((f) => f.startsWith(ROUTES) && !isTest(f)),
	...configRoots
]);
const fromTests = reachFrom(all.filter(isTest));
const fromArchive = reachFrom(all.filter(isArchive));

/** Files svelte-check still reads: everything under src/ except src/archive. */
const typeChecked = all.filter((f) => !isArchive(f));
/** Direct importers, so a file kept alive only by a dead-but-checked file shows. */
const importedByChecked = new Set();
for (const file of typeChecked) {
	for (const spec of importsOf(file)) {
		const target = resolveImport(spec, file);
		if (target && target !== file) importedByChecked.add(target);
	}
}

const libFiles = all.filter((f) => f.startsWith(LIB) && !isTest(f));
const rel = (f) => relative(resolve('.'), f);

const buckets = { live: [], testOnly: [], archiveOnly: [], orphan: [] };
for (const file of libFiles) {
	if (fromRoutes.has(file)) buckets.live.push(file);
	else if (fromTests.has(file)) buckets.testOnly.push(file);
	else if (fromArchive.has(file)) buckets.archiveOnly.push(file);
	else buckets.orphan.push(file);
}

// Safe to delete: nothing live reaches it AND nothing still type-checked
// imports it, so removing it cannot break `pnpm run check`.
const deletable = [...buckets.archiveOnly, ...buckets.orphan].filter(
	(f) => !importedByChecked.has(f)
);

if (deletableOnly) {
	for (const file of deletable.sort()) console.log(rel(file));
	process.exit(0);
}

console.log(`\nsrc/lib source files (tests excluded): ${libFiles.length}`);
console.log(`  reachable from routes       : ${buckets.live.length}`);
console.log(`  reachable only from tests   : ${buckets.testOnly.length}  <- may be pending wiring`);
console.log(`  reachable only from archive : ${buckets.archiveOnly.length}`);
console.log(`  reachable from nothing      : ${buckets.orphan.length}`);
console.log(`\nof the last two, safe to delete today: ${deletable.length}`);
console.log('  (the rest are imported by a file svelte-check still reads)');

for (const [key, label] of [
	['archiveOnly', 'REACHABLE ONLY FROM src/archive'],
	['testOnly', 'REACHABLE ONLY FROM TESTS — check before deleting, this is where pending work lives'],
	['orphan', 'REACHABLE FROM NOTHING']
]) {
	const list = buckets[key];
	if (!list.length) continue;
	console.log(`\n--- ${label} (${list.length}) ---`);
	const byDir = new Map();
	for (const file of list.sort()) {
		const dir = dirname(rel(file));
		if (!byDir.has(dir)) byDir.set(dir, []);
		byDir.get(dir).push({
			name: rel(file).split('/').pop(),
			pinned: importedByChecked.has(file)
		});
	}
	for (const [dir, files] of [...byDir].sort()) {
		console.log(`  ${dir}/`);
		for (const f of files) {
			console.log(`      ${f.name}${f.pinned ? '   [kept alive by a type-checked file]' : ''}`);
		}
	}
}
console.log('');
