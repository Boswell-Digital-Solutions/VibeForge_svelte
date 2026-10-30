/**
 * The local inference lane's bridge boundary.
 *
 * NeuronForge Local holds inference responsibility; VibeForge holds developer
 * authority. Between them sits a trusted desktop bridge, and this module is
 * the application's side of that seam: the state the lane can be in, the
 * refusals the service can answer with, and the rules the bridge must obey.
 *
 * WHY THERE IS NO BROWSER IMPLEMENTATION, AND CANNOT BE
 *
 * The service's `LocalCallerBoundary` denies any request carrying an `Origin`
 * header with 403 `invalid_local_caller`, before parsing a body or touching a
 * device. A browser sends `Origin` on exactly this kind of request, so a
 * webview `fetch` cannot reach the node even with a correct capability. The
 * boundary also requires a loopback `Host` whose port matches the server's.
 *
 * So the bridge is not a convenience or an abstraction for testing. It is the
 * only shape of caller the service admits, and the capability it must present
 * is one the boundary's own docstring says goes to a service and its trusted
 * proxy and "never the webview".
 *
 * THE PERMISSION RULES, WHICH `__tests__/bridge.test.ts` ENFORCES
 *
 * 1. The capability never enters this repository's browser surface: no
 *    `VITE_`-prefixed variable, no `localStorage`, no `sessionStorage`, no
 *    cookie. Vite inlines every `VITE_` variable into client JavaScript, so a
 *    capability placed in one is published.
 * 2. This module exposes no execution surface. The contract for execution is
 *    defined in `contract.ts` so it can be reviewed; issuing one is a later,
 *    separately authorized slice.
 * 3. No cloud fallback. An unavailable local lane is a reported state, never a
 *    silent escalation.
 */

import type { NfNodeCapabilities, NfNodeHealth } from './contract';

/**
 * The refusals `LocalCallerBoundary` produces, with the status each carries.
 *
 * These are the service's own reason strings. A caller that cannot name which
 * of them it received cannot tell a missing capability from a browser-shaped
 * request, and would report the wrong thing to the developer.
 */
export const BRIDGE_REFUSALS = {
	/** 403. An `Origin` header, a missing or duplicated `Host`, or a non-loopback host. */
	invalid_local_caller: 403,
	/** 401. The capability header was absent, duplicated, or did not match. */
	local_capability_required: 401,
	/** 503. The service has no usable capability configured to compare against. */
	local_capability_unconfigured: 503,
	/** 415. A POST to `/nf-node/*` without exactly one `application/json` content type. */
	application_json_required: 415
} as const;

export type BridgeRefusal = keyof typeof BRIDGE_REFUSALS;

/** True when `reason` is one of the service's refusal strings. */
export function isBridgeRefusal(reason: string): reason is BridgeRefusal {
	return Object.prototype.hasOwnProperty.call(BRIDGE_REFUSALS, reason);
}

/** The status the service pairs with a refusal, or null if not a known refusal. */
export function statusForRefusal(reason: string): number | null {
	return isBridgeRefusal(reason) ? BRIDGE_REFUSALS[reason] : null;
}

/**
 * What the developer is told about the local lane.
 *
 * Every state is explicit and distinguishable. There is no state meaning
 * "probably fine", and none that a caller can mistake for ready.
 */
export type LocalLaneState =
	/** The node answered, the runtime is up, and these models can be requested. */
	| { kind: 'ready'; models: string[]; residentModels: string[] }
	/** The node answered and reported its own runtime as not usable. */
	| { kind: 'runtime_degraded'; reason: string }
	/** The service refused the caller. `refusal` says which rule. */
	| { kind: 'refused'; refusal: BridgeRefusal; status: number }
	/** Nothing answered on the loopback address. */
	| { kind: 'unreachable'; detail: string }
	/** There is no desktop bridge in this context, so the lane cannot be reached. */
	| { kind: 'bridge_absent' };

/**
 * What the desktop bridge must provide.
 *
 * Read-only, and deliberately so: this slice establishes readiness and
 * refusal reporting. The bridge sets the capability header itself, from a
 * source the webview cannot read, which is why no token is a parameter here.
 */
export interface LocalLaneBridge {
	health(): Promise<NfNodeHealth>;
	capabilities(): Promise<NfNodeCapabilities>;
}

/** Thrown by a bridge when the service refused the caller. */
export class BridgeRefusedError extends Error {
	constructor(
		readonly refusal: BridgeRefusal,
		readonly status: number
	) {
		super(`the local node refused the caller: ${refusal} (${status})`);
		this.name = 'BridgeRefusedError';
	}
}

/**
 * Resolves what to tell the developer about the local lane.
 *
 * Reads the body, never the status code. `/nf-node/health` answers 200 with
 * `status: 'degraded'` when the runtime is down, so a caller keyed on the
 * status code would report a healthy lane over a dead runtime. The route's own
 * docstring says so, and this is where that discipline is kept.
 */
export async function resolveLocalLaneState(
	bridge: LocalLaneBridge | null
): Promise<LocalLaneState> {
	if (!bridge) {
		return { kind: 'bridge_absent' };
	}

	let health: NfNodeHealth;
	try {
		health = await bridge.health();
	} catch (cause) {
		return describeFailure(cause);
	}

	if (health.status !== 'ok') {
		return { kind: 'runtime_degraded', reason: health.error ?? health.status };
	}

	let capabilities: NfNodeCapabilities;
	try {
		capabilities = await bridge.capabilities();
	} catch (cause) {
		return describeFailure(cause);
	}

	if (capabilities.health_status !== 'ok') {
		return { kind: 'runtime_degraded', reason: capabilities.error ?? capabilities.health_status };
	}

	return {
		kind: 'ready',
		models: capabilities.available_models,
		residentModels: (capabilities.resident_models ?? []).map((model) => model.name)
	};
}

function describeFailure(cause: unknown): LocalLaneState {
	if (cause instanceof BridgeRefusedError) {
		return { kind: 'refused', refusal: cause.refusal, status: cause.status };
	}
	return {
		kind: 'unreachable',
		detail: cause instanceof Error ? cause.message : String(cause)
	};
}

/**
 * One line for the developer, naming the real reason.
 *
 * A refusal is actionable and a degraded runtime is not the same problem, so
 * they do not collapse into "unavailable".
 */
export function describeLocalLaneState(state: LocalLaneState): string {
	switch (state.kind) {
		case 'ready':
			return `Local inference ready, ${state.models.length} model(s) available`;
		case 'runtime_degraded':
			return `Local runtime is not usable: ${state.reason}`;
		case 'refused':
			return `Local node refused the bridge: ${state.refusal}`;
		case 'unreachable':
			return `No local node answered: ${state.detail}`;
		case 'bridge_absent':
			return 'Local inference needs the desktop bridge; it is not available here';
	}
}
