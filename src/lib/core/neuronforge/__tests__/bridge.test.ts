/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	CAPABILITY_ENV_VAR,
	CAPABILITY_HEADER,
	DELEGATION_SCHEMA_VERSION,
	NF_NODE_DEFAULT_AUTHORITY,
	NF_NODE_PREFIX
} from '../contract';
import {
	BRIDGE_REFUSALS,
	BridgeRefusedError,
	describeLocalLaneState,
	isBridgeRefusal,
	resolveLocalLaneState,
	statusForRefusal,
	type LocalLaneBridge
} from '../bridge';

const MODULE_DIR = join(process.cwd(), 'src/lib/core/neuronforge');

function bridge(parts: Partial<LocalLaneBridge>): LocalLaneBridge {
	return {
		health: parts.health ?? (async () => ({ status: 'ok', runtime: 'ollama', model_count: 1 })),
		capabilities:
			parts.capabilities ??
			(async () => ({ health_status: 'ok', available_models: ['llama3'] }))
	};
}

describe('the local lane contract', () => {
	// These restate the facts `service/nf_node_api.py` and
	// `service/local_caller_boundary.py` declare in forge-neuronforge. A second
	// statement is the point: if someone edits contract.ts to match a guess,
	// this fails.
	it('pins the route prefix and schema version', () => {
		expect(NF_NODE_PREFIX).toBe('/nf-node');
		expect(DELEGATION_SCHEMA_VERSION).toBe('NeuronForgeExecutionDelegation.v1');
		expect(NF_NODE_DEFAULT_AUTHORITY).toBe('127.0.0.1:8027');
	});

	it('pins the capability header and environment variable', () => {
		expect(CAPABILITY_HEADER).toBe('X-AuthorForge-NeuronForge-Capability');
		expect(CAPABILITY_ENV_VAR).toBe('NEURONFORGE_LOCAL_CAPABILITY');
	});

	it('pins every refusal the caller boundary produces, with its status', () => {
		expect(BRIDGE_REFUSALS).toEqual({
			invalid_local_caller: 403,
			local_capability_required: 401,
			local_capability_unconfigured: 503,
			application_json_required: 415
		});
	});

	it('recognises a refusal string and rejects anything else', () => {
		expect(isBridgeRefusal('local_capability_required')).toBe(true);
		expect(isBridgeRefusal('something_else')).toBe(false);
		expect(statusForRefusal('invalid_local_caller')).toBe(403);
		expect(statusForRefusal('something_else')).toBeNull();
	});

	// Drift detection against the real service, where a sibling checkout exists.
	// It is skipped rather than failed when absent, so CI stays hermetic.
	const sibling = join(process.cwd(), '..', 'forge-neuronforge');
	const hasSibling = existsSync(join(sibling, 'service/nf_node_api.py'));

	it.skipIf(!hasSibling)('matches the service source it is pinned to', () => {
		const api = readFileSync(join(sibling, 'service/nf_node_api.py'), 'utf-8');
		expect(api).toContain(`APIRouter(prefix="${NF_NODE_PREFIX}"`);
		expect(api).toContain(DELEGATION_SCHEMA_VERSION);
		for (const route of ['/health', '/capabilities', '/execute']) {
			expect(api).toContain(`"${route}"`);
		}

		const boundary = readFileSync(join(sibling, 'service/local_caller_boundary.py'), 'utf-8');
		for (const refusal of Object.keys(BRIDGE_REFUSALS)) {
			expect(boundary).toContain(refusal);
		}
	});
});

describe('resolveLocalLaneState', () => {
	it('reports ready with the available and resident models', async () => {
		const state = await resolveLocalLaneState(
			bridge({
				capabilities: async () => ({
					health_status: 'ok',
					available_models: ['llama3', 'qwen2.5'],
					resident_models: [{ name: 'llama3', size_vram: 1, expires_at: null }]
				})
			})
		);
		expect(state).toEqual({
			kind: 'ready',
			models: ['llama3', 'qwen2.5'],
			residentModels: ['llama3']
		});
	});

	// The discipline this whole module exists to keep. The service answers 200
	// with status 'degraded' when the runtime is down, so a caller reading the
	// status code would report a healthy lane over a dead runtime.
	it('does not report ready when the health body says degraded', async () => {
		const state = await resolveLocalLaneState(
			bridge({
				health: async () => ({ status: 'degraded', runtime: 'ollama', error: 'ollama_unreachable' })
			})
		);
		expect(state).toEqual({ kind: 'runtime_degraded', reason: 'ollama_unreachable' });
	});

	it('does not report ready when capabilities says offline', async () => {
		const state = await resolveLocalLaneState(
			bridge({
				capabilities: async () => ({
					health_status: 'offline',
					available_models: [],
					error: 'ollama_unreachable'
				})
			})
		);
		expect(state).toEqual({ kind: 'runtime_degraded', reason: 'ollama_unreachable' });
	});

	it.each([
		['invalid_local_caller', 403],
		['local_capability_required', 401],
		['local_capability_unconfigured', 503],
		['application_json_required', 415]
	] as const)('surfaces the %s refusal rather than collapsing it', async (refusal, status) => {
		const state = await resolveLocalLaneState(
			bridge({
				health: async () => {
					throw new BridgeRefusedError(refusal, status);
				}
			})
		);
		expect(state).toEqual({ kind: 'refused', refusal, status });
	});

	it('distinguishes nothing answering from a refusal', async () => {
		const state = await resolveLocalLaneState(
			bridge({
				health: async () => {
					throw new Error('ECONNREFUSED');
				}
			})
		);
		expect(state).toEqual({ kind: 'unreachable', detail: 'ECONNREFUSED' });
	});

	it('reports the bridge as absent rather than guessing', async () => {
		expect(await resolveLocalLaneState(null)).toEqual({ kind: 'bridge_absent' });
	});

	it('describes every state distinctly', () => {
		const described = [
			describeLocalLaneState({ kind: 'ready', models: ['a'], residentModels: [] }),
			describeLocalLaneState({ kind: 'runtime_degraded', reason: 'x' }),
			describeLocalLaneState({ kind: 'refused', refusal: 'local_capability_required', status: 401 }),
			describeLocalLaneState({ kind: 'unreachable', detail: 'y' }),
			describeLocalLaneState({ kind: 'bridge_absent' })
		];
		expect(new Set(described).size).toBe(described.length);
		// None of them may read as available.
		for (const line of described.slice(1)) {
			expect(line).not.toMatch(/\bready\b/i);
		}
	});
});

/**
 * Strips comments so these checks read code rather than prose.
 *
 * Without this, a comment documenting a rule trips the rule: bridge.ts's own
 * header explains that it must not touch `localStorage`, which a raw grep for
 * `localStorage` then reports as a violation.
 */
function codeOnly(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('the bridge permission boundary', () => {
	const sources = ['contract.ts', 'bridge.ts'].map((name) => ({
		name,
		text: codeOnly(readFileSync(join(MODULE_DIR, name), 'utf-8'))
	}));

	it('never reads a browser-exposed variable', () => {
		// Vite inlines every VITE_-prefixed variable into client JavaScript, so a
		// capability placed in one is published to anyone who loads the app.
		for (const { name, text } of sources) {
			expect(text, `${name} must not read import.meta.env`).not.toMatch(/import\.meta\.env/);
			expect(text, `${name} must not name a VITE_ variable`).not.toMatch(/VITE_[A-Z0-9_]+/);
		}
	});

	it('never touches browser storage', () => {
		for (const { name, text } of sources) {
			expect(text, `${name} must not use localStorage`).not.toMatch(/localStorage/);
			expect(text, `${name} must not use sessionStorage`).not.toMatch(/sessionStorage/);
			expect(text, `${name} must not use document.cookie`).not.toMatch(/document\.cookie/);
		}
	});

	it('carries no capability value, only its header and variable name', () => {
		// Matched against the shape the service itself accepts: its boundary
		// requires /[A-Za-z0-9_-]{32,512}/. That excludes a human-readable
		// message, which contains spaces, so only a real capability-shaped
		// token trips this. The header name is the one such string the module
		// is allowed to carry, and it is a name, not a value.
		const allowed = new Set<string>([CAPABILITY_HEADER]);
		for (const { name, text } of sources) {
			const tokenShaped = (
				text.match(/'[A-Za-z0-9_-]{32,512}'|"[A-Za-z0-9_-]{32,512}"/g) ?? []
			).map((literal) => literal.slice(1, -1));
			const unexpected = tokenShaped.filter((literal) => !allowed.has(literal));
			expect(unexpected, `${name} contains a capability-shaped literal`).toEqual([]);
		}
	});

	it('exposes no execution surface in this slice', async () => {
		const bridgeModule = await import('../bridge');
		const names = Object.keys(bridgeModule);
		for (const name of names) {
			expect(name).not.toMatch(/execute|generate|complete|infer|delegate/i);
		}
	});

	it('opens no connection of its own', () => {
		for (const { name, text } of sources) {
			expect(text, `${name} must not call fetch`).not.toMatch(/\bfetch\s*\(/);
			expect(text, `${name} must not construct a WebSocket`).not.toMatch(/new WebSocket/);
			expect(text, `${name} must not invoke a Tauri command directly`).not.toMatch(/\binvoke\s*\(/);
		}
	});

	it('offers no cloud fallback', () => {
		for (const { name, text } of sources) {
			expect(text, `${name} must not mention a cloud fallback path`).not.toMatch(
				/cloudFallback|fallbackToCloud|escalateToCloud/
			);
		}
	});
});
