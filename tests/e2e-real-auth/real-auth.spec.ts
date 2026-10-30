/**
 * Real authentication against a configured NeuroForge endpoint.
 *
 * This is the only spec in this repository that can support a claim about
 * authentication working. Nothing here is intercepted: the browser performs
 * the real request, and the test asserts the request actually went to the
 * configured host and that the token it got back is not a synthetic one.
 *
 * It skips when the endpoint is not configured, so ordinary pull-request CI
 * stays hermetic. The release gate sets E2E_REAL_AUTH_REQUIRED=true, which
 * turns every missing or inconsistent setting into a failure instead.
 *
 * The configured account must be an isolated test account. Production
 * credentials are never required, and must never be supplied: this reads only
 * its own dedicated E2E_REAL_AUTH_* settings, and the operations it performs
 * are a login and two reads of local storage.
 *
 * Authorized by the operator ruling on PR #13, conditions 4, 5 and 6.
 */

import { test, expect } from '@playwright/test';

const REQUIRED = process.env.E2E_REAL_AUTH_REQUIRED === 'true';

const endpoint = process.env.E2E_REAL_AUTH_URL ?? '';
const username = process.env.E2E_REAL_AUTH_USERNAME ?? '';
const password = process.env.E2E_REAL_AUTH_PASSWORD ?? '';
const accountClass = process.env.E2E_REAL_AUTH_ACCOUNT_CLASS ?? '';

/**
 * What the application under test is pointed at. `src/lib/auth.ts` reads
 * VITE_NEUROFORGE_URL, so the dev server must have been started with the same
 * value. Without this check the page could be talking to the default
 * default endpoint while this spec reported that it had tested a real one.
 */
const appEndpoint = process.env.VITE_NEUROFORGE_URL ?? '';

function configurationProblem(): string | null {
	if (!endpoint) return 'E2E_REAL_AUTH_URL is not set';
	if (!username) return 'E2E_REAL_AUTH_USERNAME is not set';
	if (!password) return 'E2E_REAL_AUTH_PASSWORD is not set';
	if (accountClass !== 'isolated-test') {
		return `E2E_REAL_AUTH_ACCOUNT_CLASS must be "isolated-test", not "${accountClass}". This spec refuses to run against an account that has not been declared an isolated test account.`;
	}
	if (appEndpoint !== endpoint) {
		return `the application is pointed at "${appEndpoint || '(unset, so the default)'}" but E2E_REAL_AUTH_URL is "${endpoint}". Start the dev server with VITE_NEUROFORGE_URL set to the same value, or this proves nothing about that endpoint.`;
	}
	return null;
}

function payloadOf(token: string): Record<string, unknown> {
	const segment = token.split('.')[1] ?? '';
	return JSON.parse(Buffer.from(segment, 'base64url').toString('utf-8'));
}

test.describe.serial('real NeuroForge authentication', () => {
	test.beforeEach(() => {
		const problem = configurationProblem();
		if (!problem) return;

		if (REQUIRED) {
			// The release gate requires this lane. A missing setting there is a
			// failure, never a quiet pass.
			throw new Error(`real-authentication gate is required but not runnable: ${problem}`);
		}
		test.skip(true, `real authentication not configured: ${problem}`);
	});

	test('a valid isolated test credential authenticates against the real endpoint', async ({
		page
	}) => {
		const loginUrls: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/v1/auth/login/json')) {
				loginUrls.push(request.url());
			}
		});

		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.fill('input[id="username"]', username);
		await page.fill('input[id="password"]', password);
		await page.click('button[type="submit"]');

		await page.waitForURL('/', { timeout: 30000 });

		// The request left the browser and went to the configured host. This is
		// what separates this spec from the hermetic lane.
		expect(loginUrls, 'no login request was observed').not.toHaveLength(0);
		expect(loginUrls[0]).toContain(new URL(endpoint).host);

		const token = await page.evaluate(() => localStorage.getItem('vibeforge_jwt_token'));
		expect(token, 'no token was stored').toBeTruthy();

		const payload = payloadOf(token as string);

		// Guards against this gate passing on a fabricated token.
		expect(payload.synthetic, 'the stored token is a synthetic one').toBeUndefined();
		expect(payload.iss).not.toBe('vibeforge-e2e-hermetic-setup');

		// Records which account authenticated, in the report.
		expect(payload.sub ?? payload.username).toBe(username);
		expect(typeof payload.exp).toBe('number');
		expect((payload.exp as number) * 1000).toBeGreaterThan(Date.now());
	});

	test('the real endpoint rejects a wrong password', async ({ page }) => {
		// Runs after the success case, and this describe block is serial, so a
		// provider that locks an account after repeated failures cannot take
		// the success case down with it.
		await page.goto('/login');
		await page.waitForLoadState('networkidle');
		await page.fill('input[id="username"]', username);
		await page.fill('input[id="password"]', `${password}-deliberately-wrong`);
		await page.click('button[type="submit"]');

		await expect(page.locator('.error-message')).toBeVisible({ timeout: 30000 });
		await expect(page).toHaveURL(/\/login/);

		const token = await page.evaluate(() => localStorage.getItem('vibeforge_jwt_token'));
		expect(token, 'a rejected login stored a token').toBeNull();
	});
});
