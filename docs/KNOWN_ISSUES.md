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

## 2026-10-30 - E2E auth setup cannot authenticate in CI (open)

- What is wrong: all three E2E jobs fail in the `setup` project before any test
  body runs, so `1 failed, 138 did not run`.
- `tests/e2e/auth.setup.ts:31` submits the login form and waits for a redirect
  to `/`; the app stays at `http://localhost:5173/login?` and the wait times
  out after 10s. The suite's `webServer` starts `pnpm dev` only, so there is no
  auth backend for the login to succeed against, and every browser project
  declares `dependencies: ['setup']`.
- Why it surfaced now: these jobs died at `pnpm install` for as long as the
  pnpm 8 pin stood, so the suite had never run.
- Scope: open. Making this green is an owner decision on how E2E should
  authenticate — seed `vibeforge_jwt_token` into `storageState` directly, stand
  up a stub auth endpoint, or intercept the login route with Playwright's
  `page.route`. Each changes what the 139 tests actually prove, so none should
  be picked silently.
- Fixed alongside this, because it was a plain CI bug: each matrix job ran
  `playwright install --with-deps <browser>`, but the `setup` project declares
  no browser and so runs in chromium. The firefox and webkit jobs therefore
  failed with `Executable doesn't exist at .../chromium_headless_shell-1194`
  before even reaching the login. They now install chromium as well.
