/**
 * Research API Client
 *
 * Handles communication with NeuroForge /research/query endpoint.
 */

import type {
  ResearchQuery,
  ResearchAnswer,
  ResearchError,
  ExternalSource,
} from "$lib/types/research";
import { NEUROFORGE_API_V1 } from "$lib/core/api/endpoints";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE =
  NEUROFORGE_API_V1;

// ============================================================================
// Utility Functions
// ============================================================================

function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ResearchError = {
      error: `Research API error: ${response.statusText}`,
      code: `HTTP_${response.status}`,
    };

    try {
      const errorData = await response.json();
      error.error = errorData.detail || error.error;
      error.code = errorData.code || error.code;
    } catch {
      // Ignore parse errors
    }

    throw error;
  }

  try {
    return await response.json();
  } catch (err) {
    throw {
      error: "Failed to parse response",
      code: "PARSE_ERROR",
    } as ResearchError;
  }
}

// ============================================================================
// API Methods
// ============================================================================

export async function queryResearch(
  payload: ResearchQuery
): Promise<ResearchAnswer> {
  const response = await fetch(`${API_BASE}/research/query`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<ResearchAnswer>(response);
}

export async function getResearchHealth(): Promise<{
  status: string;
  dataforge: string;
  sources: ExternalSource[];
  timestamp: string;
}> {
  const response = await fetch(`${API_BASE}/research/health`, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse(response);
}

export async function listResearchSources(): Promise<{
  total: number;
  sources: Array<{
    id: ExternalSource;
    name: string;
    description: string;
    tier: string;
    availability: string;
  }>;
}> {
  const response = await fetch(`${API_BASE}/research/sources`, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse(response);
}
