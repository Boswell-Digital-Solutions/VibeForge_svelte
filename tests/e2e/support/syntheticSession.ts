/**
 * Synthetic test session for the hermetic E2E lane.
 *
 * WHAT THIS IS: a fabricated session that lets the browser suites start from a
 * signed-in page. The login request never leaves the browser — it is answered
 * by the `page.route` handler in `auth.setup.ts`.
 *
 * WHAT THIS IS NOT: evidence about authentication. Nothing here reaches
 * NeuroForge, so a green hermetic run says nothing about whether real login
 * works, whether a real token is well formed, or whether a real token is
 * accepted. The spec under `tests/e2e-real-auth/` is the only thing in this
 * repository that can make a claim about real authentication.
 *
 * This file is test-only. The application has no bypass: `src/lib/auth.ts`
 * always performs a real request, and that must stay true.
 */

/**
 * Credentials the hermetic setup types into the form. They are labelled rather
 * than realistic so that a credential appearing in a trace, video or report is
 * recognisable as fabricated.
 */
export const SYNTHETIC_CREDENTIALS = {
	username: 'e2e-synthetic-user',
	password: 'e2e-synthetic-password-not-a-secret'
} as const;

/**
 * The identity the synthetic token carries. `decodeToken` in `src/lib/auth.ts`
 * reads `sub`, `user_id` and `email`, so these are the fields that reach the
 * application. `.invalid` is reserved by RFC 2606 and never resolves.
 */
export const SYNTHETIC_USER = {
	user_id: 'e2e-synthetic-user-id',
	username: SYNTHETIC_CREDENTIALS.username,
	email: 'e2e-synthetic-user@example.invalid'
} as const;

/** The login endpoint `login()` in `src/lib/auth.ts` posts to. */
export const LOGIN_ENDPOINT_GLOB = '**/api/v1/auth/login/json';

/** localStorage keys `src/lib/auth.ts` writes. */
export const TOKEN_STORAGE_KEY = 'vibeforge_jwt_token';
export const USER_STORAGE_KEY = 'vibeforge_user';

function base64Url(value: object): string {
	return Buffer.from(JSON.stringify(value), 'utf-8').toString('base64url');
}

/**
 * Mints a synthetic JWT that expires `ttlSeconds` from now.
 *
 * The expiry is computed at run time on purpose. `initAuth()` calls
 * `isTokenExpired()` on every page load and logs out when the token has
 * expired, so a token committed as a fixture would quietly stop working on a
 * date nobody chose.
 *
 * The signature is a label, not a signature. `decodeToken` and
 * `isTokenExpired` read only the payload; neither verifies anything.
 */
export function createSyntheticToken(ttlSeconds = 60 * 60): string {
	const issuedAt = Math.floor(Date.now() / 1000);

	const header = base64Url({ alg: 'none', typ: 'JWT' });
	const payload = base64Url({
		sub: SYNTHETIC_USER.username,
		user_id: SYNTHETIC_USER.user_id,
		email: SYNTHETIC_USER.email,
		iat: issuedAt,
		exp: issuedAt + ttlSeconds,
		// Markers, so a token found in a report or a browser profile is
		// traceable to this file rather than mistaken for a real one.
		iss: 'vibeforge-e2e-hermetic-setup',
		synthetic: true
	});

	return `${header}.${payload}.synthetic-signature-not-verified`;
}

/**
 * The body NeuroForge's `/api/v1/auth/login/json` returns on success, as
 * `TokenResponse` in `src/lib/auth.ts` declares it.
 */
export function syntheticTokenResponse(ttlSeconds = 60 * 60) {
	return {
		access_token: createSyntheticToken(ttlSeconds),
		token_type: 'bearer',
		expires_in: ttlSeconds
	};
}
