# Operations

**Document version:** 1.0 (bootstrap scaffold)

Deployment, observability, incident response, and bounded repair.

> This chapter is a registry-generated bootstrap scaffold for a
> `application` class documentation system. Replace this placeholder with
> real authored content. Registry will not invent repo truth that is not
> already present in the repo.

## Which CI runs for which change

The rule holds for a push to `main`, `master` or `develop`.
A push that touches only documentation runs the Documentation CI and no code CI.
A push that touches any other file runs the code CI.
A push that touches both runs both.
The nightly E2E workflow is schedule-only and is not part of this rule.

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

There are two E2E lanes. They make different claims.

### The hermetic lane

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

### The real-authentication lane

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
It runs on a `v*` tag and on manual dispatch.
The job is blocking.
It fails when the settings are absent, so a release cannot pass it unconfigured.

### What the downstream specs need

The 138 specs under `tests/e2e/` beyond the auth files are integration tests.
They need a local service stack that CI does not run.
The application requests `ws://localhost:8001/ws`, license validation on
`http://localhost:8002`, and two MCP servers.
Each request is refused in CI, so the specs time out on content that never
renders.
Authentication is not the cause.
See `docs/KNOWN_ISSUES.md`.

