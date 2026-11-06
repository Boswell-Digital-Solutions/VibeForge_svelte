/**
 * The NeuronForge Local node contract, as that service declares it.
 *
 * Every shape here is pinned to `service/nf_node_api.py` in
 * `Boswell-Digital-Solutions/forge-neuronforge`. Nothing is invented. When
 * that file changes, these types are wrong until they are updated, and
 * `__tests__/contract.test.ts` states the pinned facts so a drift is a test
 * failure rather than a runtime surprise.
 *
 * This module is types and constants only. It opens no connection, holds no
 * credential, and reads no environment variable.
 */

/** The router prefix. `APIRouter(prefix="/nf-node")`. */
export const NF_NODE_PREFIX = '/nf-node';

/** The sidecar's loopback default. The Forge port registry assigns it 8027. */
export const NF_NODE_DEFAULT_AUTHORITY = '127.0.0.1:8027';

/** `schema_version` on the delegation payload. */
export const DELEGATION_SCHEMA_VERSION = 'NeuronForgeExecutionDelegation.v1';

/**
 * The capability header the service's `LocalCallerBoundary` compares.
 *
 * Named here so the bridge can set it. The value never appears in this
 * repository: the supervisor supplies it to the service and to its trusted
 * proxy, and the boundary's own docstring says "never the webview".
 */
export const CAPABILITY_HEADER = 'X-AuthorForge-NeuronForge-Capability';

/** The environment variable the service reads the expected capability from. */
export const CAPABILITY_ENV_VAR = 'NEURONFORGE_LOCAL_CAPABILITY';

/**
 * `GET /nf-node/health`.
 *
 * The route's own docstring is load-bearing: "A 200 response body's own
 * `status` field is the truth -- the HTTP status code alone must never be read
 * as 'Ollama is up'". A degraded runtime answers 200 with
 * `status: 'degraded'`, so a caller that checks only the status code reports a
 * healthy lane over a dead runtime.
 */
export interface NfNodeHealth {
	status: 'ok' | 'degraded';
	runtime: string;
	/** Present when `status` is 'ok'. */
	model_count?: number;
	/** A `LocalRuntimeError` kind. Present when `status` is 'degraded'. */
	error?: string;
}

/** An entry of `installed_models`, from Ollama's `GET /api/tags`. */
export interface NfNodeInstalledModel {
	name: string;
	digest: string;
	size: number;
}

/**
 * An entry of `resident_models`, from Ollama's `GET /api/ps`.
 *
 * A resident model is already warm and answers without a cold load.
 */
export interface NfNodeResidentModel {
	name: string;
	size_vram: number;
	expires_at: string | null;
}

/**
 * `GET /nf-node/capabilities`.
 *
 * `health_status` is `'offline'` when the installed-model read failed. The
 * resident inventory is an enrichment: the service drops it on error rather
 * than failing the response, so `resident_models` can be empty while
 * `health_status` is `'ok'`.
 */
export interface NfNodeCapabilities {
	health_status: 'ok' | 'offline';
	available_models: string[];
	installed_models?: NfNodeInstalledModel[];
	resident_models?: NfNodeResidentModel[];
	error?: string;
}

/** `runtime` on the delegation payload. */
export interface DelegationRuntimeSpec {
	runtime_type: string;
	model_id: string;
	quality_tier: string;
	runtime_route_class: string;
}

/** `prompt` on the delegation payload. `max_tokens` is bounded 1..32000. */
export interface DelegationPromptSpec {
	system_prompt: string;
	user_prompt: string;
	max_tokens: number;
}

/**
 * `POST /nf-node/execute` request body.
 *
 * Defined so the contract is reviewable. This slice issues no execution: see
 * `bridge.ts`, which exposes no execute surface, and the test that asserts it
 * stays that way.
 */
export interface NeuronForgeExecutionDelegationV1 {
	schema_version: typeof DELEGATION_SCHEMA_VERSION;
	delegation_id: string;
	request_id: string;
	task_class: string;
	data_sensitivity: string;
	required_capabilities: Record<string, unknown>;
	preferred_node_mode: string;
	fallback_allowed: boolean;
	cloud_escalation_allowed: boolean;
	policy_ids: string[];
	created_at?: string | null;
	runtime: DelegationRuntimeSpec;
	prompt: DelegationPromptSpec;
}

/**
 * `POST /nf-node/execute` response.
 *
 * The service returns `execution_status: 'failed'` with a 200, so this is the
 * same discipline as `/health`: read the body, not the status code.
 *
 * `execution_provenance.model` is deliberately `null` on success. The service
 * refuses to echo the requested model as provider-observed provenance.
 */
export interface NfNodeExecutionResult {
	execution_status: 'succeeded' | 'failed';
	delegation_id: string;
	output?: string;
	model_id?: string;
	execution_provenance?: {
		mode: string;
		provider: string;
		model: string | null;
	};
	tokens_used?: number;
	latency_ms?: number;
	node_mode?: string;
	runtime_type?: string;
	error?: string;
	error_kind?: string;
}
