#!/usr/bin/env node
/**
 * Verifies the production artifact in `build/` the way Tauri will load it.
 *
 * This is not a second copy of the E2E suite. Those tests run against
 * `pnpm dev` (see playwright.config.ts), which serves modules through Vite and
 * renders on demand. This checks the thing that actually ships: prerendered
 * HTML files on disk, served over a resolver that behaves like Tauri's.
 *
 * WHY IT DRIVES INTERACTIONS RATHER THAN COUNTING ELEMENTS
 *
 * An earlier investigation compared counts of links and buttons between the
 * built artifact and the dev server. Equal counts show the markup matches;
 * they do not show the page works. Prerendered HTML contains the full markup
 * whether or not the client ever hydrates, so a page with dead event handlers
 * counts identically to a working one. Every check below therefore requires
 * the client to have taken over: a route change without a document reload,
 * a keyboard shortcut opening a modal, typing changing state.
 *
 * The resolver mirrors tauri-2.9.3/src/manager/mod.rs `AppManager::get_asset`:
 * exact path, then `<path>.html`, then `<path>/index.html`, then
 * `index.html`. Getting that order wrong here would let a broken artifact
 * pass, so it is written to match the source rather than to be convenient.
 *
 * Usage: node scripts/verify-production-artifact.mjs [buildDir]
 * Exits non-zero on any failure, so CI fails rather than warns.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
// From @playwright/test, which is the Playwright package this repo depends on;
// the bare `playwright` package is not installed.
import { chromium } from '@playwright/test';

const BUILD_DIR = resolve(process.argv[2] ?? 'build');

/**
 * Errors that mean a backend is absent, not that the artifact is broken.
 *
 * No VibeForge service runs in CI, so the licence check and the sync socket
 * always fail. They fail identically under `pnpm dev`, so counting them would
 * make this script fail always and prove nothing. Everything not matched here
 * is treated as a real defect.
 */
const BACKEND_ABSENCE = [
	'ERR_CONNECTION_REFUSED',
	'ERR_CONNECTION_RESET',
	'ERR_NAME_NOT_RESOLVED',
	'Failed to fetch',
	'Failed to load resource',
	'License validation error',
	'WebSocket connection to',
	'[WebSocket]',
	'NetworkError',
	'Load failed'
];

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain'
};

/**
 * Resolves a request path to a file, in Tauri's order.
 *
 * All four steps, including the final fall back to `index.html`. That last one
 * matters: it means a route missing from the artifact still answers 200 at its
 * own URL, so the checks below cannot rely on a 404 to notice. Leaving it out
 * would make this resolver stricter than Tauri and hide that, which is the
 * opposite of what a pre-ship check is for.
 */
function resolveAsset(urlPath) {
	const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]).replace(/\/$/, '');
	const bare = clean.replace(/^\//, '');
	const candidates =
		bare === ''
			? ['index.html']
			: [bare, `${bare}.html`, `${bare}/index.html`, 'index.html'];

	for (const candidate of candidates) {
		const file = join(BUILD_DIR, candidate);
		// Keep the lookup inside the build directory. A traversal would make
		// this script a worse oracle than no script.
		if (!file.startsWith(BUILD_DIR + sep) && file !== BUILD_DIR) continue;
		if (existsSync(file) && statSync(file).isFile()) return file;
	}
	return null;
}

function startServer() {
	const server = createServer((req, res) => {
		const file = resolveAsset(req.url);
		if (!file) {
			res.writeHead(404, { 'content-type': 'text/plain' });
			return res.end('not found');
		}
		res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
		createReadStream(file).pipe(res);
	});
	return new Promise((done) => {
		server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
	});
}

const results = [];
function record(name, ok, detail = '') {
	results.push({ name, ok, detail });
	console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Waits for SvelteKit's client router to start.
 *
 * The signal is the history entry SvelteKit stamps on startup:
 * `history.replaceState` with a `sveltekit:history` key, in
 * @sveltejs/kit/src/runtime/client/client.js. It is set only by the running
 * client, so it cannot be present in prerendered markup, which makes it a
 * real hydration check rather than a check on what the HTML contains.
 *
 * An earlier version of this script looked for a `data-sveltekit-hydrated`
 * attribute on `<body>`. No such attribute exists; SvelteKit never sets one.
 * It therefore reported every route as un-hydrated while the interaction
 * checks below passed, which is how the mistake surfaced.
 */
async function waitForClientStart(page, timeout = 15000) {
	try {
		await page.waitForFunction(() => !!window.history.state?.['sveltekit:history'], { timeout });
		return true;
	} catch {
		return false;
	}
}

/** Collects console and page errors, separating backend absence from defects. */
function watchErrors(page) {
	const real = [];
	const absence = [];
	const sort = (text) => {
		(BACKEND_ABSENCE.some((pattern) => text.includes(pattern)) ? absence : real).push(text);
	};
	page.on('console', (message) => {
		if (message.type() === 'error') sort(message.text());
	});
	page.on('pageerror', (error) => sort(`uncaught: ${String(error)}`));
	return { real, absence };
}

async function main() {
	// Checked before launching a browser so a missing artifact fails fast and
	// unambiguously, rather than as a confusing navigation error.
	console.log(`\nArtifact: ${BUILD_DIR}\n`);
	console.log('Artifact shape');
	const entry = join(BUILD_DIR, 'index.html');
	record('build/ exists', existsSync(BUILD_DIR) && statSync(BUILD_DIR).isDirectory());
	record('build/index.html exists', existsSync(entry));
	if (!existsSync(entry)) {
		console.log('\nFAILED: no entrypoint to serve.\n');
		process.exit(1);
	}
	record(
		'build/_app/ exists (client bundle)',
		existsSync(join(BUILD_DIR, '_app')),
		'without it nothing can hydrate'
	);

	const { server, port } = await startServer();
	const base = `http://127.0.0.1:${port}`;
	const browser = await chromium.launch();

	try {
		// Representative routes: the entry, a dense dashboard, the settings
		// page with the most controls, and the login page, which is the one
		// route a user reaches before anything else works.
		console.log('\nRoutes serve and hydrate');
		for (const route of ['/', '/dashboard', '/settings', '/login', '/history']) {
			const page = await browser.newPage();
			const errors = watchErrors(page);
			const response = await page.goto(base + route, { waitUntil: 'load' });

			const hydrated = await waitForClientStart(page);

			const status = response?.status() ?? 0;
			record(`${route} serves 200`, status === 200, `status ${status}`);
			record(
				`${route} hydrates`,
				hydrated,
				hydrated ? '' : 'the client router never stamped history state'
			);
			record(
				`${route} has no non-backend errors`,
				errors.real.length === 0,
				errors.real.length
					? errors.real.slice(0, 2).join(' | ').slice(0, 220)
					: `${errors.absence.length} backend-absence error(s), expected`
			);
			await page.close();
		}

		// The interaction checks. Each needs the client to be live: markup
		// alone cannot satisfy any of them.
		console.log('\nInteractions require a live client');
		const page = await browser.newPage();
		const errors = watchErrors(page);
		await page.goto(base + '/', { waitUntil: 'load' });
		await waitForClientStart(page);

		// 1. Client-side routing. A full document reload would also change the
		//    URL, so the document is stamped first and the stamp checked after:
		//    it survives a client-side navigation and is lost on a reload.
		//    The link must point somewhere other than here, or the URL would
		//    not change and the check would pass without proving anything.
		await page.evaluate(() => {
			window.__artifactProbe = 'survived';
		});
		const navLink = page
			.locator('a[href^="/"]:visible')
			.filter({ hasNot: page.locator('[aria-hidden="true"]') })
			.and(page.locator('a:not([href="/"]):not([href="/#"])'))
			.first();
		if ((await navLink.count()) === 0) {
			record('client-side navigation', false, 'no in-app link to a different route');
		} else {
			const href = await navLink.getAttribute('href');
			await navLink.click();
			await page.waitForURL((url) => url.pathname !== '/', { timeout: 15000 }).catch(() => {});
			const stamp = await page.evaluate(() => window.__artifactProbe);
			const landed = new URL(page.url()).pathname;
			record(
				'navigating to a link does not reload the document',
				stamp === 'survived' && landed !== '/',
				`clicked ${href}, landed ${landed}, window stamp ${stamp ?? 'lost'}`
			);
		}

		// 2. Event handlers are attached. A keyboard shortcut is handled only
		//    by live JavaScript; prerendered markup cannot answer it.
		//    Meta+N and the heading it reveals are the app's own, matching
		//    src/routes/+layout.svelte's shortcut map and the assertion in
		//    tests/e2e/wizard-modal.spec.ts, so this does not invent a
		//    contract of its own.
		await page.goto(base + '/', { waitUntil: 'load' });
		await waitForClientStart(page);
		const wizardHeading = page.getByRole('heading', { name: 'Project Intent' });
		record('the wizard is closed before the shortcut', !(await wizardHeading.isVisible()));
		await page.keyboard.press('Meta+N');
		let opened = false;
		try {
			await wizardHeading.waitFor({ state: 'visible', timeout: 8000 });
			opened = true;
		} catch {
			/* reported below */
		}
		record(
			'Meta+N opens the project wizard',
			opened,
			opened ? '' : '"Project Intent" heading never appeared'
		);

		// 3. Reactivity. The check has to turn on state the framework derives,
		//    not on the value of the field itself.
		//
		//    An earlier version typed into an input and asserted the input
		//    held what was typed. That passed against an artifact with its
		//    client bundle deleted, because `fill` sets the DOM value
		//    directly: it measured Playwright, not the application.
		//
		//    Quick Create's Create button is disabled unless both the name and
		//    the output path are non-empty, so flipping it from disabled to
		//    enabled requires a derived value to recompute and write to the
		//    DOM. The ids and the two-field rule are the app's own, from
		//    tests/e2e/quick-create.spec.ts.
		await page.goto(base + '/', { waitUntil: 'load' });
		await waitForClientStart(page);
		await page.keyboard.press('Meta+Shift+N');

		const name = page.locator('#qc-name');
		const path = page.locator('#qc-path');
		const createButton = page.locator('button:has-text("Create")').first();
		let quickCreateOpen = false;
		try {
			await name.waitFor({ state: 'visible', timeout: 8000 });
			quickCreateOpen = true;
		} catch {
			/* reported below */
		}
		record(
			'Meta+Shift+N opens Quick Create',
			quickCreateOpen,
			quickCreateOpen ? '' : '#qc-name never became visible'
		);

		if (quickCreateOpen) {
			// The path is filled first so the name is the only thing left
			// deciding the button, making the transition attributable to it.
			await path.fill('/tmp/artifact-probe');
			await name.fill('');
			let disabledWhenNameEmpty = false;
			try {
				await createButton.waitFor({ state: 'visible', timeout: 5000 });
				disabledWhenNameEmpty = await createButton.isDisabled();
			} catch {
				/* reported below */
			}
			record(
				'Create is disabled with no project name',
				disabledWhenNameEmpty,
				disabledWhenNameEmpty ? '' : 'button was not disabled, so the next check proves nothing'
			);

			await name.fill('ArtifactProbe');
			let enabledAfterTyping = false;
			try {
				await page.waitForFunction(
					() => {
						const button = [...document.querySelectorAll('button')].find((candidate) =>
							candidate.textContent?.includes('Create')
						);
						return !!button && !button.disabled;
					},
					undefined,
					{ timeout: 5000 }
				);
				enabledAfterTyping = true;
			} catch {
				/* reported below */
			}
			record(
				'typing a name recomputes derived state and enables Create',
				enabledAfterTyping,
				enabledAfterTyping ? '' : 'Create stayed disabled, so nothing recomputed'
			);
		}
		record(
			'interaction pass produced no non-backend errors',
			errors.real.length === 0,
			errors.real.length ? errors.real.slice(0, 2).join(' | ').slice(0, 220) : ''
		);
		await page.close();

		// 4. A reload at a nested route must serve that route's own prerendered
		//    file, not the index.
		//
		//    Tauri's resolver falls back to `index.html` when nothing else
		//    matches, so a route missing from the artifact still answers 200 at
		//    its own URL. An earlier version of this check asserted only the
		//    status and the path, and so would have passed with the route's
		//    file deleted. Comparing the bytes against the index is what makes
		//    the absence visible.
		console.log('\nTauri asset resolution');
		const [settingsBody, indexBody] = await Promise.all([
			fetch(base + '/settings').then((response) => response.text()),
			fetch(base + '/index.html').then((response) => response.text())
		]);
		record(
			'/settings serves its own prerendered file, not the index fallback',
			settingsBody.length > 0 && settingsBody !== indexBody,
			settingsBody === indexBody
				? 'byte-identical to index.html, so settings.html is missing from the artifact'
				: `${settingsBody.length} bytes, distinct from index.html`
		);

		const deep = await browser.newPage();
		const deepResponse = await deep.goto(base + '/settings', { waitUntil: 'load' });
		const deepHydrated = await waitForClientStart(deep);
		record(
			'a reload at a nested route serves and hydrates',
			deepResponse?.status() === 200 &&
				new URL(deep.url()).pathname === '/settings' &&
				deepHydrated,
			`status ${deepResponse?.status()}, hydrated ${deepHydrated}`
		);
		await deep.close();
	} finally {
		await browser.close();
		server.close();
	}

	const failed = results.filter((result) => !result.ok);
	console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
	if (failed.length) {
		console.log('\nFailed:');
		for (const result of failed) console.log(`  - ${result.name}${result.detail ? `: ${result.detail}` : ''}`);
		console.log('');
		process.exit(1);
	}
	console.log('Production artifact verified.\n');
}

main().catch((error) => {
	console.error('\nverify-production-artifact crashed:', error);
	process.exit(1);
});
