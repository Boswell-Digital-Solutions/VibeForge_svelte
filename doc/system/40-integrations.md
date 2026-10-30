# Integrations

**Document version:** 1.0 (bootstrap scaffold)

External integrations, upstream services, and wire contracts.

## Service endpoints

One variable configures one service. `src/lib/core/api/endpoints.ts` is the only
place that reads an endpoint variable. Every other module imports a constant
from it.

| Variable | Default | Service | Shape |
|---|---|---|---|
| `VITE_NEUROFORGE_URL` | `http://localhost:8000` | NeuroForge | Origin |
| `VITE_DATAFORGE_URL` | `http://localhost:8001` | DataForge | Origin |
| `VITE_LICENSE_API_URL` | `http://localhost:8002/license` | License validation | Base path |

The two origins take a scheme, a host and a port, and no path.

`VITE_LICENSE_API_URL` is a base-path URL, not an origin. It includes its
`/license` segment, and a caller appends to it. It is shaped differently
because no service owns the route, so there is no origin to name.

Never add a trailing slash. The module strips one and derives the rest:

| Constant | Derived from |
|---|---|
| `NEUROFORGE_API_V1` | `NEUROFORGE_URL` plus `/api/v1` |
| `DATAFORGE_API_V1` | `DATAFORGE_URL` plus `/api/v1` |
| `NEUROFORGE_WS_URL` | `NEUROFORGE_URL` with the `ws` scheme |
| `DATAFORGE_WS_URL` | `DATAFORGE_URL` with the `ws` scheme, plus `/ws` |

A websocket URL is derived rather than configured, so the host and the port
cannot differ between the two protocols.

The MCP client URLs are also derived, from `NEUROFORGE_URL` plus `/mcp` and
`DATAFORGE_URL` plus `/mcp`. Neither service implements that route today, so
both connections fail. See `docs/KNOWN_ISSUES.md`.

Defaults follow the port map in the Forge port registry, which NeuroForge's own
`.env.example` states: 8000 for NeuroForge, 8001 for DataForge, 8002 for Rake.
NeuroForge serves `/api/v1/auth/login/json`, so authentication uses
`NEUROFORGE_URL`.

### What stays open

The license default targets port 8002, which the registry assigns to Rake. No
service in the ecosystem implements `/license/validate`. The value is preserved
rather than corrected, because which service owns license validation is an open
question. See `docs/KNOWN_ISSUES.md`.

No DataForge route answers `/ws` today, so a sync connection is refused, and
neither service answers `/mcp`.

The application holds no reference to NeuronForge, so there is no local
inference lane to configure. See `docs/KNOWN_ISSUES.md`.
## Local inference lane

NeuronForge Local holds inference responsibility. VibeForge holds developer
authority. A trusted desktop bridge sits between them.

### The browser cannot reach the node

The service's `LocalCallerBoundary` denies any request that carries an `Origin`
header, with 403 `invalid_local_caller`, before it parses a body or touches a
device. A browser sends `Origin` on this request, so a webview `fetch` cannot
reach the node even with a correct capability. The boundary also requires a
loopback `Host` whose port matches the server's.

The bridge is therefore not an abstraction for convenience. It is the only
shape of caller the service admits.

### The capability

The service compares a capability supplied in
`X-AuthorForge-NeuronForge-Capability` against the value in its
`NEURONFORGE_LOCAL_CAPABILITY` environment variable. The boundary's own
documentation states that the supervisor gives that capability to a service and
its trusted proxy, and never to the webview.

The capability must never be placed in a `VITE_`-prefixed variable or in
browser storage. Vite inlines every `VITE_` variable into client JavaScript, so
a capability placed in one is published to anyone who loads the application.
`src/lib/core/neuronforge/__tests__/bridge.test.ts` enforces this by reading
the module source.

### What this slice establishes

`src/lib/core/neuronforge/contract.ts` pins the node contract to
`service/nf_node_api.py`: `GET /nf-node/health`, `GET /nf-node/capabilities`,
and the `NeuronForgeExecutionDelegation.v1` payload of
`POST /nf-node/execute`.

`src/lib/core/neuronforge/bridge.ts` holds the readiness state machine, the
refusal taxonomy, and the bridge port.

Readiness reads the response body, never the status code. The health route
answers 200 with `status: "degraded"` when the runtime is down, and its own
documentation says the status code must never be read as "Ollama is up". A
caller keyed on the status code reports a healthy lane over a dead runtime.

Every lane state is distinguishable: `ready`, `runtime_degraded`, `refused`
with the specific refusal, `unreachable`, `bridge_absent`, and
`bridge_unconfigured`. There is no state meaning "probably fine", and no cloud
fallback: an unavailable local lane is a reported state, never a silent
escalation.

`refused` and `bridge_unconfigured` are deliberately separate. A refusal is the
node rejecting a request that was made. A misconfigured bridge never sent one,
and the remedy is local configuration rather than anything about the node.

### The transport

`src-tauri/src/neuronforge/mod.rs` holds the desktop side: the loopback
transport, the capability read, and the `neuronforge_lane_state` Tauri command.
It performs readiness only and issues no execution.

The capability is read from `NEURONFORGE_LOCAL_CAPABILITY` in the Rust process
and never crosses the IPC boundary. The command returns a lane state and
nothing else, so the webview cannot read, log or store the capability. Its
shape is checked before any request goes out, against the `[A-Za-z0-9_-]{32,512}`
the service accepts, so a malformed value is reported as a local configuration
fault rather than sent and returned as a 401, which would read as the wrong
problem.

The transport builds its URL from a fixed loopback authority,
`127.0.0.1:8027`, rather than from configuration, so no setting can redirect
the capability to another host. It sends no `Origin` header. A test serves one
request from a throwaway listener and asserts the exact bytes that leave: the
capability header present, no `Origin`, a loopback `Host`.

`src/lib/core/neuronforge/desktopBridge.ts` is the webview's only handle on the
bridge. In a plain browser it reports `bridge_absent` and asks nothing, because
a request from a browser would be refused for its `Origin` and report as a
permissions problem rather than as the wrong kind of caller.

### The wire contract between the two sides

The two sides are written in different languages with different naming
conventions, and a disagreement between them is invisible at runtime: a key
renamed on the Rust side arrives in the webview as `undefined`, not as an
error.

So the shape is declared once, in
`src/lib/core/neuronforge/lane-state.fixtures.json`, and each side is tested
against that file rather than against the other side's source.
`src-tauri/src/neuronforge/tests.rs` asserts its serialization equals the
fixtures; `src/lib/core/neuronforge/__tests__/laneStateParity.test.ts` asserts
each fixture narrows through the TypeScript union with every field reachable.
Adding a state means changing three files, and both tests fail until they
agree.

Writing that test found a live defect: Rust emitted `resident_models` where the
webview reads `residentModels`.

### Verification

`.github/workflows/ci.yml` runs a `Rust Bridge (lib)` job: `rustfmt --check`
over the library's files, `cargo clippy --lib -- -D warnings`, and
`cargo test --lib`. It is blocking through `All Tests Passed`.

The job covers the library target only. `cargo test` without `--lib` builds the
`vibeforge` binary, whose `generate_context!` panics because the configured
adapter produces no `build/` directory for `frontendDist`. That is a
pre-existing fault in the desktop build, recorded in `docs/KNOWN_ISSUES.md`,
and it is why the verifiable boundary is drawn at the library.

### What this slice does not do

It issues no execution. The delegation contract is defined so it can be
reviewed; neither `bridge.ts` nor the Rust module exposes an execute surface,
and tests on both sides assert it stays that way.

It does not make the desktop application buildable. The bridge compiles and is
tested, and the command is registered in `generate_handler!`, but the binary
that would carry it cannot be built until the adapter question is settled.

## Forge Yellowjacket support agent

VibeForge points internal agent-workcell planning at the Forge public app support
agent copy of Yellowjacket:

- Remote: `git@github.com:Boswell-Digital-Solutions/forge-yellowjacket.git`
- Local path: `/home/charlie/Forge/apps/public-app-local-support/yellowjacket`
- Support role: governed support-agent run wrapping, permission envelopes,
  receipts, review packets, replay proof, and driver admission for Forge public
  app support workflows.

VibeForge owns the developer cockpit, mission classification, review UX, local
evidence vault, and developer decision receipts. Forge Yellowjacket owns the
support-agent runner/workcell contract surface when an internal planning flow
needs a governed runner. Internal component names stay out of commercial product
UI; use capability-level language such as "support agent runner" or "governed
workcell runner" in user-facing copy.

This integration is not permission for hidden autonomy, canonical writeback, or
agent execution internals inside VibeForge. Any future adapter must preserve the
permission-envelope, candidate-only, review-packet, and receipt boundary.
