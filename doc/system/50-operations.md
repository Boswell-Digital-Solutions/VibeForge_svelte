# Operations

**Document version:** 1.0 (bootstrap scaffold)

Deployment, observability, incident response, and bounded repair.

> This chapter is a registry-generated bootstrap scaffold for a
> `application` class documentation system. Replace this placeholder with
> real authored content. Registry will not invent repo truth that is not
> already present in the repo.

## The production build

`pnpm build` writes a directory of prerendered files to `build/`.
`src-tauri/tauri.conf.json` names that directory as `frontendDist: "../build"`
and `generate_context!` reads it at compile time, so the desktop binary does
not compile without it.

### Why adapter-static

`svelte.config.js` uses `@sveltejs/adapter-static` with `pages` and `assets`
both set to `build`, and `src/routes/+layout.ts` sets `prerender = true` for
every route below it, which is all of them.

Before this, the repository used `@sveltejs/adapter-auto`. That adapter detects
a hosting platform and writes nothing when it finds none, which was the case
here: `pnpm build` printed `Could not detect a supported production
environment` and emitted only `.svelte-kit/output`. The desktop application
therefore could not be built at all, and CI did not notice, because
`pnpm build` exits 0 and the artifact upload only warned about the empty path.

Prerendering every route is viable because nothing in this application needs a
server at runtime. `src/routes/` holds no `+page.server.ts`, no
`+layout.server.ts`, no `+server.ts`, no form action and no dynamic route
parameter, so SvelteKit enumerates every route without crawling for links.

`trailingSlash` stays at its default of `never`, so a route is written as
`settings.html` rather than `settings/index.html`. That matches Tauri's asset
resolver, which tries the exact path, then `<path>.html`, then
`<path>/index.html`, then `index.html`
(`tauri-2.9.3/src/manager/mod.rs`, `AppManager::get_asset`). A reload at a
nested route therefore resolves to that route's own file.

`strict` stays at its default of `true`, so the build fails if any route is
not prerendered rather than producing an artifact with holes in it. No
`fallback` is configured, because setting one switches that check off.

### How the artifact is verified

Three things guard it, in the `Build` job of `.github/workflows/ci.yml`:

1. An assertion step requires `build/`, a non-empty `build/index.html`,
   `build/_app/`, and one non-empty file per route. It fails the job; it does
   not warn.
2. `pnpm verify:artifact` runs `scripts/verify-production-artifact.mjs`
   against the built files.
3. The artifact upload sets `if-no-files-found: error`.

`verify-production-artifact.mjs` serves `build/` over a resolver written to
match Tauri's four-step order, then requires the client to be live. Equal
counts of links and buttons would not do: prerendered HTML carries the full
markup whether or not the client ever hydrates, so a page with dead event
handlers measures the same as a working one. Each check instead needs
something only a running client produces:

- the `sveltekit:history` key that SvelteKit's client router stamps into
  `history.state` on startup, which cannot be present in static markup;
- clicking an in-app link and finding a value set on `window` still there
  afterwards, which a document reload would have destroyed;
- `Meta+N` revealing the project wizard, and `Meta+Shift+N` revealing Quick
  Create, both handled only by live JavaScript;
- typing a project name flipping Quick Create's Create button from disabled to
  enabled, which requires a derived value to recompute and write to the DOM;
- `/settings` serving bytes that differ from `index.html`, because Tauri's last
  resort is to serve the index, so a route missing from the artifact answers
  200 at its own URL and only a comparison reveals it.

The script was checked against deliberately broken artifacts. With
`build/_app/immutable/entry` deleted, 8 checks fail. With `build/settings.html`
deleted, the route still serves 200 and hydrates, exactly as it would in Tauri,
and the byte comparison is the single check that fails.

## Which CI runs for which change

The rule holds for a push to `main`, `master` or `develop`.
A push that touches only documentation runs the Documentation CI and no code CI.
A push that touches any other file runs the code CI.
A push that touches both runs both.
The full browser regression workflow runs by dispatch or by call, and is not part of this rule.

The rule does not hold for a pull request.
The `push` trigger lists `branches: [main, master, develop]`, so a push to a
feature branch does not start the code CI at all.
A pull request starts it instead, and GitHub applies the `paths` filter to the
whole diff against the base branch, not to the pushed commit.
A pull request that changes one source file therefore runs the code CI on every
later push, including a push that touches only documentation.
Measured on PR #13: commit `6df1c35` changed only `docs/KNOWN_ISSUES.md` and ran
the full code CI, because the pull request already carried source changes.
Do not expect a documentation commit on a code pull request to skip the code CI.

The `CI` workflow (`.github/workflows/ci.yml`) uses a workflow-level `paths` filter on `push` and `pull_request`.
The filter includes `**` and then excludes `docs/**`, `doc/**` and `**/*.md`.
The last matching pattern wins.
A change to `.github/workflows/**` is code, so it runs the code CI.

No documentation path is re-included.
No test, build step or generator reads a repository documentation file.
The repo-context tests write their own `README.md` fixtures in a temporary directory.
The application does not publish Markdown.

The `Documentation CI` workflow (`.github/workflows/documentation.yml`) runs for `docs/**`, `doc/**`, `**/*.md` and its own file.
It runs `bash doc/system/BUILD.sh` and fails if `git diff --exit-code -- doc` shows a difference.
It also runs `bun run check:agent-instruction-drift`.

Secret scanners must run on every change, because a documentation file can hold a secret.
This repo has no secret scanner workflow today.

Do not add a required status check on a path-filtered workflow.
When the filter skips the workflow, the required check stays pending and blocks the merge.

## E2E lanes

There are three E2E lanes. They make different claims and run at different
times.

| Lane | Workflow | Trigger | Blocking |
|---|---|---|---|
| PR smoke | `ci.yml`, job `e2e-smoke` | Every code pull request | Yes |
| Full browser regression | `e2e-full.yml` | Dispatch, or a workflow call | No, see below |
| Real authentication | `release-gate.yml` | A `v*` tag, dispatch, or a call | Yes |

### PR smoke

Chromium only, hermetic, and bounded. It runs the specs tagged `@smoke`:
eleven critical-path tests covering login failure, project creation, the
wizard opening and closing, and preference persistence. It finishes in about
one minute, and the job is capped at 15.

To add a test to this lane, tag it `@smoke`. Keep the lane bounded. It exists
to catch a broken critical path quickly, not to cover the product.

### Full browser regression

Every spec, on Chromium, Firefox and WebKit, in four shards per browser, with
merged reports. It is capped at 60 minutes.

It is not in ordinary pull-request CI, and it has no schedule, under the rule
that there are no scheduled full runs.

This lane fails today. Most specs need a local service stack that CI does not
run. The reports are the point: they state which specs still depend on a
service. It is therefore not a blocking job in the release gate, because a gate
that cannot pass gates nothing. Run it at release qualification and read the
reports.

### Why the lanes are split

Before the split, `ci.yml` ran all 143 specs on three browsers on every push,
capped at 30 minutes. One worker and two retries need about two hours, so all
three jobs were cancelled at the cap and reported nothing. The cap was not the
defect; the lane was. Raising it would have spent four times the CI to reach
the same red.


### How the hermetic session works

The `setup` project answers the login request in the browser.
`tests/e2e/support/syntheticSession.ts` holds the synthetic session.
It mints the token at run time, because `initAuth()` logs out an expired token.
The chromium, firefox and webkit projects then start from a signed-in page.

This lane does not authenticate.
No request leaves the browser.
A green run says nothing about NeuroForge login.
Do not report it as authentication coverage.

`tests/e2e/auth-negative.spec.ts` covers the failure paths in a real browser.
It covers a rejected credential, an unparseable success body, a success body
with no token, and an unreachable endpoint.
Each case asserts that no session starts.

The application has no bypass.
`src/lib/auth.ts` always performs a real request.
All interception lives under `tests/`.

### How the real-authentication lane works

`tests/e2e-real-auth/real-auth.spec.ts` is the only spec that authenticates.
It intercepts nothing.
It asserts that the request reached the configured host.
It asserts that the token is not a synthetic one.

The lane skips when the settings are absent, so pull-request CI stays hermetic.
`E2E_REAL_AUTH_REQUIRED=true` turns an absent or inconsistent setting into a
failure instead.

| Setting | Purpose |
|---|---|
| `E2E_REAL_AUTH_URL` | The test NeuroForge endpoint |
| `E2E_REAL_AUTH_USERNAME` | The isolated test account |
| `E2E_REAL_AUTH_PASSWORD` | That account's password |
| `E2E_REAL_AUTH_ACCOUNT_CLASS` | Must be `isolated-test`, or the spec refuses to run |
| `E2E_REAL_AUTH_REQUIRED` | `true` makes the lane blocking |
| `VITE_NEUROFORGE_URL` | What the application reads; must equal `E2E_REAL_AUTH_URL` |

The account must be an isolated test account.
Do not supply production credentials.
The spec performs a login and reads local storage.
It writes nothing.

The spec compares `VITE_NEUROFORGE_URL` with `E2E_REAL_AUTH_URL` and fails on a
mismatch.
Without that check the page can use the default endpoint while the gate reports
a real one.

### The release gate

`.github/workflows/release-gate.yml` runs the real-authentication lane.
It runs on a `v*` tag, on dispatch, and on a workflow call.
The job is blocking, and it fails when the settings are absent, so the gate
cannot pass unconfigured.

**The gate does not yet gate anything.** This repository has no publish or
deploy workflow. A tag-triggered run happens alongside a release; it does not
prevent one.

`workflow_call` exists so a future publish workflow enforces the gate by
construction. A publish job must call this workflow and declare `needs` on it,
or sit behind a protected environment that requires the check. A publish job
that merely runs after this one is not gated.

Full browser regression also accepts a workflow call, and belongs here as a
second blocking job once the service-dependent specs move to their own lane.

### What the downstream specs need

The 138 specs under `tests/e2e/` beyond the auth files are integration tests.
They need a local service stack that CI does not run.
The application requests `ws://localhost:8001/ws`, license validation on
`http://localhost:8002`, and two MCP servers.
Each request is refused in CI, so the specs time out on content that never
renders.
Authentication is not the cause.
See `docs/KNOWN_ISSUES.md`.

