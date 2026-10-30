/**
 * Negative-path login coverage, in a real browser.
 *
 * Four of these carry the `@smoke` tag, so the pull-request lane runs them on
 * chromium. Firefox and webkit run them only in the full regression lane,
 * which is dispatch-only.
 *
 * The hermetic setup covers the success path only. These cases cover what the
 * login page does when the endpoint rejects the credentials, returns something
 * unparseable, returns a success shape with no token, or cannot be reached at
 * all. Each one asserts the same safety property: no session is established.
 *
 * These run unauthenticated. The browser projects carry the synthetic storage
 * state, so this file clears it.
 *
 * Authorized by the operator ruling on PR #13, condition 6.
 */

import { test, expect } from '@playwright/test';
import { LOGIN_ENDPOINT_GLOB, TOKEN_STORAGE_KEY } from './support/syntheticSession';

test.use({ storageState: { cookies: [], origins: [] } });

const CREDENTIALS = {
	username: 'e2e-negative-path-user',
	password: 'e2e-negative-path-password-not-a-secret'
};

async function submitLogin(page: import('@playwright/test').Page) {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.fill('input[id="username"]', CREDENTIALS.username);
	await page.fill('input[id="password"]', CREDENTIALS.password);
	await page.click('button[type="submit"]');
}

async function storedToken(page: import('@playwright/test').Page) {
	return page.evaluate((key) => localStorage.getItem(key), TOKEN_STORAGE_KEY);
}

/**
 * Registers a login handler and reports whether it ran.
 *
 * `auth.setup.ts` asserts the same thing. Without it, a glob that stopped
 * matching would leave these tests observing whatever answers on the real
 * port: a refused connection is indistinguishable from the aborted and
 * malformed responses they fabricate, and a real 401 is indistinguishable
 * from the rejection they fabricate.
 */
async function interceptLogin(
	page: import('@playwright/test').Page,
	handler: (route: import('@playwright/test').Route) => Promise<void> | void
) {
	const state = { hit: false };
	await page.route(LOGIN_ENDPOINT_GLOB, async (route) => {
		state.hit = true;
		await handler(route);
	});
	return state;
}

function expectIntercepted(state: { hit: boolean }) {
	expect(
		state.hit,
		`the login request was not intercepted; ${LOGIN_ENDPOINT_GLOB} no longer matches the endpoint in src/lib/auth.ts`
	).toBe(true);
}

test.describe('login failure paths', () => {
	test('a rejected credential shows the reason and establishes no session', { tag: '@smoke' }, async ({ page }) => {
		const intercepted = await interceptLogin(page, (route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ detail: 'Invalid credentials' })
			})
		);

		await submitLogin(page);

		await expect(page.locator('.error-message')).toContainText('Invalid credentials');
		await expect(page).toHaveURL(/\/login/);
		expect(await storedToken(page)).toBeNull();
		expectIntercepted(intercepted);
	});

	test('an unparseable success response establishes no session', { tag: '@smoke' }, async ({ page }) => {
		const intercepted = await interceptLogin(page, (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: 'this is not json'
			})
		);

		await submitLogin(page);

		// The message is the engine's own parser error, so its wording differs
		// per browser. That it surfaces at all is the assertion.
		await expect(page.locator('.error-message')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
		expect(await storedToken(page)).toBeNull();
		expectIntercepted(intercepted);
	});

	test('a success response carrying no token establishes no session', { tag: '@smoke' }, async ({ page }) => {
		const intercepted = await interceptLogin(page, (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ token_type: 'bearer', expires_in: 3600 })
			})
		);

		// This is the one case with no error message to wait on, so there is
		// nothing that synchronises on the attempt finishing. Without the two
		// waits below the assertions run microseconds after the click, where
		// "refused" and "not finished yet" are indistinguishable, and a
		// regression that established a session would pass them.
		const loginSettled = page.waitForResponse((response) =>
			response.url().includes('/api/v1/auth/login/json')
		);
		await submitLogin(page);
		await loginSettled;

		// handleLogin clears `loading` in its finally, which re-enables the
		// button. If a session were established the page would navigate and
		// this button would be gone, so this fails rather than passing.
		await expect(page.locator('button[type="submit"]')).toBeEnabled();

		// Asserts the safety property, not the current behavior: this response
		// is reported in docs/KNOWN_ISSUES.md as passing silently, and a fix
		// for that must not have to change this test.
		await expect(page).toHaveURL(/\/login/);
		expect(await storedToken(page)).toBeNull();
		expectIntercepted(intercepted);
	});

	test('an unreachable endpoint shows an error and establishes no session', { tag: '@smoke' }, async ({ page }) => {
		const intercepted = await interceptLogin(page, (route) => route.abort('failed'));

		await submitLogin(page);

		await expect(page.locator('.error-message')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
		expect(await storedToken(page)).toBeNull();
		expectIntercepted(intercepted);
	});
});
