/**
 * DataForge API Client
 *
 * Handles all communication with the DataForge knowledge engine:
 * - Context library management
 * - Semantic search
 * - Run history logging and retrieval
 */

import type {
  DataForgeContext,
  DataForgeContextChunk,
  DataForgeContextSearchResult,
  DataForgeRun,
  SearchContextsRequest,
  SearchContextsResponse,
  ListContextsResponse,
  LogRunRequest,
  LogRunResponse,
  ListRunsResponse,
  DataForgeApiError,
} from "$lib/types/dataforge";
import { DATAFORGE_API_V1 } from "$lib/core/api/endpoints";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE =
  DATAFORGE_API_V1;
const API_KEY = import.meta.env.VITE_VIBEFORGE_API_KEY || "vf-dev-key";

// ============================================================================
// Utility Functions
// ============================================================================

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: DataForgeApiError = new Error(
      `DataForge API error: ${response.statusText}`
    ) as DataForgeApiError;
    error.status = response.status;

    try {
      const errorData = await response.json();
      error.code = errorData.code || "UNKNOWN_ERROR";
      error.message = errorData.message || error.message;
    } catch {
      error.code = "PARSE_ERROR";
    }

    throw error;
  }

  return response.json();
}

// ============================================================================
// Context API Methods
// ============================================================================

/**
 * List all context sources for a workspace
 */
export async function listContexts(
  workspaceId: string
): Promise<DataForgeContext[]> {
  const url = new URL(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/contexts`
  );
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse<ListContextsResponse>(response);
  return data.contexts;
}

/**
 * Perform semantic search over context library
 * Debouncing should be handled by the caller
 */
export async function searchContexts(
  workspaceId: string,
  request: SearchContextsRequest
): Promise<DataForgeContextSearchResult[]> {
  const url = new URL(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/contexts/search`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  const data = await handleResponse<SearchContextsResponse>(response);
  return data.results;
}

/**
 * Get a specific context chunk by ID
 */
export async function getContextChunk(
  contextId: string,
  chunkId: string
): Promise<DataForgeContextChunk> {
  const url = new URL(
    `${API_BASE}/contexts/${encodeURIComponent(
      contextId
    )}/chunks/${encodeURIComponent(chunkId)}`
  );

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse<{ chunk: DataForgeContextChunk }>(response);
  return data.chunk;
}

// ============================================================================
// Run Logging API Methods
// ============================================================================

/**
 * Log a prompt run with all context and outputs
 * Called after NeuroForge execution completes
 */
export async function logRun(request: LogRunRequest): Promise<string> {
  const url = new URL(`${API_BASE}/runs`);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  const data = await handleResponse<LogRunResponse>(response);
  return data.run_id;
}

/**
 * Retrieve run history for a workspace
 * Supports filtering by model, limit/offset pagination
 */
export async function listRuns(
  workspaceId: string,
  options?: {
    limit?: number;
    offset?: number;
    model?: string;
  }
): Promise<{ runs: DataForgeRun[]; total: number }> {
  const url = new URL(
    `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/runs`
  );

  if (options?.limit !== undefined) {
    url.searchParams.set("limit", options.limit.toString());
  }
  if (options?.offset !== undefined) {
    url.searchParams.set("offset", options.offset.toString());
  }
  if (options?.model) {
    url.searchParams.set("model", options.model);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse<ListRunsResponse>(response);
  return {
    runs: data.runs,
    total: data.total,
  };
}

/**
 * Health check for DataForge API
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const url = new URL(`${API_BASE}/health`);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Export API Key for configuration verification
// ============================================================================

export { API_BASE, API_KEY };
