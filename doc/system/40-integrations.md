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

The MCP endpoints are also derived. NeuroForge answers at `NEUROFORGE_URL` plus
`/mcp` and DataForge at `DATAFORGE_URL` plus `/mcp`.

Defaults follow the port map in the Forge port registry, which NeuroForge's own
`.env.example` states: 8000 for NeuroForge, 8001 for DataForge, 8002 for Rake.
NeuroForge serves `/api/v1/auth/login/json`, so authentication uses
`NEUROFORGE_URL`.

### What stays open

The license default targets port 8002, which the registry assigns to Rake. No
service in the ecosystem implements `/license/validate`. The value is preserved
rather than corrected, because which service owns license validation is an open
question. See `docs/KNOWN_ISSUES.md`.

No DataForge route answers `/ws` today, so a sync connection is refused.

The application holds no reference to NeuronForge, so there is no local
inference lane to configure. See `docs/KNOWN_ISSUES.md`.

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
