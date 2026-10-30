/**
 * @vitest-environment jsdom
 *
 * Tests for the webview's handle on the desktop bridge.
 *
 * Two things are worth proving here, and neither is about the node:
 *
 * 1. In a plain browser the lane reports `bridge_absent` instead of throwing.
 *    The browser cannot reach the node at all — its `Origin` header is
 *    refused — so an exception would be the wrong shape for an expected state.
 * 2. A failed invoke becomes `unreachable`, not a refusal. The node's refusals
 *    arrive inside a resolved lane state; an invoke that rejects means the
 *    bridge itself did not answer, which is a different problem.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

const { hasDesktopBridge, requestLocalLaneState } = await import('../desktopBridge');

/** Tauri marks its webview with this; nothing else in the app sets it. */
const TAURI_MARKER = '__TAURI_INTERNALS__';

function pretendDesktop(): void {
	(window as unknown as Record<string, unknown>)[TAURI_MARKER] = {};
}

beforeEach(() => {
	invoke.mockReset();
	delete (window as unknown as Record<string, unknown>)[TAURI_MARKER];
});

afterEach(() => {
	delete (window as unknown as Record<string, unknown>)[TAURI_MARKER];
});

describe('hasDesktopBridge', () => {
	it('is false in a plain browser', () => {
		expect(hasDesktopBridge()).toBe(false);
	});

	it('is true when the Tauri webview marker is present', () => {
		pretendDesktop();
		expect(hasDesktopBridge()).toBe(true);
	});
});

describe('requestLocalLaneState', () => {
	it('reports the bridge as absent in a browser, and asks nothing', async () => {
		await expect(requestLocalLaneState()).resolves.toEqual({ kind: 'bridge_absent' });
		// The important half: no attempt is made. A browser request would be
		// refused by the node's caller boundary, so making one would produce a
		// 403 that reads as a permissions problem rather than as "wrong host".
		expect(invoke).not.toHaveBeenCalled();
	});

	it('passes the lane state through untouched', async () => {
		pretendDesktop();
		// The real wire shape, from the file Rust is tested against, so this
		// cannot drift from what the command actually returns.
		const fixtures = JSON.parse(
			readFileSync(join(process.cwd(), 'src/lib/core/neuronforge/lane-state.fixtures.json'), 'utf8')
		);
		invoke.mockResolvedValue(fixtures.states.ready);

		await expect(requestLocalLaneState()).resolves.toEqual(fixtures.states.ready);
		expect(invoke).toHaveBeenCalledWith('neuronforge_lane_state');
	});

	it('passes a refusal through rather than re-deriving it', async () => {
		pretendDesktop();
		const refused = { kind: 'refused', refusal: 'invalid_local_caller', status: 403 };
		invoke.mockResolvedValue(refused);
		await expect(requestLocalLaneState()).resolves.toEqual(refused);
	});

	it('reports a failed invoke as unreachable, not as a refusal', async () => {
		pretendDesktop();
		invoke.mockRejectedValue(new Error('bridge did not answer'));

		const state = await requestLocalLaneState();
		expect(state.kind).toBe('unreachable');
		if (state.kind !== 'unreachable') {
			throw new Error('a failed invoke must not be reported as any other state');
		}
		expect(state.detail).toBe('bridge did not answer');
	});

	it('survives a rejection that is not an Error', async () => {
		pretendDesktop();
		// Tauri rejects with the command's error payload, which is not
		// necessarily an Error instance.
		invoke.mockRejectedValue('command panicked');

		const state = await requestLocalLaneState();
		expect(state).toEqual({ kind: 'unreachable', detail: 'command panicked' });
	});

	it('asks the command the Rust side actually exposes', async () => {
		pretendDesktop();
		invoke.mockResolvedValue({ kind: 'bridge_unconfigured', reason: 'not set' });
		await requestLocalLaneState();

		const [name] = invoke.mock.calls[0];
		// A renamed command fails at runtime with no compile-time signal, so the
		// name is checked against the Rust source rather than against itself.
		const rust = readFileSync(join(process.cwd(), 'src-tauri/src/neuronforge/mod.rs'), 'utf8');
		expect(rust).toContain(`pub fn ${name}()`);
		expect(rust).toContain('#[tauri::command]');
	});

	it('is registered in the Tauri handler, or the command does not exist', () => {
		// `generate_handler!` is what makes a `#[tauri::command]` callable.
		// Writing the command and forgetting this line is the quiet failure
		// this guards: the function compiles, and every invoke rejects.
		const main = readFileSync(join(process.cwd(), 'src-tauri/src/main.rs'), 'utf8');
		const handler = main.slice(main.indexOf('generate_handler!'));
		expect(handler).toContain('neuronforge_lane_state');
	});
});

describe('the capability boundary', () => {
	it('never names the capability anywhere in the webview module', () => {
		const source = readFileSync(
			join(process.cwd(), 'src/lib/core/neuronforge/desktopBridge.ts'),
			'utf8'
		);
		// The capability's own variable name must not appear even as a string:
		// this module has no business reading it, and the service's boundary
		// says it goes to a service and its trusted proxy, never the webview.
		expect(source).not.toContain('NEURONFORGE_LOCAL_CAPABILITY');
		expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
		expect(source).not.toMatch(/import\.meta\.env/);
	});

	it('returns a lane state only, so the capability cannot cross', async () => {
		pretendDesktop();
		// Even if the command were changed to leak one, the type is the
		// contract: this asserts the fixture shapes carry no secret-shaped
		// field, which is what a reviewer would look for.
		const fixtures = JSON.parse(
			readFileSync(join(process.cwd(), 'src/lib/core/neuronforge/lane-state.fixtures.json'), 'utf8')
		);
		for (const state of Object.values(fixtures.states) as Record<string, unknown>[]) {
			expect(Object.keys(state)).not.toContain('capability');
			expect(Object.keys(state)).not.toContain('token');
		}
	});
});
