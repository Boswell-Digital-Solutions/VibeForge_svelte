/**
 * Hermetic session setup for the browser E2E projects.
 *
 * This answers the login request in the browser with a synthetic session and
 * saves the resulting storage state for the chromium, firefox and webkit
 * projects. It exists so the downstream suites can start from a signed-in
 * page without a NeuroForge instance in CI.
 *
 * It does not authenticate. No request leaves the browser, so this proves
 * nothing about NeuroForge login, about real token contents, or about whether
 * a real token would be accepted. Do not cite a green run of this file as
 * authentication coverage. `tests/e2e-real-auth/real-auth.spec.ts` is the only
 * spec here that exercises real authentication, and the release gate is where
 * it is required to pass.
 *
 * Authorized by the operator ruling on PR #13, condition 1 and condition 2.
 */

import { test as setup, expect } from '@playwright/test';
import {
	LOGIN_ENDPOINT_GLOB,
	SYNTHETIC_CREDENTIALS,
	SYNTHETIC_USER,
	TOKEN_STORAGE_KEY,
	USER_STORAGE_KEY,
	syntheticTokenResponse
} from './support/syntheticSession';

const authFile = 'playwright/.auth/user.json';

setup('establish a synthetic session (does not verify NeuroForge authentication)', async ({
	page
}) => {
	let loginIntercepted = false;

	await page.route(LOGIN_ENDPOINT_GLOB, async (route) => {
		loginIntercepted = true;
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(syntheticTokenResponse())
		});
	});

	await page.goto('/login');
	await page.waitForLoadState('networkidle');

	await page.fill('input[id="username"]', SYNTHETIC_CREDENTIALS.username);
	await page.fill('input[id="password"]', SYNTHETIC_CREDENTIALS.password);
	await page.click('button[type="submit"]');

	await page.waitForURL('/', { timeout: 10000 });

	// The interception is the whole point of this lane. Without this check a
	// glob that stopped matching would let the setup pass against whatever
	// happened to answer on port 8002, and the run would look hermetic.
	expect(
		loginIntercepted,
		`the login request was not intercepted; ${LOGIN_ENDPOINT_GLOB} no longer matches the endpoint in src/lib/auth.ts`
	).toBe(true);

	const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_STORAGE_KEY);
	const storedUser = await page.evaluate((key) => localStorage.getItem(key), USER_STORAGE_KEY);

	expect(token, 'no token was stored').toBeTruthy();
	expect(storedUser, 'no user was stored').toBeTruthy();

	// Confirms the stored identity came from the synthetic response above and
	// not from some other session already present in the profile.
	expect(JSON.parse(storedUser as string)).toMatchObject({
		user_id: SYNTHETIC_USER.user_id,
		username: SYNTHETIC_USER.username
	});

	await page.context().storageState({ path: authFile });
});
