/**
 * Mapping between the DataForge API `Run` shape and the domain `PromptRun`.
 *
 * The two describe the same concept with different field names, and the sync
 * layer speaks the API shape while the stores speak the domain shape. Without
 * an explicit mapping the boundary silently failed to typecheck.
 */

import type { Run } from '$lib/core/api/dataforgeClient.enhanced';
import type { PromptRun, RunStatus } from '$lib/core/types';

/**
 * The API narrows status to four states; the domain carries three more aliases.
 *
 * `toDomainStatus` is the inverse, so a run survives a save and a reload with
 * the spelling the stores match on. Without it a run created as `success`
 * persisted as `completed` and came back as `completed`, which the status bar
 * and the history panel filter do not match.
 *
 * One direction is lossy and cannot be otherwise: `error` and `cancelled` both
 * narrow to `failed`, so a reloaded run reads as `error`. The distinction is
 * lost at the API boundary, not here.
 */
function toDomainStatus(status: Run['status']): RunStatus {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return status;
  }
}

function toApiStatus(status: RunStatus): Run['status'] {
  switch (status) {
    case 'success':
      return 'completed';
    case 'error':
    case 'cancelled':
      return 'failed';
    default:
      return status;
  }
}

/** Convert an API run into the domain shape the stores render. */
export function toPromptRun(run: Run): PromptRun {
  return {
    id: run.id,
    workspaceId: run.workspaceId,
    promptSnapshot: run.promptText,
    contextBlockIds: run.contextBlockIds,
    modelId: run.model,
    status: toDomainStatus(run.status),
    startedAt: run.createdAt,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    durationMs: run.latencyMs,
    totalTokens: run.tokensUsed,
    cost: run.cost,
    output: run.output,
    error: run.error,
    // `provider` has no domain field; keep it so a round trip does not lose it.
    metadata: { provider: run.provider }
  };
}

/** Convert a domain run into the API shape the sync layer persists. */
export function toApiRun(run: PromptRun): Run {
  const provider = run.metadata?.provider;

  return {
    id: run.id,
    workspaceId: run.workspaceId,
    promptText: run.promptSnapshot,
    contextBlockIds: run.contextBlockIds,
    model: run.modelId,
    provider: typeof provider === 'string' ? provider : '',
    output: run.output ?? '',
    tokensUsed:
      run.totalTokens ?? (run.inputTokens ?? 0) + (run.outputTokens ?? 0),
    cost: run.cost ?? 0,
    latencyMs: run.durationMs ?? 0,
    status: toApiStatus(run.status),
    error: run.error,
    createdAt: run.createdAt ?? run.startedAt,
    completedAt: run.completedAt
  };
}
