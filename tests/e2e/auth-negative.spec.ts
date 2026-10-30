/**
 * Negative-path login coverage, in a real browser, across all three projects.
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

test.describe('login failure paths', () => {
	test('a rejected credential shows the reason and establishes no session', async ({ page }) => {
		await page.route(LOGIN_ENDPOINT_GLOB, (route) =>
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
	});

	test('an unparseable success response establishes no session', async ({ page }) => {
		await page.route(LOGIN_ENDPOINT_GLOB, (route) =>
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
	});

	test('a success response carrying no token establishes no session', async ({ page }) => {
		await page.route(LOGIN_ENDPOINT_GLOB, (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ token_type: 'bearer', expires_in: 3600 })
			})
		);

		await submitLogin(page);

		// Asserts the safety property, not the current behavior: this response
		// is reported in docs/KNOWN_ISSUES.md as passing silently, and a fix
		// for that must not have to change this test.
		await expect(page).toHaveURL(/\/login/);
		expect(await storedToken(page)).toBeNull();
	});

	test('an unreachable endpoint shows an error and establishes no session', async ({ page }) => {
		await page.route(LOGIN_ENDPOINT_GLOB, (route) => route.abort('failed'));

		await submitLogin(page);

		await expect(page.locator('.error-message')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
		expect(await storedToken(page)).toBeNull();
	});
});
