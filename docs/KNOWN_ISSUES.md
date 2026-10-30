# Known Issues

## 2026-10-30 - `/_archive/analytics` crashed on render (closed)

- What was wrong: loading `/_archive/analytics` threw
  `TypeError: Cannot read properties of undefined (reading 'toFixed')`. It
  reproduced identically under `pnpm dev`, so it was pre-existing and
  unrelated to the adapter change. The artifact verifier surfaced it, which
  was the first time anything in CI looked at that route.
- Fix: the route was retired with the rest of `_archive`, so the page is no
  longer reachable and the crash is no longer live. The verifier's
  `KNOWN_DEFECTS` entry for it was removed.
- The crash itself is **not fixed**: the code now sits in
  `src/archive/retired-routes/analytics/`, and anyone reviving that page will
  meet it again. It is recorded here for that reason.
- The removal was not silent. The verifier gained a check that every
  `KNOWN_DEFECTS` entry names a route that still exists, precisely because
  retiring the route stopped the per-route loop from visiting it, so the
  original self-retiring check could never have fired and the entry would have
  widened the gate unnoticed.
- Scope: closed as unreachable; the underlying defect is recorded above.

## 2026-10-30 - The artifact verifier passed broken artifacts (closed)

- What was wrong: `scripts/verify-production-artifact.mjs` reported
  `27/27 checks passed`, exit 0, against an artifact in which six of twelve
  routes rendered `500 Internal Error` and every stylesheet had been deleted.
- Root causes, each verified against the framework source:
  - The hydration signal, `history.state['sveltekit:history']`, is written by
    SvelteKit at `client.js:341` and `await _hydrate` is called at `:361`, so
    the key is stamped twenty lines before hydration. `_hydrate` catches a
    failed branch load and renders the error page, so the stamp survives a
    total failure. Five `hydrates` checks and the nested-reload check were
    satisfiable by the client merely starting.
  - The error classifier matched substrings, and `Failed to fetch` is the
    message of a failed dynamic import. `TypeError: Failed to fetch
    dynamically imported module` — the canonical broken-chunk symptom — was
    filed as backend absence. `Failed to load resource`, `Load failed` and
    `NetworkError` were similarly over-broad.
  - Errors were sampled at `load` with no settle, so a failure arriving more
    than about 100ms later was invisible.
  - Only five of twelve routes were probed, and nothing looked at CSS.
  - `X serves 200` could not fail, because Tauri's resolver falls back to the
    index for every path.
- Fix: rewritten. Routes come from `src/routes/`, not from the artifact. Each
  route's rendered output is compared against its own prerendered file after a
  settle. Styles, cross-route byte uniqueness, and stylesheet resolution are
  checked. Suppression is decided by the origin a request went to, not by
  wording. See `doc/system/50-operations.md`.
- Verified by rejecting twelve deliberately damaged artifacts, including the
  one that scored 27/27, while the healthy artifact scores 95/95.
- Scope: closed. The lesson is recorded in the script's own header, because
  this was the fourth instance of the same mistake in that file.

## 2026-10-30 - The desktop application could not be built (closed)

- What was wrong: `src-tauri/tauri.conf.json` set `frontendDist` to
  `"../build"`, and `svelte.config.js` used `@sveltejs/adapter-auto`, which
  detects a hosting platform and writes nothing when it finds none. That was
  the case here: `pnpm build` printed `Could not detect a supported production
  environment` and emitted only `.svelte-kit/output`. No `build/` directory
  existed, so `cargo build --bin vibeforge` and `tauri build` both failed with
  `proc macro panicked ... The frontendDist configuration is set to
  "../build" but this path doesn't exist`. A bare `cargo test` failed for the
  same reason, because it builds every target.
- Why CI did not catch it: `pnpm build` exits 0, and the `upload-artifact`
  step for `build/` defaulted to `if-no-files-found: warn`, so the Build job
  uploaded nothing and stayed green.
- Fix: `@sveltejs/adapter-static` with `pages` and `assets` set to `build`,
  and `prerender = true` in a root `src/routes/+layout.ts`. Chosen over
  pointing `frontendDist` at `.svelte-kit/output/client`, whose layout is a
  SvelteKit internal rather than a contract. Authorized by the operator on
  2026-10-30 on measured evidence.
- Measured outcome: all 16 routes prerender, 99 files, 5.2 MB, no route
  needing an opt-out. `cargo build --bins` then succeeds and produces
  `src-tauri/target/debug/vibeforge` — verified on a branch off `master` with
  no other change, so the adapter alone accounts for it. `pnpm run check` 0
  errors, `pnpm test:run` 1416 passed, `pnpm verify:artifact` 27 of 27.
- Guarded against recurrence in the Build job: an assertion step requiring
  `build/`, `build/index.html`, `build/_app/` and one file per route;
  `pnpm verify:artifact`; and `if-no-files-found: error` on the upload. See
  `doc/system/50-operations.md`.
- Scope: closed. Two related items stay open below: the four live
  `_archive` routes, and the commented-out route guard, which prerendering
  makes more pointed because static HTML cannot be auth-gated.

## 2026-10-30 - The Quick Run button navigated to a route that did not exist (closed)

- What was wrong: `src/lib/ui/layout/TopBar.svelte` called
  `goto("/quick-run")`. There was no `/quick-run` route; the only page with
  that name was `src/routes/_archive/quick-run/`. TopBar renders on every
  route except `/login`, so the button was on screen on 11 of the 12 live
  pages.
- Measured, twice each, by clicking the real button. Under `pnpm dev` nothing
  happened: no document request, no navigation, the URL stayed `/`, the rail
  still highlighted Workbench, and a value set on `window` survived — a silent
  no-op. Against the built artifact it was a full document load, `200
  /quick-run`, the URL left at `/quick-run`, the Workbench rendered, **no** nav
  item highlighted, and the `window` value gone. Tauri's resolver falls back to
  `index.html`, which is why an absent route answered 200.
- Fix: the operator ruled on 2026-10-30 to remove the button. The retired
  `quick-run` page was a predecessor of the Workbench — a prompt editor with
  context and model selection and an outputs pane — and that function is now
  the default page at `/`, already reachable from the logo and the rail's
  Workbench item. Repointing the button would have given a third path to the
  same page under a label that no longer described it.
- Guarded against recurrence: `scripts/verify-production-artifact.mjs` now
  requires every `goto()` and `href` target in `src/lib` and `src/routes` to
  name a declared route. Nothing caught the original, because the prerenderer
  crawls rendered HTML and so would have failed the build on a dangling `<a
  href>`, but cannot see a target inside an `onclick`.
- The guard was checked by reinstating the dangling `goto` (caught, naming the
  file) and by introducing a typo into a main-navigation `href` (caught). The
  second found a real gap in the first version of the guard: it matched only
  the literal `href="..."` attribute form and missed `href: '/contexts'`, the
  object-property form the main navigation actually uses, so every rail item
  was unchecked.
- Scope: closed.

## 2026-10-30 - `src/routes/_archive/` held four live routes (closed)

- What was wrong: `src/routes/_archive/` contained `analytics`,
  `dev-environment`, `presets` and `quick-run` pages. The directory name
  suggested they were retired, but SvelteKit treats `_archive` as an ordinary
  route segment, so `/_archive/analytics` and its three siblings were
  reachable routes. They appeared in `.svelte-kit/output` and prerendered to
  `build/_archive/*.html`.
- Fix: the operator ruled on 2026-10-30 that they are retired. The four
  directories moved to `src/archive/retired-routes/`, which is outside
  `src/routes/` and therefore not a route tree. That follows the convention
  `src/archive/demo-routes/` already set, and the move used `git mv` so the
  history is preserved. The code is still in the repository and still
  type-checks; it is simply no longer reachable.
- The artifact now holds 12 routes rather than 16.
- Follow-on: this also closed the `/_archive/analytics` crash, which is no
  longer reachable, and let the artifact verifier's `KNOWN_DEFECTS` list go
  back to empty.
- Left alone deliberately: `src/lib/components/quickrun/`,
  `src/lib/components/dev-environment/`, and parts of
  `src/lib/components/presets/` and `src/lib/components/analytics/` were
  imported only by the retired pages, so they are now orphaned. Removing them
  is a dead-code sweep, not a route retirement, and belongs in its own change.
- Scope: closed.

## 2026-10-30 - Components orphaned by the route retirement (open)

- What is wrong: retiring the four `_archive` routes left their component
  trees imported by nothing live. `src/lib/components/quickrun/`
  (`QuickRunForm`, `QuickRunHeader`, `QuickRunOutputs`) and
  `src/lib/components/dev-environment/DevEnvironmentPanel.svelte` were
  imported only by retired pages. Parts of
  `src/lib/components/presets/` and `src/lib/components/analytics/` are in the
  same position; those two need checking per-file, because some of their
  components are also used by live routes.
- Effect: dead code that still type-checks and still appears in search
  results, so a future reader may take it for a live surface. It is not
  shipped — Vite only bundles what is reachable from a route — so there is no
  artifact or runtime cost.
- Scope: open. A dead-code sweep, deliberately not folded into the route
  retirement: mixing a deletion of component trees into that change would
  have made both harder to review, and the per-file check for `presets/` and
  `analytics/` is real work rather than a mechanical delete.

## 2026-10-30 - No workflow builds or tests Rust (open)

- What is wrong: `src-tauri/` carries seven Tauri commands, an authority
  module, a governance model, a vault and a repo-truth module. No workflow in
  `.github/workflows/` runs `cargo check`, `cargo test`, `cargo fmt` or
  `cargo clippy`. The Rust side of this application is entirely unverified by
  CI.
- It also cannot be verified in a plain container: `cargo check` resolves
  crates but fails on the missing Tauri system libraries (`gdk-3.0`, and the
  webkit and gtk development packages).
- Consequence for the local inference lane: the desktop bridge holds a
  capability that must never reach the webview. Writing that component while
  neither CI nor a contributor's container can compile it would ship an
  unverified security boundary, so the first slice establishes the contract,
  the readiness state machine, the refusal taxonomy and the permission rules in
  TypeScript, where they are tested, and leaves the transport to a slice that
  can add Rust CI alongside it.
- Scope: open. A Rust job needs the system libraries installed in the runner,
  which is a CI change rather than a code change.

## 2026-10-02 - `verify:repo-context` fails on a clean checkout (open)

- What is wrong: `bun run verify:repo-context` fails with `README title is Install dependencies; expected VibeForge`.
- Root cause: the README title extractor reads a heading that is not the product title. Not investigated further.
- The check `local_directory_name` also fails in a fresh clone. The directory is `VibeForge_svelte` and the manifest expects `Vibeforge`. This is expected outside the owner's checkout.
- No workflow runs this check, so CI does not show the failure. The new Documentation CI runs only `check:agent-instruction-drift`, which passes.
- Scope: open. Fix the README title extraction or the manifest, then add the check to the Documentation CI.

## 2026-10-02 - Scheduled nightly E2E workflow (closed)

- What was wrong: `.github/workflows/e2e-nightly.yml` ran 6 browser shards
  every day at 02:00 UTC, whether or not code changed, against the owner rule
  that there are no scheduled full runs.
- Fix: the operator removed the schedule by ruling. The workflow is now
  `.github/workflows/e2e-full.yml`, triggered by dispatch or by a workflow
  call. Manual execution, sharding and merged reports are preserved. The
  failure-notification job is removed, because it existed to report an
  unattended run and would now file an issue on a lane an operator triggered
  and is watching.

## 2026-10-02 - Coverage step is advisory (open)

- `ci.yml` runs `pnpm test:coverage` with `continue-on-error: true`. A coverage failure does not fail the CI.
- Scope: open.

## 2026-10-02 - Code CI fails at install on `master` (open)

- What is wrong: every code job of `ci.yml` (Lint & Type Check, Unit Tests, E2E x3, All Tests Passed) fails at `pnpm install --frozen-lockfile` with `ERR_PNPM_NO_LOCKFILE ... pnpm-lock.yaml is absent`. The build job is skipped.
- Evidence: the same jobs fail on `master` push run 36749419622 (2026-09-30) and on the CI-scope PR run 37017895820. The CI-scope change did not cause it.
- Likely root cause (not tested): `pnpm-lock.yaml` is `lockfileVersion: '9.0'` and `ci.yml` pins pnpm 8, which cannot read a v9 lockfile and reports it as absent.
- Fix: pin pnpm 9 or newer in `ci.yml`, or regenerate the lockfile with pnpm 8.
- Scope: open.

## 2026-10-29 - Winner determination ignores a large quality gap (open)

- What is wrong: `PlanComparisonService.determineWinner` ranks only on the
  combined score from `calculateCombinedScore`, which weights quality 0.5,
  cost 0.25 and speed 0.25. A plan that is clearly worse can still win on
  cost and speed. With the suite fixtures, the session scoring 43 on quality
  wins over the session scoring 57.
- The `winner.reason` enum admits `quality`, `cost` and `speed`, but the
  service only ever returns `combined`, so those three are unreachable.
- `src/tests/planning/planComparisonService.test.ts` previously asserted that
  a quality gap over 10 points decides the winner. No such rule exists, so
  that test asserted intent rather than behavior. It now asserts the combined
  contract the service actually implements.
- Scope: open. Whether a large quality gap should override cost and speed is
  an owner decision, not a test fix.

## 2026-10-30 - Build pulled a Node-only module into the browser bundle (closed)

- What was wrong: `pnpm build` failed with `"basename" is not exported by
  "__vite-browser-external"` from
  `src/lib/refactoring/analyzer/FileSystemScanner.ts`, which imported
  `fs/promises` and `path`.
- Chain: `AnalyzeStep.svelte`, `PlanStep.svelte`, `ExecuteStep.svelte` and
  `CompleteStep.svelte` value-imported `RefactoringAutomation` from
  `$lib/refactoring`. That barrel re-exports `FileSystemScanner`, so a
  filesystem module landed in the client graph. The type-only imports of
  `$lib/refactoring/types/*` are erased and were not part of this.
- Why it surfaced then: the Build job `needs` the code jobs, so it was skipped
  for as long as they failed at install. With lint, types and unit tests green
  it ran, and this was the first error it reached.
- Fix: the four `path` functions the analyzers use are pure string operations,
  so they moved to `src/lib/refactoring/analyzer/posixPath.ts`, pinned against
  `node:path/posix` by `__tests__/posixPath.test.ts`. The filesystem calls
  (`readdir`, `stat`, `readFile`) resolve through `analyzerFs()` in
  `src/lib/refactoring/analyzer/nodeFs.ts`, which imports `node:fs/promises`
  from a variable specifier marked `@vite-ignore` so the bundler leaves it
  alone. `PlanStep`, `ExecuteStep` and `CompleteStep` imported
  `RefactoringAutomation` without using it; those three imports are gone.
- What the fix does not decide: a webview still cannot scan a codebase.
  `analyzerFs()` now says so, with a message naming the reason, instead of
  failing the build. Whether codebase analysis belongs behind Tauri IPC so the
  components can call it for real is still an owner decision.

## 2026-10-30 - Tailwind v4 migration was incomplete in component styles (closed)

- What was wrong: `pnpm build` failed on `Cannot apply unknown utility class
  font-mono` and `Could not resolve value for theme function:
  theme(colors.gray.100)`.
- Root cause: the repository is on Tailwind 4, where a component `<style>`
  block is compiled on its own. A theme-backed utility used through `@apply`
  needs `@reference "tailwindcss"`, and the v3 `theme('colors.a.b')` path was
  replaced by the `--color-a-b` CSS variable.
- Fix: `@reference "tailwindcss"` added to the nine component style blocks that
  use `@apply`, and 258 `theme('colors.*')` calls rewritten to
  `var(--color-*)` across five components.
- Scope: closed. Both Tailwind errors are gone; the build now reaches the
  bundling issue recorded above.

## 2026-10-30 - E2E auth setup cannot authenticate in CI (closed)

- What was wrong: all three E2E jobs failed in the `setup` project before any
  test body ran, so `1 failed, 138 did not run`.
- First diagnosis, and it was wrong: that the login failed because no auth
  backend runs in CI. It does not reach a backend at all. A probe showed no
  request leaving the browser, and the navigation to
  `http://localhost:5173/login?` with an empty query string is a native GET
  form submit, not a redirect.
- Root cause: `src/lib/utils/predictionCache.ts` imported `createHash` from
  `crypto`. Vite externalizes `crypto` for the browser and the proxy throws on
  property access, which raised a page error, aborted hydration and left the
  login form inert HTML with no handler attached. The import was dead:
  `hashMetadata` already calls `this.simpleHash`, which its own comment
  describes as the browser-compatible alternative. Deleting the import restored
  hydration, after which the login request fires, the route intercepts it and
  the page redirects.
- This is the same defect class as the Build failure above, and it survived the
  build because Vite only fails the build when it cannot resolve a named
  import. `crypto` resolved to a throwing proxy instead and failed at runtime.
- Fix: the hermetic lane, authorized by the operator ruling on PR #13.
  `tests/e2e/auth.setup.ts` answers the login request with a synthetic session
  from `tests/e2e/support/syntheticSession.ts`. It asserts the interception
  happened, so a glob that stopped matching cannot pass against whatever
  answers on NeuroForge's port. `tests/e2e/auth-negative.spec.ts` covers the rejection,
  unparseable-body, no-token and unreachable paths in all three browsers.
  `tests/e2e-real-auth/real-auth.spec.ts` is the only spec that authenticates,
  and `.github/workflows/release-gate.yml` is where it is required.
- The hermetic lane is not authentication coverage. See
  `doc/system/50-operations.md`.
- Fixed alongside this, because it was a plain CI bug: each matrix job ran
  `playwright install --with-deps <browser>`, but the `setup` project declares
  no browser and so runs in chromium. The firefox and webkit jobs therefore
  failed with `Executable doesn't exist at .../chromium_headless_shell-1194`
  before even reaching the login. They now install chromium as well.

## 2026-10-30 - Downstream E2E specs need a local service stack (open, lanes split)

- What is wrong: 88 of 143 specs fail because they are integration tests. On
  load the application requests `ws://localhost:8001/ws`, license validation on
  `http://localhost:8002`, and the DataForge and NeuroForge MCP servers. CI
  runs `pnpm dev` only, so every one is refused and the specs wait for content
  that never renders. Authentication is not involved.
- Measured locally on chromium, full run, two workers, no retries: 54 passed,
  88 failed, 1 skipped of 143, in 21.6 minutes. Six files hold 85 of the 88
  failures.

| Spec file | pass | fail | Blocked on |
|---|---|---|---|
| `quick-create` | 15 | 0 | — |
| `phase-4.1-team-dashboard` | 14 | 2 | — |
| `skip-wizard-preference` | 11 | 1 | — |
| `auth-negative` | 4 | 0 | — |
| `debug-shortcuts` | 1 | 0 | — |
| `phase-2.7-wizard-runtime` | 0 | 22 | Host language-runtime detection |
| `phase-2.7-dev-environment` | 1 | 21 | Host language-runtime detection |
| `phase-4.1-wizard-team-insights` | 0 | 15 | Team and insights data |
| `cortex-planning` | 2 | 11 | License validation on `:8002` |
| `wizard-modal` | 5 | 11 | Mixed |
| `workbench-golden-path` | 0 | 5 | Full stack |

- The 43 failures in the two `phase-2.7-*` files need host language-runtime
  detection, which asks whether Node or Python is installed. That is a Tauri
  host capability. No service supplies it, so those specs cannot pass in a
  browser whatever is running. "Runtime" there does not mean an inference
  runtime.
- Partly addressed: the lanes are split, by operator ruling. Ordinary CI now
  runs an eleven-test `@smoke` subset on chromium, blocking, in about a minute.
  Full browser regression moved to `e2e-full.yml`, by dispatch or call only. No
  test is skipped or disabled; the service-dependent specs still run in the
  full lane and still fail there, which is what its reports are for.
- Before the split, `ci.yml` ran all 143 specs on three browsers on every push
  under a 30-minute cap. One worker and two retries need about two hours, so
  all three jobs were cancelled and reported nothing, and every push to a code
  pull request spent about 1.5 job-hours to learn nothing.
- Scope: still open. The specs are classified by lane, not by dependency. The
  remaining decision is what to do with the 88: mock each service boundary, run
  the stack, or move them into a declared service-dependent project with its
  own gate, the way the real-authentication lane works. Do not resolve it by
  skipping tests to reach green.

## 2026-10-30 - Nothing gates publishing or deployment (open)

- What is wrong: `.github/workflows/release-gate.yml` runs the blocking
  real-authentication lane on a `v*` tag, but this repository has no publish or
  deploy workflow. A tag-triggered run happens alongside a release; it does not
  prevent one.
- Partly addressed: the gate now accepts `workflow_call`, so a future publish
  workflow can enforce it by construction, with `needs` on a called gate job or
  a protected environment that requires the check. The workflow header states
  the required shape.
- Full browser regression also accepts a workflow call, and belongs in the gate
  as a second blocking job once the service-dependent specs move to their own
  lane. It is not wired yet, because it cannot pass today and a gate that can
  never pass gates nothing.
- Scope: open until a publish or deploy workflow exists and declares the
  dependency.

## 2026-10-30 - Service endpoint configuration was contradictory (closed)

- What was wrong: the application could not be pointed at one NeuroForge with
  one setting. Three variable names were read, and the same name carried
  different defaults in different modules.

| Variable | Default | Read by |
|---|---|---|
| `VITE_NEUROFORGE_URL` | `:8000` | `core/api/` (config, prompts, languages, stackProfiles, neuroforgeClient) |
| `VITE_NEUROFORGE_URL` | `:8002` | `lib/auth.ts` |
| `VITE_NEUROFORGE_API_URL` | `:8000` | `services/insights-client.ts` |
| `VITE_NEUROFORGE_API_URL` | `:8001` | `stores/teamStore.svelte.ts` |
| `VITE_NEUROFORGE_API_BASE` | `:8000/api/v1` | `api/neuroforge.ts` |
| `VITE_NEUROFORGE_API_BASE` | `:8002/api/v1` | `api/research.ts` |

- DataForge was tangled the same way. `teamStore.svelte.ts` put DataForge on
  `:8000` and NeuroForge on `:8001`, the reverse of every other module, and
  `api/dataforge.ts` defaulted to `https://localhost:8001`, which cannot reach a
  local HTTP service. `core/stores/license.svelte.ts` hardcoded its endpoint
  with no variable.
- Fix: `src/lib/core/api/endpoints.ts` is now the only module that reads an
  endpoint variable. Three variables remain: `VITE_NEUROFORGE_URL`,
  `VITE_DATAFORGE_URL` and `VITE_LICENSE_API_URL`. Versioned paths, websocket
  URLs and MCP URLs are derived, so a host and a port cannot differ between
  protocols. The duplicate names are removed outright, with no alias and no
  fallback.
- Ground truth for the defaults: NeuroForge's own `.env.example` carries the
  Forge port registry map, 8000 for NeuroForge, 8001 for DataForge, 8002 for
  Rake, and `neuroforge_backend/auth_router.py` serves `/login/json`. The
  authentication default of `:8002` was therefore pointing at Rake, which does
  not serve authentication.
- `src/tests/stores/teamStore.test.ts` asserted the swap: it expected teams on
  `:8000` and insights on `:8001`, while its own test names said the opposite.
  It now asserts against the canonical constants, which still catches a caller
  swap but does not break when a default changes.
- Verified at run time, not by reading: a browser probe recorded authentication
  and the workbench on `:8000`, the two MCP endpoints on `:8000` and `:8001`,
  and nothing on an unexpected port.
- Out of scope deliberately: `core/utils/demoData.ts` keeps literal endpoints,
  because it is static seed content, and the `architecture-patterns` samples
  keep theirs, because they are code shown to the user rather than
  configuration.
- What stays open: the license endpoint still targets `:8002`, which no service
  implements. See the entry below.

## 2026-10-30 - No service implements license validation (open)

- What is wrong: `core/stores/license.svelte.ts` posts to
  `VITE_LICENSE_API_URL`, whose default is `http://localhost:8002/license`. The
  port registry assigns 8002 to Rake, and Rake has no license route. No service
  in the ecosystem implements `/license/validate`: ForgeCustomer owns licensing
  and has no such route, and Forge_Command has only an administrative license
  mutation at `PATCH /admin/users/{id}/license`.
- Effect: license validation always fails. The probe recorded
  `License validation error: TypeError: Failed to fetch`.
- The endpoint is now configurable rather than hardcoded, and its value is
  preserved rather than corrected, because guessing an owner would be worse
  than a visible failure.
- Scope: open. It needs a decision on which service owns license validation.

## 2026-10-30 - The route guard is commented out, so every route is open (open)

- What is wrong: `src/routes/+layout.svelte:53-61` carries the comment
  "TEMPORARILY DISABLED FOR SCAFFOLDING TESTING - bypassing authentication".
  The `isAuthenticated.subscribe` callback declares `currentPath` and then does
  nothing; the redirect to `/login` is commented out.
- There is no alternative guard. No `+layout.ts`, no `+layout.server.ts`, no
  `hooks.*`, and no `+server.*` exists under `src/routes`. Every route is
  reachable with no session.
- Pre-existing. `git diff origin/master..HEAD -- src/routes/` is empty.
- Consequence for the E2E lanes, stated so it is not overclaimed elsewhere: the
  hermetic session satisfies Playwright's project dependency and the setup's own
  assertions. It is not what grants page access, because nothing gates it. The
  138 specs were blocked by a failing `setup` project, not by an auth wall.
- Scope: open. Restoring the guard is a scoped change outside the work that
  found this.

## 2026-10-30 - No service implements the MCP route (open)

- What is wrong: `core/mcp/manager.ts` and `core/api/mcpClient.ts` point two
  default MCP servers at `NEUROFORGE_URL` plus `/mcp` and `DATAFORGE_URL` plus
  `/mcp`. Neither service implements that route: a grep for `/mcp` across
  `NeuroForge/neuroforge_backend/` and `DataForge/app/` finds nothing.
- The URLs are unchanged from before the endpoint consolidation; what was new
  was documentation asserting the route exists. That claim came from a browser
  probe which recorded the requests leaving, not a service answering. The
  claim is corrected in `.env.example` and
  `doc/system/40-integrations.md`.
- This is the third route in this class, with `/license/validate` and `/ws`.
- Scope: open. It needs a decision on whether these services expose MCP at all.

## 2026-10-30 - The release gate's isolated-account check is an attestation (open)

- What is wrong: `real-auth.spec.ts` refuses to run unless
  `E2E_REAL_AUTH_ACCOUNT_CLASS` is `isolated-test`. That was described as
  making the isolated-test-account requirement machine-checked. It is not. The
  check cannot inspect the credential, and when the value was a literal in
  `release-gate.yml` the workflow was attesting about itself, so the guard
  always passed and never examined anything.
- Partly addressed: the value now comes from the secret store, alongside the
  credentials it describes, so the attestation is made by whoever holds them.
  The workflow header and `doc/system/50-operations.md` now call it an
  attestation rather than verification.
- Scope: open in the sense that nothing automated can verify the claim. Keep
  the wording honest rather than adding a check that cannot work.

## 2026-10-30 - A client-written token yields an authenticated session (open)

- What is wrong: `src/lib/auth.ts` never validates a token. `isAuthenticated`
  (`:103`) is a truthiness check on the stored string; `decodeToken`
  (`:174-199`) base64-decodes the payload and returns the identity without
  checking a signature, as its own comment says; `isTokenExpired` (`:204-222`)
  trusts the token's own `exp`.
- Effect: anything able to write `localStorage['vibeforge_jwt_token']` yields a
  client that presents as authenticated with an arbitrary identity and expiry.
- Pre-existing. The synthetic session used by the hermetic E2E lane is a
  working demonstration of the property, not its cause.
- Defensible for a local-first workbench only while real authority stays
  server-side and nothing treats the decoded claims as an authorization
  decision. Combined with the disabled route guard above, that condition does
  not currently hold.
- Scope: open, and the same owner decision as the licence entry below.

## 2026-10-30 - A shared API key is exposed to the browser (open)

- What is wrong: `VITE_VIBEFORGE_API_KEY` is `VITE_`-prefixed, so Vite inlines
  it into client JavaScript by definition. It is read at
  `src/lib/api/dataforge.ts` and `src/lib/api/vibeforgeClient.ts`, and
  `.env.example` ships the default `vf-dev-key`.
- Pre-existing, and not changed by the endpoint consolidation, which edited
  adjacent lines in both files.
- Scope: open. A key that authenticates to a backend cannot be a browser
  constant; it needs either a per-user credential or a server-side proxy.

## 2026-10-30 - Client license state is not entitlement verification (open)

- What is wrong: `core/stores/license.svelte.ts` holds the tier in client state
  and derives `isFree`, `isTrial`, `isPro` and `isEnterprise` from it. It
  exposes `upgradeTier(tier)`, which sets that state directly, and `startTrial`.
  `validateLicense()` posts to a route no service implements, so validation
  always fails while the derived flags keep answering.
- Effect: nothing here can be treated as verified paid entitlement. A value the
  browser sets is not evidence.
- Validation also runs automatically, against the absent route, so the failure
  is recurring rather than triggered.
- Raised in the governance review of `e99f5f8`. Not addressed in that change,
  and not required to undo it.
- Scope: open. It needs the licensing owner decision first, then an explicit
  unverified state rather than a client-held tier.

## 2026-10-30 - The sync socket reconnects to a route that does not exist (open)

- What is wrong: `core/sync/websocket.ts` retries with exponential backoff up to
  `maxReconnectAttempts = 10`. No DataForge route answers `/ws`, so every
  attempt is refused. A browser probe recorded attempts at 1s, 2s, 4s and 8s.
- Effect: a connection that cannot succeed looks like one that is retrying. An
  explicit sync-unavailable state is preferable to indefinite reconnection.
- Raised in the governance review of `e99f5f8`. Not addressed in that change,
  and not required to undo it.
- Scope: open, pending an implemented and tested `/ws` contract.

## 2026-10-30 - Declared feature flags that nothing reads (open)

- What is wrong: `.env.example` declares `VITE_ENABLE_CONTEXT_SEARCH`,
  `VITE_ENABLE_MODEL_COMPARISON`, `VITE_ENABLE_RUN_HISTORY`,
  `VITE_LOG_API_CALLS` and `VITE_DEBUG_INTEGRATION`. No code reads any of them.
  `VITE_PUBLIC_API_BASE_URL` was also declared and unread; it is removed, because
  it named an endpoint.
- The file now states that the section is declaration only, so the flags do not
  look functional.
- Scope: open. Either implement them or remove them. That is a product decision
  rather than a configuration fix.

## 2026-10-30 - No local inference lane exists in the application (open)

- What is wrong: `src/` holds no reference to NeuronForge. Every
  inference-shaped client points at a NeuroForge endpoint.
- Effect: there is no local lane to run against, and no local lane to test.
  The product doctrine in this repository states that local works without
  cloud, and that cloud is an opt-in escalation lane and never required for
  trust. The code does not yet express that split.
- This also bounds the E2E lane question above. The service-dependent specs
  cannot run against a local inference service, because the application has no
  setting that names one.
- Scope: open. Adding a local lane is an architecture decision, not a test
  fix.

## 2026-10-30 - A login response with no token fails silently (open)

- What is wrong: when the endpoint answers 200 with valid JSON that carries no
  `access_token`, `login()` in `src/lib/auth.ts` resolves. `token.set(undefined)`
  clears the stored token, `decodeToken(undefined)` throws internally and
  returns the `unknown` placeholder user, and that placeholder is persisted to
  `vibeforge_user`. No error reaches the page and the user stays on `/login`
  with no feedback.
- Covered by `tests/e2e/auth-negative.spec.ts`, which asserts only the safety
  property: no token is stored and the page does not navigate. The test
  deliberately does not pin the silent behavior, so a fix does not have to
  change it.
- Scope: open. A fix means rejecting a response with no `access_token`, which
  changes production error handling and was outside the authorized scope of
  PR #13.
