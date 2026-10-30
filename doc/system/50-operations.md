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

1. An assertion step requiring `build/`, a non-empty `build/index.html` and
   `build/_app/`. It fails the job; it does not warn. It covers only those
   three, so a missing artifact fails before a browser starts.
2. `pnpm verify:artifact` runs `scripts/verify-production-artifact.mjs`
   against the built files.
3. The artifact upload sets `if-no-files-found: error`.

`verify-production-artifact.mjs` serves `build/` over a resolver written to
match Tauri's four-step order, then checks every route that `src/routes/`
declares. For each route it requires:

- the route to have its own non-empty file in the artifact;
- the browser to render what that route's prerendered file says it renders,
  compared after a settle;
- no SvelteKit error page, detected by the status code that page puts first
  rather than by searching the text for a 4xx-shaped number;
- stylesheets to have applied, measured as a non-zero `document.styleSheets`
  rule count;
- no console or page error that an absent backend does not account for;
- the route to serve its own bytes rather than the index fallback.

It also requires that no two routes serve byte-identical HTML, that every
stylesheet the entry page references resolves to a real `.css` file, and that
every in-app navigation target in `src/lib` and `src/routes` names a declared
route.

That last one reads `goto("/...")` calls and `href` targets in both their
literal-attribute and object-property forms, because the main navigation
declares `href: '/contexts'` and renders it as `href={item.href}`. It skips
`src/lib/data/architecture-patterns/`, whose paths belong to the project
VibeForge scaffolds for a user rather than to this application. It is a
literal scan, so a computed target is invisible to it; that is the honest
limit, and it catches the class of mistake that occurred.

Then four checks that need a live client: a link click that changes the route
without reloading the document, with the destination rendering its own
content; `Meta+N` opening the project wizard; `Meta+Shift+N` opening Quick
Create; and typing a project name flipping Quick Create's Create button from
disabled to enabled, which requires a derived value to recompute.

An absent service is distinguished from a defect by **where a request went**,
not by the wording of a message. A failed request to another origin is
absence. Anything naming a failed module import, a refused script or style, or
an error page is a defect whatever else it says.

#### Why it is shaped that way

Four earlier versions of these checks passed against artifacts that were
plainly broken. The shape of the mistake kept recurring, so it is recorded:

| Check | Why it proved nothing |
|---|---|
| `data-sveltekit-hydrated` on `<body>` | SvelteKit sets no such attribute |
| `fill(input, 'x')` then assert the input holds `x` | `fill` writes the DOM value directly; passed with the client bundle deleted |
| `history.state['sveltekit:history']` | written at `client.js:341`, twenty lines before `await _hydrate` at `:361`, and `_hydrate` swallows a failed branch load and renders the error page |
| route list derived from the artifact | a deleted route vanished from the checks instead of failing |
| each route compared against its own file | a file holding the wrong page made both sides wrong together |

A check must observe the application's rendered output, and must not be
satisfiable by the framework merely starting, nor by the artifact agreeing
with itself.

#### It is checked against broken artifacts

The script is run against deliberately damaged copies rather than assumed to
work. Each of these is rejected:

| Damage | Result |
|---|---|
| six route chunks dead and every stylesheet deleted | 62 of 95 |
| every route chunk deleted | 72 of 93 |
| all stylesheets deleted | 79 of 95 |
| two route chunks deleted | 89 of 95 |
| a route chunk that throws `TypeError: Failed to fetch` | 92 of 95 |
| `history.html` deleted | 93 of 95 |
| `settings.html` deleted | 93 of 95 |
| `settings.html` replaced by `dashboard.html` | 94 of 95 |
| a boot error thrown 300ms after load | 94 of 95 |
| a `goto()` target that is not a route | rejected, naming the file |
| a typo in a main-navigation `href` | rejected, naming the file |

The first of those passed an earlier version of the gate 27 of 27 while six
routes rendered `500 Internal Error` and the application shipped unstyled.

#### Known defects

`KNOWN_DEFECTS` in the script holds pre-existing failures the gate does not
fail on. An entry is keyed to a route and a message, never a skipped
directory, and everything else on that route is still checked.

Each entry is self-retiring in two ways. If the defect stops appearing, the
gate **fails** and asks for the entry to be deleted. If the entry names a
route that no longer exists, the gate **fails** too — added after retiring
the `_archive` routes left an entry pointing at a route the per-route loop no
longer visits, where nothing would have run its check and the entry would have
sat there widening the gate in silence.

The list is currently empty, which is the goal.

## Finding unreachable code

`pnpm find:unreachable` builds an import graph and groups every source file
under `src/lib` by what can reach it: routes, tests only, `src/archive` only,
or nothing. `--deletable` narrows the output to the files that can be removed
today.

It follows type-only, dynamic and re-export specifiers, which a grep cannot.
Barrels re-export, so a component can be reached by a live route through two
hops of `index.ts` and never appear in a grep near a route.

### Three traps it exists to clear

**Names are not identities.** The live `StatusBar` is
`src/lib/ui/layout/StatusBar.svelte`; another file of that name sat under
`src/lib/components/`. A name-based search reports the live file and keeps the
dead one, or the reverse. The repository also held two `vibeforgeClient.ts` and
two `types/learning.ts`, and `components/dev/` still mirrors filenames that
were deleted from `components/dev-environment/`.

**Unreachable is not dead.** `src/lib/core/neuronforge/` is reachable only
from its own tests, on purpose: the local inference lane ships its contract and
transport ahead of the UI that will consume them. A sweep of everything
unreachable would delete it. Read the buckets as questions, not as a delete
list — which is why the tool labels that bucket.

**Not every entry point is an import.** `src/tests/setup.ts` is named in
`vitest.config.ts` and imported by nothing, so a pure import graph calls it
unreachable. The tool scans the configuration files for paths and treats what
they name as roots.

### Safe to delete is narrower than unreachable

`tsconfig.json` excludes `**/archive/**` and nothing else, so `svelte-check`
reads every other file under `src/` whether a route reaches it or not.
Removing a file that an unreachable-but-still-checked file imports therefore
breaks `pnpm run check`.

That is not theoretical. Deleting `src/lib/api/runtimeClient.ts` broke
`src/lib/components/dev-environment/ToolchainsConfig.svelte`, a file nothing
imports at all. `--deletable` applies both tests: nothing live reaches the
file, and nothing still type-checked imports it.

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

