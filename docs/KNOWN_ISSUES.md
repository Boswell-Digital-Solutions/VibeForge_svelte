# Known Issues

## 2026-10-02 - `verify:repo-context` fails on a clean checkout (open)

- What is wrong: `bun run verify:repo-context` fails with `README title is Install dependencies; expected VibeForge`.
- Root cause: the README title extractor reads a heading that is not the product title. Not investigated further.
- The check `local_directory_name` also fails in a fresh clone. The directory is `VibeForge_svelte` and the manifest expects `Vibeforge`. This is expected outside the owner's checkout.
- No workflow runs this check, so CI does not show the failure. The new Documentation CI runs only `check:agent-instruction-drift`, which passes.
- Scope: open. Fix the README title extraction or the manifest, then add the check to the Documentation CI.

## 2026-10-02 - Scheduled nightly E2E workflow (open)

- What: `.github/workflows/e2e-nightly.yml` runs 6 browser shards every day at 02:00 UTC, whether or not code changed.
- The owner rule is "no scheduled full runs". The CI-scope change did not touch this workflow.
- Scope: open. The owner must decide whether to remove the schedule.

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
  answers on port 8002. `tests/e2e/auth-negative.spec.ts` covers the rejection,
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

## 2026-10-30 - Downstream E2E specs need a local service stack (open)

- What is wrong: with the login blocker gone the 138 specs under `tests/e2e/`
  run for the first time, and most of them fail on a 30s timeout.
- Cause: they are integration tests. On load the application requests
  `ws://localhost:8001/ws`, license validation on `http://localhost:8002`, and
  the DataForge and NeuroForge MCP servers. CI runs `pnpm dev` only, so every
  one is refused and the specs wait for content that never renders.
  Authentication is not involved.
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
- The three E2E jobs cannot finish. `.github/workflows/ci.yml` sets
  `timeout-minutes: 30` on the E2E job, and all three were cancelled at that
  cap on `7b93eed`. The local run took 21.6 minutes with two workers and no
  retries. CI uses one worker and two retries, so the same suite needs roughly
  two hours. The lane is therefore not slow; it cannot report a result at all.
- Before the login blocker was fixed the job failed in about two minutes,
  because 138 specs never ran. The fix removed that fast failure. Both states
  are red, but the shape changed, and the 30-minute cap is now the binding
  constraint.
- Do not raise `timeout-minutes` to absorb this. That hides the lane problem
  and spends more CI to reach the same red.
- Scope: open, and it is an owner decision, not a test fix. The options are to
  mock each service boundary, to run the stack in CI, or to classify these
  specs into their own project with their own gate, the way the
  real-authentication lane now works. Do not resolve it by skipping tests to
  reach green.

## 2026-10-30 - The documented CI path-filter rule is wrong for pull requests (closed)

- What was wrong: `doc/system/50-operations.md` stated that a change touching
  only documentation runs the Documentation CI and no code CI. That is true for
  a push to `main`, `master` or `develop`. It is false for a pull request.
- `ci.yml` lists `branches: [main, master, develop]` on both triggers. A push to
  a feature branch therefore never starts the code CI. The `pull_request`
  trigger starts it, and GitHub applies the `paths` filter to the whole diff
  against the base branch rather than to the pushed commit.
- Effect: a pull request that changes one source file runs the full code CI on
  every later push, including a documentation-only push. Measured on PR #13:
  `6df1c35` changed only `docs/KNOWN_ISSUES.md` and ran Lint, Unit Tests, Build
  and all three E2E jobs.
- Cost while the E2E lane cannot finish: every push to a code pull request
  spends three cancelled 30-minute E2E jobs, about 1.5 job-hours, whatever the
  push contains.
- Fix: the part is corrected. The rule now states both cases.

## 2026-10-30 - Service endpoint configuration is contradictory (open)

- What is wrong: the application cannot be pointed at one NeuroForge with one
  setting. Three variable names are read, and the same name carries different
  defaults in different modules.

| Variable | Default | Read by |
|---|---|---|
| `VITE_NEUROFORGE_URL` | `:8000` | `core/api/` (config, prompts, languages, stackProfiles, neuroforgeClient) |
| `VITE_NEUROFORGE_URL` | `:8002` | `lib/auth.ts` |
| `VITE_NEUROFORGE_API_URL` | `:8000` | `services/insights-client.ts` |
| `VITE_NEUROFORGE_API_URL` | `:8001` | `stores/teamStore.svelte.ts` |
| `VITE_NEUROFORGE_API_BASE` | `:8000/api/v1` | `api/neuroforge.ts` |
| `VITE_NEUROFORGE_API_BASE` | `:8002/api/v1` | `api/research.ts` |

- `.env.example` declares a fourth combination,
  `VITE_NEUROFORGE_API_BASE=http://localhost:8002/api/v1`.
- DataForge is tangled the same way. `teamStore.svelte.ts` puts DataForge on
  `:8000` and NeuroForge on `:8001`, which is the reverse of every other
  module. `api/dataforge.ts` defaults to `https://localhost:8001/api/v1`, and
  TLS cannot reach a local HTTP service.
- `core/stores/license.svelte.ts` hardcodes `http://localhost:8002/license`
  with no variable at all.
- Per the ecosystem port registry NeuroForge is 8000, DataForge is 8001 and
  8002 belongs to Rake. Confirm this against the registry before renumbering;
  the reading comes from the sibling repositories' own documents.
- Effect on the release gate: `.github/workflows/release-gate.yml` sets
  `VITE_NEUROFORGE_URL`, which is what `auth.ts` reads, so the gate does cover
  the authentication path. It does not cover insights or research, because
  those modules read other names. Consolidate the configuration before
  widening the gate, or it will report testing one endpoint while other
  modules reach their own defaults.
- Scope: open. This is a configuration change and needs an owner decision on
  which name is canonical.

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
