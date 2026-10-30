/**
 * NeuroForge API Client
 *
 * Handles all communication with the NeuroForge model router and LLM engine:
 * - Model discovery and metadata
 * - Prompt execution across multiple models
 * - Feedback and telemetry (Phase 2/3)
 */

import type {
  NeuroForgeModel,
  ListModelsResponse,
  PromptRunRequest,
  PromptRunResponse,
  PromptFeedbackRequest,
  PromptFeedbackResponse,
  NeuroForgeApiError,
} from "$lib/types/neuroforge";
import { getAuthHeader } from "$lib/auth";
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
    ...getAuthHeader(),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: NeuroForgeApiError = new Error(
      `NeuroForge API error: ${response.statusText}`
    ) as NeuroForgeApiError;
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
// Model Discovery API Methods
// ============================================================================

/**
 * List available models for a client (VibeForge)
 * Returns models with metadata for champion/challenger routing
 */
export async function listModels(client?: string): Promise<NeuroForgeModel[]> {
  const url = new URL(`${API_BASE}/models`);

  if (client) {
    url.searchParams.set("client", client);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await handleResponse<ListModelsResponse>(response);
  return data.models;
}

// ============================================================================
// Prompt Execution API Methods
// ============================================================================

/**
 * Execute a prompt across one or more models
 * Called by VibeForge when user clicks "Run via NeuroForge"
 */
export async function runPrompt(
  request: PromptRunRequest
): Promise<PromptRunResponse> {
  const url = new URL(`${API_BASE}/prompt/run`);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  return handleResponse<PromptRunResponse>(response);
}

// ============================================================================
// Feedback API Methods (Phase 2)
// ============================================================================

/**
 * Send feedback on a model response
 * Supports rating, thumbs up/down, tags, and notes
 */
export async function sendFeedback(
  request: PromptFeedbackRequest
): Promise<PromptFeedbackResponse> {
  const url = new URL(`${API_BASE}/prompt/feedback`);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  return handleResponse<PromptFeedbackResponse>(response);
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check for NeuroForge API
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
// Export Configuration
// ============================================================================

export { API_BASE };
