/**
 * VibeForge V2 - Prompt Management API Client
 *
 * Handles communication with NeuroForge prompt CRUD endpoints
 */

import type { ApiResponse } from "$lib/core/types";
import { getAuthHeader } from "$lib/auth";

const NEUROFORGE_BASE_URL =
  import.meta.env.VITE_NEUROFORGE_URL || "http://localhost:8000";

export interface Prompt {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  workspace: string;
  tags: string[];
  basePrompt: string;
  contextRefs: string[];
  models: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PromptCreate {
  name: string;
  description?: string;
  category: string;
  workspace: string;
  tags?: string[];
  basePrompt: string;
  contextRefs?: string[];
  models?: string[];
  pinned?: boolean;
}

export interface PromptUpdate {
  name?: string;
  description?: string;
  category?: string;
  workspace?: string;
  tags?: string[];
  basePrompt?: string;
  contextRefs?: string[];
  models?: string[];
  pinned?: boolean;
}

export interface ListPromptsParams {
  workspace?: string;
  category?: string;
  pinnedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListPromptsResponse {
  prompts: Prompt[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// PROMPT CRUD OPERATIONS
// ============================================================================

export async function createPrompt(
  data: PromptCreate,
  userId: string = "default_user"
): Promise<ApiResponse<Prompt>> {
  try {
    const response = await fetch(
      `${NEUROFORGE_BASE_URL}/api/v1/workbench/prompts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // NeuroForge takes the owner from this verified token, never from x-user-id.
          ...getAuthHeader(),
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: error.detail || "Failed to create prompt",
        },
      };
    }

    const prompt = await response.json();
    return {
      success: true,
      data: prompt,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

export async function listPrompts(
  params: ListPromptsParams = {},
  userId: string = "default_user"
): Promise<ApiResponse<ListPromptsResponse>> {
  try {
    const searchParams = new URLSearchParams();

    if (params.workspace) searchParams.set("workspace", params.workspace);
    if (params.category) searchParams.set("category", params.category);
    if (params.pinnedOnly) searchParams.set("pinned_only", "true");
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize)
      searchParams.set("page_size", params.pageSize.toString());

    const url = `${NEUROFORGE_BASE_URL}/api/v1/workbench/prompts?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: {
          code: "LIST_FAILED",
          message: error.detail || "Failed to list prompts",
        },
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

export async function getPrompt(
  promptId: string,
  userId: string = "default_user"
): Promise<ApiResponse<Prompt>> {
  try {
    const response = await fetch(
      `${NEUROFORGE_BASE_URL}/api/v1/workbench/prompts/${promptId}`,
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Prompt not found",
          },
        };
      }

      const error = await response.json();
      return {
        success: false,
        error: {
          code: "GET_FAILED",
          message: error.detail || "Failed to get prompt",
        },
      };
    }

    const prompt = await response.json();
    return {
      success: true,
      data: prompt,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

export async function updatePrompt(
  promptId: string,
  data: PromptUpdate,
  userId: string = "default_user"
): Promise<ApiResponse<Prompt>> {
  try {
    const response = await fetch(
      `${NEUROFORGE_BASE_URL}/api/v1/workbench/prompts/${promptId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Prompt not found",
          },
        };
      }

      const error = await response.json();
      return {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message: error.detail || "Failed to update prompt",
        },
      };
    }

    const prompt = await response.json();
    return {
      success: true,
      data: prompt,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}

export async function deletePrompt(
  promptId: string,
  userId: string = "default_user"
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(
      `${NEUROFORGE_BASE_URL}/api/v1/workbench/prompts/${promptId}`,
      {
        method: "DELETE",
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Prompt not found",
          },
        };
      }

      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: error.detail || "Failed to delete prompt",
        },
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}
