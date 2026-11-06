/**
 * PerformanceDetector Unit Tests
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceDetector } from '../PerformanceDetector';

describe('PerformanceDetector', () => {
	let detector: PerformanceDetector;

	beforeEach(() => {
		detector = new PerformanceDetector();
	});

	// ============================================================================
	// INITIALIZATION
	// ============================================================================

	describe('Initialization', () => {
		it('should create detector instance', () => {
			expect(detector).toBeDefined();
			expect(detector).toBeInstanceOf(PerformanceDetector);
		});
	});

	// ============================================================================
	// INEFFICIENT LOOPS DETECTION
	// ============================================================================

	describe('detectInefficientLoops', () => {
		it('does not report an array mutation that is in no loop', () => {
			// A single-line `.map()` opens no body. Before brace counting it raised
			// the depth with nothing to lower it, so every later mutation in the
			// file was reported as being inside a loop.
			const code = [
				"import { items } from './data';",
				'',
				'export const ids = items.map((i) => i.id);',
				'',
				'export function collect(a, b) {',
				'  const out = [];',
				'  out.push(a);',
				'  out.push(b);',
				'  return out;',
				'}'
			].join('\n');

			const issues = detector.detectIssues(code, 'collect.ts', 'typescript');

			expect(issues.filter((i) => i.title.includes('Array mutation'))).toHaveLength(0);
		});

		it('stops reporting after a callback body closes with });', () => {
			const code = [
				'function build(items) {',
				'  const out = [];',
				'  items.forEach((i) => {',
				'    out.push(i);',
				'  });',
				'  out.push(1);',
				'  return out;',
				'}'
			].join('\n');

			const issues = detector
				.detectIssues(code, 'build.ts', 'typescript')
				.filter((i) => i.title.includes('Array mutation'));

			// The mutation inside the callback is real; the one after `});` is not.
			expect(issues).toHaveLength(1);
			expect(issues[0].lineNumbers).toEqual([4]);
		});

		it('should detect nested for loops', () => {
			const content = `
for (let i = 0; i < n; i++) {
	for (let j = 0; j < m; j++) {
		console.log(i, j);
	}
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const loopIssue = issues.find(i => i.title.includes('Nested loops'));

			expect(loopIssue).toBeDefined();
			expect(loopIssue?.severity).toBe('warning');
			expect(loopIssue?.category).toBe('performance');
		});

		it('should detect nested while loops', () => {
			const content = `
while (condition1) {
	while (condition2) {
		doWork();
	}
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const loopIssue = issues.find(i => i.title.includes('Nested loops'));

			expect(loopIssue).toBeDefined();
		});

		it('should detect forEach inside for loop', () => {
			const content = `
for (let i = 0; i < items.length; i++) {
	items.forEach(item => {
		process(item, i);
	});
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const loopIssue = issues.find(i => i.title.includes('Nested loops'));

			expect(loopIssue).toBeDefined();
		});

		it('should detect map inside for loop', () => {
			const content = `
for (let i = 0; i < n; i++) {
	const results = data.map(x => x * i);
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const loopIssue = issues.find(i => i.title.includes('Nested loops'));

			expect(loopIssue).toBeDefined();
		});

		it('should detect array mutation inside loops', () => {
			const content = `
for (let i = 0; i < n; i++) {
	arr.push(i);
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const mutationIssue = issues.find(i => i.title.includes('Array mutation'));

			expect(mutationIssue).toBeDefined();
			expect(mutationIssue?.severity).toBe('info');
		});

		it('should not flag single loops', () => {
			const content = `
for (let i = 0; i < n; i++) {
	console.log(i);
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const loopIssue = issues.find(i => i.title.includes('Nested loops'));

			expect(loopIssue).toBeUndefined();
		});

		it('should suggest better alternatives', () => {
			const content = `
for (let i = 0; i < n; i++) {
	for (let j = 0; j < m; j++) {
		if (arr[i] === arr[j]) found = true;
	}
}
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const loopIssue = issues.find(i => i.title.includes('Nested loops'));

			expect(loopIssue?.suggestion).toContain('hash map');
		});
	});

	// ============================================================================
	// MEMORY LEAKS DETECTION
	// ============================================================================

	describe('detectMemoryLeaks', () => {
		it('should detect addEventListener without removeEventListener', () => {
			const content = `
element.addEventListener('click', handler);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const leakIssue = issues.find(i => i.title.includes('Event listeners'));

			expect(leakIssue).toBeDefined();
			expect(leakIssue?.severity).toBe('warning');
			expect(leakIssue?.category).toBe('performance');
		});

		it('should not flag when removeEventListener is present', () => {
			const content = `
element.addEventListener('click', handler);
element.removeEventListener('click', handler);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const leakIssue = issues.find(i => i.title.includes('Event listeners'));

			expect(leakIssue).toBeUndefined();
		});

		it('should detect setInterval without clearInterval', () => {
			const content = `
setInterval(() => {
	updateData();
}, 1000);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const intervalIssue = issues.find(i => i.title.includes('setInterval'));

			expect(intervalIssue).toBeDefined();
			expect(intervalIssue?.severity).toBe('warning');
		});

		it('should not flag when clearInterval is present', () => {
			const content = `
const id = setInterval(() => updateData(), 1000);
clearInterval(id);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const intervalIssue = issues.find(i => i.title.includes('setInterval'));

			expect(intervalIssue).toBeUndefined();
		});

		it('should detect setTimeout without cleanup in effects', () => {
			const content = `
useEffect(() => {
	setTimeout(() => {
		doSomething();
	}, 1000);
});
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const timeoutIssue = issues.find(i => i.title.includes('setTimeout'));

			expect(timeoutIssue).toBeDefined();
			expect(timeoutIssue?.severity).toBe('info');
		});

		it('should not flag when clearTimeout is present', () => {
			const content = `
useEffect(() => {
	const id = setTimeout(() => doSomething(), 1000);
	return () => clearTimeout(id);
});
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const timeoutIssue = issues.find(i => i.title.includes('setTimeout'));

			expect(timeoutIssue).toBeUndefined();
		});

		it('should only check JavaScript/TypeScript', () => {
			const content = `
element.add_event_listener('click', handler)
			`;

			const issues = detector.detectIssues(content, 'test.py', 'python');
			const leakIssues = issues.filter(i => i.category === 'performance' && i.title.includes('listener'));

			expect(leakIssues.length).toBe(0);
		});
	});

	// ============================================================================
	// BLOCKING OPERATIONS DETECTION
	// ============================================================================

	describe('detectBlockingOperations', () => {
		it('should detect fs.readFileSync', () => {
			const content = `
const data = fs.readFileSync('file.txt', 'utf8');
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const blockingIssue = issues.find(i => i.title.includes('readFileSync'));

			expect(blockingIssue).toBeDefined();
			expect(blockingIssue?.severity).toBe('warning');
			expect(blockingIssue?.category).toBe('performance');
		});

		it('should detect fs.writeFileSync', () => {
			const content = `
fs.writeFileSync('output.txt', data);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const blockingIssue = issues.find(i => i.title.includes('writeFileSync'));

			expect(blockingIssue).toBeDefined();
		});

		it('should detect execSync', () => {
			const content = `
const result = execSync('ls -la');
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const blockingIssue = issues.find(i => i.title.includes('execSync'));

			expect(blockingIssue).toBeDefined();
		});

		it('should detect crypto.pbkdf2Sync', () => {
			const content = `
const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const blockingIssue = issues.find(i => i.title.includes('pbkdf2Sync'));

			expect(blockingIssue).toBeDefined();
		});

		it('should suggest async alternatives', () => {
			const content = `
const data = fs.readFileSync('file.txt');
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const blockingIssue = issues.find(i => i.title.includes('readFileSync'));

			expect(blockingIssue?.suggestion).toContain('async');
			expect(blockingIssue?.suggestion).toContain('readFile');
		});
	});

	// ============================================================================
	// UNNECESSARY RE-RENDERS DETECTION
	// ============================================================================

	describe('detectUnnecessaryReRenders', () => {
		it('should detect inline objects in React JSX', () => {
			const content = `
import React from 'react';
<Component style={{ margin: 10 }} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			const renderIssue = issues.find(i => i.title.includes('Inline object'));

			expect(renderIssue).toBeDefined();
			expect(renderIssue?.severity).toBe('info');
			expect(renderIssue?.category).toBe('performance');
		});

		it('should detect inline arrays in React JSX', () => {
			const content = `
import React from 'react';
<Component items={[1, 2, 3]} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			const renderIssue = issues.find(i => i.title.includes('Inline'));

			expect(renderIssue).toBeDefined();
		});

		it('should detect inline functions in React JSX', () => {
			const content = `
import React from 'react';
<button onClick={() => handleClick()} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			const renderIssue = issues.find(i => i.title.includes('Inline function'));

			expect(renderIssue).toBeDefined();
		});

		it('should suggest useMemo for objects', () => {
			const content = `
import React from 'react';
<Component data={{ x: 1, y: 2 }} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			const renderIssue = issues.find(i => i.title.includes('Inline'));

			expect(renderIssue?.suggestion).toContain('useMemo');
		});

		it('should suggest useCallback for functions', () => {
			const content = `
import React from 'react';
<button onClick={() => doWork()} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			const renderIssue = issues.find(i => i.title.includes('Inline function'));

			expect(renderIssue?.suggestion).toContain('useCallback');
		});

		it('should detect excessive reactive statements in Svelte', () => {
			const reactiveStatements = Array(15).fill('$: computed = value * 2;').join('\n');
			const content = `
${reactiveStatements}
			`;

			const issues = detector.detectIssues(content, 'test.svelte', 'svelte');
			const reactiveIssue = issues.find(i => i.title.includes('reactive statements'));

			expect(reactiveIssue).toBeDefined();
			expect(reactiveIssue?.severity).toBe('info');
		});

		it('should not flag reasonable reactive statement count', () => {
			const content = `
$: doubled = value * 2;
$: tripled = value * 3;
$: sum = doubled + tripled;
			`;

			const issues = detector.detectIssues(content, 'test.svelte', 'svelte');
			const reactiveIssue = issues.find(i => i.title.includes('reactive statements'));

			expect(reactiveIssue).toBeUndefined();
		});

		it('should only check React files when React is imported', () => {
			const content = `
<button onClick={() => handleClick()} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			// Should not detect because no React import
			const renderIssue = issues.find(i => i.title.includes('Inline function'));

			expect(renderIssue).toBeUndefined();
		});
	});

	// ============================================================================
	// LARGE IMPORTS DETECTION
	// ============================================================================

	describe('detectLargeImports', () => {
		it('should detect full lodash import', () => {
			const content = `
import _ from 'lodash';
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const importIssue = issues.find(i => i.title.includes('lodash'));

			expect(importIssue).toBeDefined();
			expect(importIssue?.severity).toBe('info');
			expect(importIssue?.category).toBe('performance');
		});

		it('should detect full moment import', () => {
			const content = `
import moment from 'moment';
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const importIssue = issues.find(i => i.title.includes('moment'));

			expect(importIssue).toBeDefined();
		});

		it('should detect full jquery import', () => {
			const content = `
import $ from 'jquery';
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const importIssue = issues.find(i => i.title.includes('jquery'));

			expect(importIssue).toBeDefined();
		});

		it('should detect full rxjs import', () => {
			const content = `
import Rx from 'rxjs';
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const importIssue = issues.find(i => i.title.includes('rxjs'));

			expect(importIssue).toBeDefined();
		});

		it('should suggest specific imports', () => {
			const content = `
import _ from 'lodash';
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const importIssue = issues.find(i => i.title.includes('lodash'));

			expect(importIssue?.suggestion).toContain('specific functions');
			expect(importIssue?.suggestion).toContain('lodash/method');
		});

		it('should not flag specific imports', () => {
			const content = `
import { debounce } from 'lodash';
import map from 'lodash/map';
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const importIssues = issues.filter(i => i.title.includes('import'));

			expect(importIssues.length).toBe(0);
		});
	});

	// ============================================================================
	// INTEGRATION TESTS
	// ============================================================================

	describe('Integration', () => {
		it('should detect multiple performance issues in same file', () => {
			const content = `
import _ from 'lodash';
import React from 'react';

element.addEventListener('click', handler);
const data = fs.readFileSync('file.txt');

for (let i = 0; i < n; i++) {
	for (let j = 0; j < m; j++) {
		arr.push(i * j);
	}
}

setInterval(() => {
	updateUI();
}, 100);

<Component onClick={() => doWork()} style={{ margin: 10 }} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');

			expect(issues.length).toBeGreaterThan(3);
			expect(issues.some(i => i.title.includes('Nested loops'))).toBe(true);
			expect(issues.some(i => i.title.includes('import'))).toBe(true);
			expect(issues.some(i => i.category === 'performance')).toBe(true);
		});

		it('should handle optimized code without issues', () => {
			const content = `
import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';

const handleClick = useCallback(() => doWork(), []);
const style = useMemo(() => ({ margin: 10 }), []);

const data = await fs.readFile('file.txt');

for (let i = 0; i < n; i++) {
	process(i);
}
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');

			// Should have minimal or no performance issues
			expect(issues.length).toBeLessThan(2);
		});
	});
});
