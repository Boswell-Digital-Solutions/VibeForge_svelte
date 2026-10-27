# Known Issues

## 2026-10-27 - The unit tests and the type check fail on `master` (open)

- What is wrong: on `master` at `148dbde`, `vitest run` reports 143 failed tests in 24 files (1172 passed). `svelte-check --tsconfig ./tsconfig.json` reports 196 errors and 245 warnings in 110 files.
- Failing test files include `src/lib/core/sync/*` (indexedDb, syncManager, websocket), `src/lib/refactoring/analyzer/__tests__/*`, `src/tests/planning/*`, `src/tests/stores/*` (analysisStore, license, workspace), `src/tests/integration/mcp.integration.test.ts`, `src/tests/performance/benchmarks.test.ts`, `src/lib/core/api/dataforgeClient.enhanced.test.ts` and seven `tools/stateforge/src/*` suites.
- Why CI does not show it: every code job fails at install first (the entry "Code CI fails at install on `master`").
- Evidence: measured locally on 2026-10-27 while verifying `fix/workbench-send-user-token`. That branch gives the same counts, plus its own 2 passing tests.
- Root cause: not investigated.
- Scope: open.

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
