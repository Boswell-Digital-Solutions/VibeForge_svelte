/**
 * @vitest-environment node
 *
 * The webview's half of the bridge wire contract.
 *
 * `src-tauri/src/neuronforge/tests.rs` asserts that what Rust serialises
 * equals `lane-state.fixtures.json`. This asserts that what the fixture holds
 * is what this side's `LocalLaneState` describes, with every field reachable.
 *
 * Together they close a gap neither side can close alone: a key renamed in
 * Rust arrives here as `undefined` rather than as an error, so a test that
 * only read this side's own types would pass over a broken bridge. It already
 * caught one — Rust emitted `resident_models` where this side reads
 * `residentModels`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeLocalLaneState, type LocalLaneState } from '../bridge';

const FIXTURE_PATH = join(process.cwd(), 'src/lib/core/neuronforge/lane-state.fixtures.json');

type Fixtures = {
	rust_produced: string[];
	webview_only: string[];
	states: Record<string, unknown>;
};

const fixtures: Fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

/**
 * Reads a fixture as a `LocalLaneState`.
 *
 * The cast is the point of the exercise: it asserts the fixture is assignable
 * to the union, so `pnpm run check` fails if a fixture holds a shape the union
 * does not describe. The runtime assertions below then prove the fields the
 * application reads are actually present, which the type cannot.
 */
function state(name: string): LocalLaneState {
	const found = fixtures.states[name];
	if (!found) {
		throw new Error(`the fixture file declares no state named ${name}`);
	}
	return found as LocalLaneState;
}

describe('the lane state wire contract', () => {
	it('declares every state this side can be given', () => {
		// Written out rather than derived from the fixture, so a state added to
		// the fixture and not handled here does not pass unnoticed.
		expect(Object.keys(fixtures.states).sort()).toEqual([
			'bridge_absent',
			'bridge_unconfigured',
			'ready',
			'refused',
			'runtime_degraded',
			'unreachable'
		]);
	});

	it('splits the states by which side produces them, with no overlap', () => {
		expect(fixtures.rust_produced).not.toContain('bridge_absent');
		expect(fixtures.webview_only).toEqual(['bridge_absent']);

		const union = [...fixtures.rust_produced, ...fixtures.webview_only].sort();
		expect(union).toEqual(Object.keys(fixtures.states).sort());
	});

	it('reaches every field of a ready state', () => {
		const ready = state('ready');
		if (ready.kind !== 'ready') {
			throw new Error('the ready fixture does not carry kind "ready"');
		}
		// The assertion that matters: these are the keys the application reads,
		// and a Rust-side rename makes them undefined rather than an error.
		expect(ready.models).toEqual(['qwen2.5-coder:7b', 'llama3.1:8b']);
		expect(ready.residentModels).toEqual(['qwen2.5-coder:7b']);
	});

	it('reaches the reason on both states that carry one', () => {
		const degraded = state('runtime_degraded');
		if (degraded.kind !== 'runtime_degraded') {
			throw new Error('the runtime_degraded fixture does not carry its own kind');
		}
		expect(degraded.reason).toBe('ollama is not reachable');

		const unconfigured = state('bridge_unconfigured');
		if (unconfigured.kind !== 'bridge_unconfigured') {
			throw new Error('the bridge_unconfigured fixture does not carry its own kind');
		}
		expect(unconfigured.reason).toContain('NEURONFORGE_LOCAL_CAPABILITY');
	});

	it('reaches the refusal and its status', () => {
		const refused = state('refused');
		if (refused.kind !== 'refused') {
			throw new Error('the refused fixture does not carry kind "refused"');
		}
		expect(refused.refusal).toBe('invalid_local_caller');
		expect(refused.status).toBe(403);
	});

	it('reaches the detail of an unreachable node', () => {
		const unreachable = state('unreachable');
		if (unreachable.kind !== 'unreachable') {
			throw new Error('the unreachable fixture does not carry kind "unreachable"');
		}
		expect(unreachable.detail).toBe('connection refused');
	});

	// `describeLocalLaneState` is what the developer actually reads, so every
	// state must produce a line of its own. An unhandled variant would return
	// undefined, and the UI would show nothing where a reason belongs.
	it('describes every state distinctly', () => {
		const described = Object.keys(fixtures.states).map((name) =>
			describeLocalLaneState(state(name))
		);
		for (const line of described) {
			expect(typeof line).toBe('string');
			expect(line.length).toBeGreaterThan(0);
		}
		expect(new Set(described).size).toBe(described.length);
	});

	// A refusal and a local misconfiguration have different remedies, and the
	// whole reason `bridge_unconfigured` exists is to keep them apart.
	it('does not describe a misconfigured bridge as a refusal', () => {
		const unconfigured = describeLocalLaneState(state('bridge_unconfigured'));
		expect(unconfigured).not.toMatch(/refus/i);
		expect(describeLocalLaneState(state('refused'))).toMatch(/refus/i);
	});
});
