# Runtime

**Document version:** 1.1 (partial runtime inventory)

Runtime topology, process boundaries, and managed state.

This chapter records the verified comparison module behavior below. Other runtime
subsystems still require source-backed documentation; this is a partial inventory.


## Plan comparison module loading

The comparison store imports the pure combined-score function statically.
Multi-plan ranking remains synchronous: its `Array.map` callback returns scored
session objects, then sorts those objects. It performs no dynamic import, provider
request or authority decision. A dynamic `await` inside that non-async callback
previously prevented module transformation and blocked the browser dev server.
The existing comparison-store regression suite exercises module loading and the
synchronous comparison entry points. Other application type/test failures remain
independent CI blockers and are not waived by repairing this parse error.


The prediction cache has no Node `crypto` runtime import. Its existing synchronous
in-memory key algorithm is unchanged. An unused `createHash` import previously
caused Vite's browser externalization error during workbench loading; removing it
does not change cache keys, ledger hashing, signatures or persisted evidence.
A browser-module regression rejects accidental Node-crypto dependencies at import.


The comparison JSON export button renders literal braces as text. The marketplace
report modal renders its required/optional detail marker through a Svelte conditional
block. These template corrections preserve the existing labels and conditions while
removing parse errors; report submission and export authority are unchanged.


Component styles that use Tailwind `@apply` reference the application stylesheet
with `@reference`. This supplies the existing theme and utilities in separately
compiled Svelte styles without duplicating CSS or changing the intended classes.
The missing reference previously caused the browser route to return HTTP 500.
The integration contract follows the [Tailwind reference directive](https://tailwindcss.com/docs/functions-and-directives#reference-directive).
