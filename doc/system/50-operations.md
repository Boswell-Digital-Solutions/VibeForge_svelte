# Operations

**Document version:** 1.1 (partial operations inventory)

Deployment, observability, incident response, and bounded repair.

This chapter records verified CI routing and packaging operations. Other
operational subsystems still require source-backed documentation.

## Which CI runs for which change

A pull request whose complete change set contains only documentation runs
Documentation CI and excludes code CI. A pull request containing code or workflow
changes runs code CI; one containing both code and docs runs both.
A docs-only tip commit on an existing code PR can therefore rerun code CI: GitHub
uses the cumulative three-dot PR diff, rather than only that last commit. See
[GitHub diff comparisons](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#git-diff-comparisons).
The nightly E2E workflow is schedule-only and is not part of this rule.

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



## Required Debian archive inspection

Use Lintian on every final Debian archive before distribution:

```bash
python3 scripts/packaging/lint_debs.py /path/to/final.deb --report /path/to/new-report.json
bash scripts/packaging/tauri-checked.sh build --bundles deb
python3 -m unittest discover -s scripts/packaging -p test_lint_debs.py -v
```

The checker requires Lintian on `PATH`. Missing tools, empty inputs, runtime errors
and error-level findings return nonzero. Warnings remain visible in the report.
The checker clears `LINTIAN_` environment options and disables user configuration.
It uses the Debian profile and retains existing package overrides. This change
adds no overrides and does not change signing or authority policy.

The report retains the tool version, full output, exit status, archive size and
SHA-256. The checker hashes each archive before and after inspection. It refuses
to replace an existing report. Choose a fresh evidence path for each run.
Inspection does not install the archive or execute its maintainer scripts.
A successful inspection is not source provenance, native runtime proof or release acceptance.

The checked Tauri wrapper preserves CLI arguments and the signing environment.
On Linux it checks Debian output after a successful build. It recognizes debug
builds, explicit targets and `CARGO_TARGET_DIR`. Old output that the build did
not refresh is rejected. Explicit AppImage-only and no-bundle invocations make
no Debian validation claim. Use explicit bundle arguments when an overlay changes
the default bundle formats. Unrecognized output layouts fail on missing archives;
inspect those final archives with the checker command directly.

The `Debian archive checks` workflow runs command regressions on packaging changes.
Its manual archive job accepts an existing workflow run ID and artifact name.
It downloads artifacts from this repository with read permission, checks every
`.deb`, and retains the source workflow metadata and inspection report on failure.
It does not build, publish or install applications. Workflow metadata does not
prove the source of an arbitrary binary inside an artifact.

The command regressions use a tool double. They test missing tools, error and
warning results, silent failures, multiple archives, evidence preservation,
configuration isolation, build failure propagation and stale build output.
Real archive results are separate evidence. Findings require source verification;
no new override, symbol stripping or binary modification is authorized by a tag alone.

This repository has no automatic Debian-producing CI job. The checked build
command and manual archive workflow provide explicit package inspection. They
do not establish automatic coverage for arbitrary direct Tauri CLI invocations.

The current documentation builder has no strict `--check` mode. That argument
runs a rebuild. Validation must compare generated output hashes across rebuilds;
exit status alone does not prove that committed documentation was current.

Application CI uses pnpm 10 with the committed version-9 `pnpm-lock.yaml`.
The earlier pnpm-8 runner could not read that format: it warned that the lockfile
was incompatible, then reported `ERR_PNPM_NO_LOCKFILE`. The lockfile was present;
the earlier missing-file diagnosis was incorrect. All four setup jobs now use
the compatible major version, while `pnpm install --frozen-lockfile` remains
mandatory. No dependency resolution or lockfile content changes are included.
A local offline, lockfile-only validation under pnpm 10 confirms format
compatibility without installing dependencies or running lifecycle scripts.
Frontend, unit, build and all three browser checks remain required; a setup fix
alone does not prove those later checks passed.

After Tauri succeeds, the checked wrapper reads Cargo metadata for the actual
target directory. This supports workspace roots and configured output directories
without assuming `src-tauri/target`. Metadata runs offline with the existing
lockfile and no dependency listing. Metadata failure blocks archive inspection
and upload; the wrapper does not guess another path.


StateForge declares Bun's test API in its own package. Run its complete suite
with `cd tools/stateforge && bun test`; the required CI `StateForge Tests (Bun)`
job uses Bun 1.3.14. Vitest excludes only that separately tested tool directory.
The aggregate `All Tests Passed` job requires the StateForge result as well as
frontend type checks, unit tests, browsers and build. A missing, skipped or failed
StateForge job blocks that aggregate. No invariant test is waived or converted to
an advisory check. Running the fixtures is validation, not acceptance of a model,
evidence chain, release posture or qualification gate.


Each browser matrix runner provisions Chromium as well as its selected engine:
Playwright's shared `setup` project uses Chromium even in Firefox/WebKit lanes.
Provisioning only the selected engine previously prevented authentication setup
from starting. Setup still invokes the real application login path; a missing or
rejecting backend remains a failure. The login page's legacy development-mode
claim does not authorize bypassing the backend or accepting a synthetic token.
No authentication implementation, authority requirement or backend/cloud boundary
is changed by installing the required test engine.


For an independent documentation correction after a code PR is merged, branch
from the updated default branch and open a docs-only PR so its complete diff stays
within the documentation paths. Canonical chapters affected by a code change must
still be current in that code PR before merge; a later docs-only PR is not a way
to defer mandatory behavior documentation or bypass its required checks.
