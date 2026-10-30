/**
 * Canonical service endpoints.
 *
 * One variable configures one service. Before this module there were three
 * variable names for NeuroForge and three for DataForge, and the same name
 * carried different defaults in different files, so no single setting could
 * point the application at one service.
 *
 * Defaults follow the port map in the Forge port registry, which NeuroForge's
 * own `.env.example` also states:
 *
 * | Port | Service |
 * |---|---|
 * | 8000 | NeuroForge |
 * | 8001 | DataForge |
 * | 8002 | Rake |
 *
 * Two of the three values are origins with no path: `NEUROFORGE_URL` and
 * `DATAFORGE_URL`. A caller that needs a versioned path uses
 * `NEUROFORGE_API_V1` or `DATAFORGE_API_V1`, and a caller that needs a socket
 * uses the derived websocket URLs, so host and port cannot drift between the
 * two protocols.
 *
 * `LICENSE_API_URL` is not an origin. It is a base-path URL: it carries the
 * `/license` path segment, and callers append to it. It is shaped differently
 * because no service owns the route, so there is no origin to name. See its
 * own note below.
 */

/**
 * Reads a configured URL, falling back to the default. Accepts either an
 * origin or a base-path URL; a trailing slash would double up against every
 * path this is joined to, so it is stripped.
 */
function readBaseUrl(configured: string | undefined, fallback: string): string {
	const value = (configured ?? '').trim() || fallback;
	return value.replace(/\/+$/, '');
}

function toWebSocketUrl(httpUrl: string): string {
	return httpUrl.replace(/^http/, 'ws');
}

/** NeuroForge: model routing, inference, authentication, insights. An origin. */
export const NEUROFORGE_URL = readBaseUrl(
	import.meta.env.VITE_NEUROFORGE_URL,
	'http://localhost:8000'
);

/** DataForge: durable records this application reads. An origin. */
export const DATAFORGE_URL = readBaseUrl(
	import.meta.env.VITE_DATAFORGE_URL,
	'http://localhost:8001'
);

/**
 * License validation.
 *
 * A base-path URL rather than an origin: the value includes the `/license`
 * path segment, and callers append to it, as `core/stores/license.svelte.ts`
 * does with `/validate`.
 *
 * The default targets port 8002, which the port registry assigns to Rake, and
 * no service in the ecosystem implements this route. The value is preserved
 * rather than corrected, because which service owns license validation is an
 * open question. See docs/KNOWN_ISSUES.md.
 */
export const LICENSE_API_URL = readBaseUrl(
	import.meta.env.VITE_LICENSE_API_URL,
	'http://localhost:8002/license'
);

export const NEUROFORGE_API_V1 = `${NEUROFORGE_URL}/api/v1`;
export const DATAFORGE_API_V1 = `${DATAFORGE_URL}/api/v1`;

/** NeuroForge streams inference over its own socket. */
export const NEUROFORGE_WS_URL = toWebSocketUrl(NEUROFORGE_URL);

/**
 * DataForge sync socket.
 *
 * No DataForge route answers this path today, so a connection attempt is
 * refused. See docs/KNOWN_ISSUES.md.
 */
export const DATAFORGE_WS_URL = `${toWebSocketUrl(DATAFORGE_URL)}/ws`;
