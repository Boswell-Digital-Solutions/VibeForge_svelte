# Known Issues

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
