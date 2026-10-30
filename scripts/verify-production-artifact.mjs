#!/usr/bin/env node
/**
 * Verifies the production artifact in `build/` the way Tauri will load it.
 *
 * This is not a second copy of the E2E suite. Those tests run against
 * `pnpm dev` (see playwright.config.ts), which serves modules through Vite and
 * renders on demand. This checks the thing that actually ships: prerendered
 * HTML files on disk, served over a resolver that behaves like Tauri's.
 *
 * WHAT THIS FILE LEARNED THE HARD WAY
 *
 * Three earlier versions of these checks passed against artifacts that were
 * plainly broken. Each mistake is recorded here because the same shape keeps
 * recurring, and the comments below are the only thing stopping it:
 *
 * 1. A `data-sveltekit-hydrated` attribute on `<body>`. SvelteKit sets no such
 *    attribute, so the check was testing nothing.
 * 2. `page.fill(input, 'x')` then asserting the input contained `x`. `fill`
 *    writes the DOM value directly, so it passed with the client bundle
 *    deleted. It measured Playwright, not the application.
 * 3. `history.state['sveltekit:history']` as a hydration signal. The client
 *    writes that key at client.js:341 and calls `await _hydrate` at :361, so
 *    it is stamped twenty lines BEFORE hydration, and `_hydrate` swallows a
 *    failed branch load and renders the error page. An artifact with six
 *    routes showing `500 Internal Error` and every stylesheet deleted scored
 *    27/27.
 *
 * The rule those three share: a check must observe the application's own
 * rendered output, and must not be satisfiable by the framework merely
 * starting. Every check below compares what the browser actually renders
 * against what the prerendered file says it should render.
 *
 * The resolver mirrors tauri-2.9.3/src/manager/mod.rs `AppManager::get_asset`:
 * exact path, then `<path>.html`, then `<path>/index.html`, then
 * `index.html` — all four, including the last. That final fallback is why a
 * status code proves nothing here: every path returns 200 once an entrypoint
 * exists.
 *
 * Usage: node scripts/verify-production-artifact.mjs [buildDir]
 * Exits non-zero on any failure, so CI fails rather than warns.
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, resolve, sep, relative } from 'node:path';
// From @playwright/test, which is the Playwright package this repo depends on;
// the bare `playwright` package is not installed.
import { chromium } from '@playwright/test';

const BUILD_DIR = resolve(process.argv[2] ?? 'build');
/** The source of truth for which routes must exist. */
const ROUTES_DIR = resolve('src/routes');

/** How long to let a route settle before judging it. */
const SETTLE_MS = 2000;

/**
 * The services this application talks to, none of which run in CI.
 *
 * Suppression is decided by the origin a request was made to, not by the
 * wording of a message. An earlier version matched substrings like
 * `'Failed to fetch'` and `'Failed to load resource'`, which silently
 * swallowed `TypeError: Failed to fetch dynamically imported module` — the
 * canonical symptom of a broken route chunk — and made a dead route pass
 * while the script clicked into it.
 */
const EXTERNAL_PORTS = ['8000', '8001', '8002', '8010', '8027'];

/**
 * Messages the application itself logs when a service is absent.
 *
 * Deliberately narrow, and each is paired with the guard below: nothing is
 * suppressed if it also names our own bundle or a failed module import.
 */
const APP_SERVICE_LOGS = [
	'License validation error',
	'[WebSocket]',
	'WebSocket connection to',
	'ERR_CONNECTION_REFUSED',
	'ERR_CONNECTION_RESET',
	'ERR_NAME_NOT_RESOLVED',
	// The Tauri host is not present in a browser, so a page that probes it
	// reports this. Absence of the host, not a defect in the artifact.
	'Tauri not available'
];

/**
 * Never suppressed, whatever else the message says.
 *
 * Each names a way the artifact itself is broken rather than a service being
 * absent. Kept to exactly that: an earlier draft listed `_app/`, which appears
 * in the stack trace of every error the application logs, so a genuine
 * backend-absence message was reported as a defect and the gate failed a
 * healthy build. A gate that cries wolf gets switched off.
 */
const ALWAYS_A_DEFECT = [
	'dynamically imported module',
	'Failed to load module script',
	'Internal Error',
	'Refused to apply style',
	'Refused to execute script'
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
 * own URL. Leaving it out would make this resolver stricter than Tauri and
 * hide that, which is the opposite of what a pre-ship check is for.
 */
function resolveAsset(urlPath) {
	const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]).replace(/\/$/, '');
	const bare = clean.replace(/^\//, '');
	const candidates =
		bare === '' ? ['index.html'] : [bare, `${bare}.html`, `${bare}/index.html`, 'index.html'];

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
		const stream = createReadStream(file);
		stream.on('error', () => {
			res.destroy();
		});
		stream.pipe(res);
	});
	return new Promise((done) => {
		server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
	});
}

/**
 * Every route the application declares, read from `src/routes/`.
 *
 * Deliberately NOT derived from the artifact. An earlier version listed the
 * `.html` files it found, which meant a route deleted from the artifact simply
 * vanished from the checks: with `history.html` removed the gate reported
 * 88/88 and exit 0, because `/history` was never looked for. The source tree
 * is the statement of what must exist; the artifact is the thing under test.
 */
function declaredRoutes(dir = ROUTES_DIR, prefix = '') {
	const routes = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			if (entry.name === '+page.svelte') routes.push(prefix === '' ? '/' : prefix);
			continue;
		}
		// A group has no URL segment of its own.
		const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
		routes.push(...declaredRoutes(join(dir, entry.name), prefix + segment));
	}
	return [...new Set(routes)].sort();
}

/**
 * The text the prerendered file says this route renders.
 *
 * Taken from `<main>` where there is one, and from `<body>` otherwise, since
 * /login renders the bare layout with no `<main>` and a route whose `<main>`
 * is empty needs the shell to compare against. Stripped of tags and
 * whitespace. This is the yardstick the live DOM is measured against: if the
 * client fails to hydrate a route, SvelteKit renders its error page instead
 * and the two diverge.
 */
function prerenderedMain(route) {
	const file = resolveAsset(route);
	if (!file) return null;
	const html = readFileSync(file, 'utf8');
	const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
	const useMain = main && stripTags(main[1]).length > 0;
	const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
	const source = useMain ? main[1] : body?.[1];
	if (source === undefined) return null;
	return stripTags(source);
}

/** Tags out, entities decoded, whitespace collapsed. */
function stripTags(fragment) {
	return fragment
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		// Decoded, not blanked. Blanking turned the prerendered
		// "Patterns &amp; Recipes" into "Patterns Recipes" and reported a
		// mismatch against the browser's "Patterns & Recipes" — a defect in
		// this comparison, not in the page.
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Pre-existing defects this gate knows about and does not fail on.
 *
 * Deliberately one entry, keyed to a route and a message, not a blanket skip
 * of a directory. Everything else on these routes is still checked.
 *
 * Each entry is self-retiring: if the defect stops appearing, the gate FAILS
 * and tells you to delete the entry. An exception that outlives its fix is how
 * a gate rots, so this one cannot.
 */
const KNOWN_DEFECTS = [
	{
		route: '/_archive/analytics',
		match: "Cannot read properties of undefined (reading 'toFixed')",
		why: 'pre-existing, reproduces identically under pnpm dev; see docs/KNOWN_ISSUES.md'
	}
];

const results = [];
function record(name, ok, detail = '') {
	results.push({ name, ok, detail });
	console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Collects errors, separating absent backends from defects by origin.
 *
 * A failed request is backend absence only when it went somewhere other than
 * this server. Anything naming our own bundle, a failed module import, or an
 * error page is a defect no matter how it is worded.
 */
function watchErrors(page, base) {
	const real = [];
	const absence = [];
	const pending = [];
	/** Set when a request to somewhere other than this server actually failed. */
	let externalRequestFailed = false;

	const classify = (text, url) => {
		// Broken-artifact symptoms, never explained away by an absent service.
		if (ALWAYS_A_DEFECT.some((pattern) => text.includes(pattern))) return real.push(text);
		// A request that left for another origin and failed.
		if (url && !url.startsWith(base)) return absence.push(text);
		if (EXTERNAL_PORTS.some((port) => text.includes(`:${port}`))) return absence.push(text);
		if (APP_SERVICE_LOGS.some((pattern) => text.includes(pattern))) return absence.push(text);
		// A fetch failure logged by application code. Its stack points into our
		// own bundle, so the origin says nothing; what settles it is whether a
		// request to an external service actually failed on this page. Held
		// until the page has settled, because the console line can arrive
		// before the request does.
		if (/Failed to fetch|NETWORK_ERROR|ERR_CONNECTION/.test(text)) return pending.push(text);
		return real.push(text);
	};

	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		classify(message.text().slice(0, 300), message.location()?.url);
	});
	page.on('pageerror', (error) => classify(`uncaught: ${String(error).slice(0, 300)}`, undefined));
	page.on('requestfailed', (request) => {
		const url = request.url();
		if (!url.startsWith(base)) externalRequestFailed = true;
		classify(`request failed: ${url} (${request.failure()?.errorText ?? 'unknown'})`, url);
	});

	return {
		real,
		absence,
		/** Resolves the held fetch failures once the page has settled. */
		settle() {
			for (const text of pending) {
				(externalRequestFailed ? absence : real).push(text);
			}
			pending.length = 0;
			return { real, absence };
		}
	};
}

async function main() {
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

	const routes = declaredRoutes();
	record('src/routes declares routes to check', routes.length > 0, `${routes.length} declared`);
	// A declared route with no file of its own would be served the index by
	// Tauri's fallback, so this is checked here and not inferred from a status.
	const absent = routes.filter((route) => {
		const file = join(BUILD_DIR, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
		return !existsSync(file) || statSync(file).size === 0;
	});
	record(
		'every declared route has its own file in the artifact',
		absent.length === 0,
		absent.length ? `missing: ${absent.join(', ')}` : `${routes.length} present`
	);

	// Every stylesheet the entry page references must be a real CSS file.
	// Tauri's index fallback serves HTML for a missing one, and Chrome drops it
	// silently with no console message, so an unstyled application is
	// otherwise invisible. An artifact with every .css deleted scored 27/27.
	const entryHtml = readFileSync(entry, 'utf8');
	const sheetHrefs = [...entryHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
		.map((tag) => tag[0].match(/href=["']([^"']+)["']/i)?.[1])
		.filter(Boolean);
	const missingSheets = sheetHrefs.filter((href) => {
		const file = resolveAsset('/' + href.replace(/^\.?\//, ''));
		return !file || extname(file) !== '.css';
	});
	record(
		'every stylesheet the entry references is a real .css file',
		sheetHrefs.length > 0 && missingSheets.length === 0,
		sheetHrefs.length === 0
			? 'the entry references no stylesheet at all'
			: missingSheets.length
				? `${missingSheets.length} of ${sheetHrefs.length} resolve to non-CSS: ${missingSheets.slice(0, 2).join(', ')}`
				: `${sheetHrefs.length} checked`
	);

	// No two routes may serve byte-identical HTML. Comparing a route against
	// its own prerendered file cannot catch a file holding the wrong page,
	// because then both sides are wrong together: with settings.html replaced
	// by dashboard.html the gate scored 93/93. Distinct pages render distinct
	// bytes, so a collision means one file is a copy of another's.
	const byDigest = new Map();
	for (const route of routes) {
		const file = join(BUILD_DIR, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
		if (!existsSync(file)) continue;
		const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
		if (!byDigest.has(digest)) byDigest.set(digest, []);
		byDigest.get(digest).push(route);
	}
	const collisions = [...byDigest.values()].filter((group) => group.length > 1);
	record(
		'no two routes serve the same prerendered bytes',
		collisions.length === 0,
		collisions.length
			? `identical: ${collisions.map((group) => group.join(' == ')).join('; ')}`
			: `${byDigest.size} distinct of ${routes.length}`
	);

	const { server, port } = await startServer();
	const base = `http://127.0.0.1:${port}`;
	const browser = await chromium.launch();

	try {
		// Every route, derived from the artifact, not a hand-kept list of five.
		// An artifact with four route chunks deleted scored 27/27 because none
		// of them was on that list.
		console.log(`\nEvery route renders what it was prerendered to render (${routes.length})`);
		for (const route of routes) {
			const page = await browser.newPage();
			const errors = watchErrors(page, base);
			await page.goto(base + route, { waitUntil: 'load' }).catch(() => {});
			// Settle before judging. Sampling at `load` missed any failure that
			// surfaced more than ~100ms later, which is most of them: a boot
			// error injected at 300ms passed.
			await page.waitForTimeout(SETTLE_MS);

			const live = await page
				.evaluate(() => {
					const main = document.querySelector('main');
					const fromMain = main ? main.innerText.replace(/\s+/g, ' ').trim() : '';
					// Matches prerenderedMain's choice: <main> when it has
					// content, the whole body otherwise.
					return fromMain.length > 0
						? fromMain
						: document.body.innerText.replace(/\s+/g, ' ').trim();
				})
				.catch(() => '');
			const expected = prerenderedMain(route);

			// The error page is what SvelteKit renders when a branch fails to
			// load. `_hydrate` catches that failure, so nothing else reports it.
			//
			// Anchored on the status code that error page puts first, rather
			// than searching the text for a 4xx/5xx-shaped number. Searching
			// matched "450" in /history's sample run data and failed a healthy
			// route.
			const showsErrorPage = /^\d{3}\b/.test(live) && live.length < 120;
			record(`${route} does not render an error page`, !showsErrorPage, live.slice(0, 50));

			// The yardstick: the client must render what the file says. A dead
			// chunk, a swapped file, or a failed hydration all break this.
			const head = (expected ?? '').slice(0, 40);
			record(
				`${route} renders its own prerendered content`,
				!!expected && live.startsWith(head),
				expected === null
					? 'no <main> in the prerendered file'
					: live.startsWith(head)
						? `${live.length} chars`
						: `expected "${head}" got "${live.slice(0, 40)}"`
			);

			// Stylesheets must have actually applied, not merely been requested.
			const styling = await page
				.evaluate(() => {
					let rules = 0;
					for (const sheet of document.styleSheets) {
						try {
							rules += sheet.cssRules.length;
						} catch {
							/* cross-origin, not our case */
						}
					}
					return { rules, background: getComputedStyle(document.body).backgroundColor };
				})
				.catch(() => ({ rules: 0, background: 'unknown' }));
			record(
				`${route} has styles applied`,
				styling.rules > 0,
				`${styling.rules} rules, body background ${styling.background}`
			);

			errors.settle();
			const knownHere = KNOWN_DEFECTS.filter((defect) => defect.route === route);
			const unexplained = errors.real.filter(
				(text) => !knownHere.some((defect) => text.includes(defect.match))
			);
			record(
				`${route} has no non-backend errors`,
				unexplained.length === 0,
				unexplained.length
					? unexplained.slice(0, 2).join(' | ').slice(0, 220)
					: `${errors.absence.length} backend-absence error(s), expected` +
						(knownHere.length ? `, ${knownHere.length} known defect(s) allowed` : '')
			);
			// The self-retiring half. A known defect that no longer appears
			// means the entry is stale, and a stale entry silently widens the
			// gate, so say so rather than letting it sit.
			for (const defect of knownHere) {
				record(
					`${route} known defect is still present (remove it from KNOWN_DEFECTS once fixed)`,
					errors.real.some((text) => text.includes(defect.match)),
					defect.why
				);
			}

			// A route other than the entry must serve its own file. Tauri's last
			// resort is to serve index.html, so a missing route answers 200 at
			// its own URL and only a byte comparison reveals it.
			if (route !== '/') {
				const [body, indexBody] = await Promise.all([
					fetch(base + route).then((response) => response.text()),
					fetch(base + '/index.html').then((response) => response.text())
				]);
				record(
					`${route} serves its own file, not the index fallback`,
					body.length > 0 && body !== indexBody,
					body === indexBody ? 'byte-identical to index.html' : `${body.length} bytes`
				);
			}

			await page.close();
		}

		// The interaction checks. Each needs the client to be live: markup
		// alone cannot satisfy any of them.
		console.log('\nInteractions require a live client');
		const page = await browser.newPage();
		const errors = watchErrors(page, base);
		await page.goto(base + '/', { waitUntil: 'load' });
		await page.waitForTimeout(SETTLE_MS);

		// 1. Client-side routing. A full document reload would also change the
		//    URL, so the document is stamped first and the stamp checked after:
		//    it survives a client-side navigation and is lost on a reload. The
		//    destination must also render, or navigating into a broken route
		//    would count as success — it did, in an earlier version.
		await page.evaluate(() => {
			window.__artifactProbe = 'survived';
		});
		const hrefs = await page.$$eval('a[href^="/"]', (anchors) =>
			anchors
				.filter((anchor) => anchor.offsetParent !== null)
				.map((anchor) => anchor.getAttribute('href'))
		);
		const target = hrefs.find((href) => href !== '/' && routes.includes(href));
		if (!target) {
			record('client-side navigation', false, 'no visible link to another prerendered route');
		} else {
			await page.click(`a[href="${target}"]`);
			await page.waitForURL((url) => url.pathname === target, { timeout: 15000 }).catch(() => {});
			await page.waitForTimeout(SETTLE_MS);
			const stamp = await page.evaluate(() => window.__artifactProbe);
			const landed = new URL(page.url()).pathname;
			const live = await page
				.evaluate(() => {
					const main = document.querySelector('main');
					return (main ? main.innerText : '').replace(/\s+/g, ' ').trim();
				})
				.catch(() => '');
			const expected = (prerenderedMain(target) ?? '').slice(0, 40);
			record(
				'navigating to a link does not reload the document',
				stamp === 'survived' && landed === target,
				`clicked ${target}, landed ${landed}, window stamp ${stamp ?? 'lost'}`
			);
			record(
				'the navigated-to route renders its own content',
				!!expected && live.startsWith(expected),
				live.startsWith(expected) ? `${live.length} chars` : `got "${live.slice(0, 40)}"`
			);
		}

		// 2. Event handlers are attached. A keyboard shortcut is handled only
		//    by live JavaScript; prerendered markup cannot answer it.
		//    Meta+N and the heading it reveals are the app's own, matching
		//    src/routes/+layout.svelte's shortcut map and the assertion in
		//    tests/e2e/wizard-modal.spec.ts.
		await page.goto(base + '/', { waitUntil: 'load' });
		await page.waitForTimeout(SETTLE_MS);
		const wizardHeading = page.getByRole('heading', { name: 'Project Intent' });
		// Counted, not `isVisible()`. A locator matching nothing reports not
		// visible, so the negation was true even on an application with no
		// working pages: the check could not fail.
		record('the wizard is closed before the shortcut', (await wizardHeading.count()) === 0);
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
		//    Quick Create's Create button is disabled unless both the name and
		//    the output path are non-empty, so flipping it from disabled to
		//    enabled requires a derived value to recompute and write to the
		//    DOM. The ids and the two-field rule are the app's own, from
		//    tests/e2e/quick-create.spec.ts.
		await page.goto(base + '/', { waitUntil: 'load' });
		await page.waitForTimeout(SETTLE_MS);
		await page.keyboard.press('Meta+Shift+N');

		const name = page.locator('#qc-name');
		const path = page.locator('#qc-path');
		// One locator for both assertions. Using a Playwright locator for the
		// disabled check and a raw querySelector scan for the enabled check
		// could resolve to different buttons and prove nothing.
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
				await createButton.waitFor({ state: 'visible', timeout: 5000 });
				for (let attempt = 0; attempt < 25 && !enabledAfterTyping; attempt++) {
					enabledAfterTyping = await createButton.isEnabled();
					if (!enabledAfterTyping) await page.waitForTimeout(200);
				}
			} catch {
				/* reported below */
			}
			record(
				'typing a name recomputes derived state and enables Create',
				enabledAfterTyping,
				enabledAfterTyping ? '' : 'Create stayed disabled, so nothing recomputed'
			);
		}

		errors.settle();
		record(
			'interaction pass produced no non-backend errors',
			errors.real.length === 0,
			errors.real.length ? errors.real.slice(0, 2).join(' | ').slice(0, 220) : ''
		);
		await page.close();
	} finally {
		await browser.close();
		server.close();
	}

	// A skipped block must not shrink the denominator silently. Six checks per
	// route plus the five shape checks and eight interaction checks.
	const expectedFloor = 7 + routes.length * 5 + KNOWN_DEFECTS.length;
	const failed = results.filter((result) => !result.ok);
	console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
	if (results.length < expectedFloor) {
		console.log(
			`\nFAILED: only ${results.length} checks ran, expected at least ${expectedFloor}. ` +
				`A block was skipped.\n`
		);
		process.exit(1);
	}
	if (failed.length) {
		console.log('\nFailed:');
		for (const result of failed) {
			console.log(`  - ${result.name}${result.detail ? `: ${result.detail}` : ''}`);
		}
		console.log('');
		process.exit(1);
	}
	console.log('Production artifact verified.\n');
}

main().catch((error) => {
	console.error('\nverify-production-artifact crashed:', error);
	process.exit(1);
});
