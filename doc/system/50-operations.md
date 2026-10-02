# Operations

**Document version:** 1.0 (bootstrap scaffold)

Deployment, observability, incident response, and bounded repair.

> This chapter is a registry-generated bootstrap scaffold for a
> `application` class documentation system. Replace this placeholder with
> real authored content. Registry will not invent repo truth that is not
> already present in the repo.

## Which CI runs for which change

The rule: a change that touches only documentation runs the Documentation CI and no code CI.
A change that touches any other file runs the code CI.
A change that touches both runs both.
The code CI runs only when code changes.
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

