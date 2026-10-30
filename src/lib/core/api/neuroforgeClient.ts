/**
 * VibeForge V2 - NeuroForge Client
 *
 * This client handles communication with NeuroForge (model router).
 * Implements real HTTP calls to NeuroForge API with JWT authentication.
 */

import type { Model, PromptRun, ApiResponse } from "$lib/core/types";
import { getAuthHeader } from "$lib/auth";
import { NEUROFORGE_URL } from "./endpoints";

const NEUROFORGE_BASE_URL =
  NEUROFORGE_URL;
const API_VERSION = "v1";

interface NeuroForgeError {
  detail: string;
}

function getApiUrl(path: string): string {
  return `${NEUROFORGE_BASE_URL}/api/${API_VERSION}${path}`;
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add JWT authentication
  const authHeader = getAuthHeader();
  if (authHeader) {
    Object.assign(headers, authHeader);
  }

  return headers;
}

// ============================================================================
// MODEL OPERATIONS
// ============================================================================

export async function listModels(): Promise<ApiResponse<Model[]>> {
  try {
    const response = await fetch(getApiUrl("/models"), {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error: NeuroForgeError = await response.json();
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: error.detail || "Failed to fetch models",
        },
      };
    }

    const models: Model[] = await response.json();
    return {
      success: true,
      data: models,
    };
  } catch (error) {
    console.error("Failed to list models:", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

export async function getModel(id: string): Promise<ApiResponse<Model>> {
  try {
    const response = await fetch(getApiUrl(`/models/${id}`), {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: {
            code: "MODEL_NOT_FOUND",
            message: `Model with ID ${id} not found`,
          },
        };
      }
      const error: NeuroForgeError = await response.json();
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: error.detail || "Failed to fetch model",
        },
      };
    }

    const model: Model = await response.json();
    return {
      success: true,
      data: model,
    };
  } catch (error) {
    console.error("Failed to get model:", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

// ============================================================================
// PROVIDER STATUS
// ============================================================================

export interface ProviderInfo {
  configured: boolean;
  available: boolean;
  type: "api" | "local";
  url?: string;
}

export interface ProviderStatus {
  openai: ProviderInfo;
  anthropic: ProviderInfo;
  ollama: ProviderInfo;
}

export async function getProviderStatus(): Promise<
  ApiResponse<ProviderStatus>
> {
  try {
    const response = await fetch(getApiUrl("/providers"), {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const error: NeuroForgeError = await response.json();
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: error.detail || "Failed to fetch provider status",
        },
      };
    }

    const status: ProviderStatus = await response.json();
    return {
      success: true,
      data: status,
    };
  } catch (error) {
    console.error("Failed to get provider status:", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

// ============================================================================
// PROMPT EXECUTION
// ============================================================================

export interface ExecutePromptRequest {
  workspaceId: string;
  prompt: string;
  contextBlocks: string[];
  modelIds: string[];
  stream?: boolean;
}

export async function executePrompt(
  request: ExecutePromptRequest
): Promise<ApiResponse<PromptRun[]>> {
  try {
    const response = await fetch(getApiUrl("/execute"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        workspace_id: request.workspaceId,
        prompt: request.prompt,
        context_blocks: request.contextBlocks,
        model_ids: request.modelIds,
        stream: request.stream || false,
      }),
    });

    if (!response.ok) {
      const error: NeuroForgeError = await response.json();
      return {
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: error.detail || "Failed to execute prompt",
        },
      };
    }

    const runs: PromptRun[] = await response.json();
    return {
      success: true,
      data: runs,
    };
  } catch (error) {
    console.error("Failed to execute prompt:", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

// ============================================================================
// SIMPLIFIED EXECUTION (Refactoring Plan Compatible)
// ============================================================================

export interface SimplifiedExecuteRequest {
  prompt: string;
  model_id: string;
  context_blocks?: string[];
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
  workspace_id?: string;
}

export interface SimplifiedExecuteResponse {
  run_id: string;
  model_id: string;
  output: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
  created_at: string;
}

export async function executePromptSimplified(
  request: SimplifiedExecuteRequest
): Promise<SimplifiedExecuteResponse> {
  const response = await fetch(getApiUrl("/workbench/execute"), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: NeuroForgeError = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Execution failed: ${response.status}`);
  }

  return response.json();
}

export async function executeMultiModel(
  prompt: string,
  modelIds: string[],
  options?: Omit<SimplifiedExecuteRequest, "prompt" | "model_id">
): Promise<SimplifiedExecuteResponse[]> {
  const results = await Promise.allSettled(
    modelIds.map((model_id) =>
      executePromptSimplified({ prompt, model_id, ...options })
    )
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<SimplifiedExecuteResponse> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}
