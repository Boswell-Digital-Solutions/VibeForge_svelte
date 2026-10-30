/**
 * The webview's handle on the desktop bridge.
 *
 * This is the only file on the browser side that talks to the bridge, and all
 * it does is ask. The capability stays in the Rust process: the command returns
 * a lane state and nothing else, so nothing here can read, log or store it.
 *
 * `bridge.ts` holds the state machine and its own permission tests assert that
 * it invokes nothing. That separation is deliberate — the transport is here,
 * the policy is there.
 */

import { invoke } from '@tauri-apps/api/core';
import type { LocalLaneState } from './bridge';

/** The Tauri command `src-tauri/src/neuronforge/mod.rs` exposes. */
const LANE_STATE_COMMAND = 'neuronforge_lane_state';

/**
 * True when a desktop bridge exists to ask.
 *
 * In a plain browser there is none, and the lane is unreachable by design:
 * the node refuses any request carrying an `Origin` header.
 */
export function hasDesktopBridge(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Asks the desktop bridge for the lane state.
 *
 * Returns `bridge_absent` rather than throwing when there is no bridge, so a
 * caller in a browser gets a state it can report instead of an exception. The
 * Rust side already returns a `LocalLaneState`, including its own
 * `bridge_unconfigured` variant for a missing or malformed capability, so this
 * does no mapping of its own.
 */
export async function requestLocalLaneState(): Promise<LocalLaneState> {
	if (!hasDesktopBridge()) {
		return { kind: 'bridge_absent' };
	}

	try {
		return await invoke<LocalLaneState>(LANE_STATE_COMMAND);
	} catch (cause) {
		// A failed invoke means the bridge did not answer at all, which is not
		// the same as the node refusing: the node's refusals arrive inside a
		// resolved lane state.
		return {
			kind: 'unreachable',
			detail: cause instanceof Error ? cause.message : String(cause)
		};
	}
}
