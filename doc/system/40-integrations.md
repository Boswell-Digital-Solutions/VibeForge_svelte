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
with the specific refusal, `unreachable`, and `bridge_absent`. There is no
state meaning "probably fine", and no cloud fallback: an unavailable local lane
is a reported state, never a silent escalation.

### What this slice does not do

It issues no execution. The delegation contract is defined so it can be
reviewed; `bridge.ts` exposes no execute surface, and a test asserts it stays
that way.

It adds no transport. The Rust side of the bridge is a later slice, for a
stated reason: no workflow in this repository builds or tests Rust, so a
component holding a capability would ship unverified. See
`docs/KNOWN_ISSUES.md`.

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
