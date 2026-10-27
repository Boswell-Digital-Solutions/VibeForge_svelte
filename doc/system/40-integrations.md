# Integrations

**Document version:** 1.0 (bootstrap scaffold)

External integrations, upstream services, and wire contracts.

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

## NeuroForge workbench

VibeForge signs in against NeuroForge (`POST /api/v1/auth/login/json`, `src/lib/auth.ts`)
and keeps the returned JWT. `getAuthHeader()` sends it as `Authorization: Bearer`.

| Client | NeuroForge routes | Credential |
| --- | --- | --- |
| `src/lib/core/api/promptsClient.ts` | `/api/v1/workbench/prompts` | the login token (2026-10-27) |
| `src/lib/core/api/versionsClient.ts` | `/api/v1/workbench/prompts/{id}/versions` | the login token (2026-10-27) |
| `src/lib/core/api/neuroforgeClient.ts` | `/api/v1/workbench/execute`, model lists | the login token |
| `src/lib/core/api/estimationClient.ts` | `/api/v1/estimate` | none; the route is open |

NeuroForge takes a prompt's owner from the verified token and ignores an `x-user-id` header
(NeuroForge `NF-WORKBENCH-USER-IDENTITY-20261027`). The token must carry the `neuroforge:use`
scope. Without a token, these calls get 401. `deploymentClient.ts` and `chainClient.ts` call
NeuroForge routes that are not mounted, so they get 404.
