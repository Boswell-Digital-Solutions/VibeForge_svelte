/**
 * VibeForge V2 - Enhanced DataForge Client (VF-300)
 *
 * Complete CRUD client for DataForge with:
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Batch operations
 * - Real HTTP calls (no mocks)
 * - Comprehensive error handling
 *
 * Phase 3 - Track A: Backend Persistence
 */

import type {
  ContextBlock,
  Workspace,
  WorkspaceSettings,
  ApiResponse,
  PaginatedResponse,
} from "$lib/core/types";
import { DATAFORGE_URL } from "./endpoints";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATAFORGE_BASE_URL =
  DATAFORGE_URL;
const API_VERSION = "v1";
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// ============================================================================
// TYPES
// ============================================================================

export interface Run {
  id: string;
  workspaceId: string;
  promptText: string;
  contextBlockIds: string[];
  model: string;
  provider: string;
  output: string;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PromptTemplate {
  id: string;
  workspaceId?: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: string;
  tags: string[];
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  headers?: HeadersInit;
}

export interface BatchOperation<T> {
  operation: 'create' | 'update' | 'delete';
  id?: string;
  data?: T;
}

export interface BatchResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ============================================================================
// HTTP CLIENT WITH RETRY LOGIC
// ============================================================================

class DataForgeHttpClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(baseUrl: string, options: HttpClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.retries || MAX_RETRIES;
  }

  private getApiUrl(path: string): string {
    return `${this.baseUrl}/api/${API_VERSION}${path}`;
  }

  private getHeaders(customHeaders?: HeadersInit): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Merge custom headers
    if (customHeaders) {
      if (customHeaders instanceof Headers) {
        customHeaders.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(customHeaders)) {
        customHeaders.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, customHeaders);
      }
    }

    // Add auth token if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('vibeforge:auth:token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldRetry(statusCode: number): boolean {
    // Retry on 5xx errors and 429 (rate limit)
    return statusCode >= 500 || statusCode === 429;
  }

  private getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return RETRY_DELAY_BASE * Math.pow(2, attempt);
  }

  async request<T>(
    path: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.getApiUrl(path), {
        ...options,
        headers: this.getHeaders(options.headers),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        // Check if we should retry
        if (this.shouldRetry(response.status) && retryCount < this.maxRetries) {
          const delay = this.getRetryDelay(retryCount);
          console.warn(`Request failed with ${response.status}, retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.request<T>(path, options, retryCount + 1);
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
      }

      // Parse JSON response
      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      // Handle network errors
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        if (retryCount < this.maxRetries) {
          const delay = this.getRetryDelay(retryCount);
          console.warn(`Network error, retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.request<T>(path, options, retryCount + 1);
        }
        throw new Error('Network error - DataForge server may be offline');
      }

      throw error;
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

// Singleton instance
const httpClient = new DataForgeHttpClient(DATAFORGE_BASE_URL);

// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  contextIds?: string[];
  modelIds?: string[];
  settings?: WorkspaceSettings;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return httpClient.get<Workspace[]>('/workspaces');
}

export async function getWorkspace(id: string): Promise<Workspace> {
  return httpClient.get<Workspace>(`/workspaces/${id}`);
}

export async function createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace> {
  return httpClient.post<Workspace>('/workspaces', data);
}

export async function updateWorkspace(
  id: string,
  data: Partial<CreateWorkspaceRequest>
): Promise<Workspace> {
  return httpClient.patch<Workspace>(`/workspaces/${id}`, data);
}

export async function deleteWorkspace(id: string): Promise<void> {
  return httpClient.delete<void>(`/workspaces/${id}`);
}

// ============================================================================
// CONTEXT BLOCK OPERATIONS
// ============================================================================

export async function listContextBlocks(
  workspaceId?: string,
  page = 1,
  pageSize = 50
): Promise<ApiResponse<PaginatedResponse<ContextBlock>>> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(workspaceId && { workspaceId }),
    });

    const data = await httpClient.get<PaginatedResponse<ContextBlock>>(
      `/context-blocks?${params}`
    );

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

export async function getContextBlock(id: string): Promise<ApiResponse<ContextBlock>> {
  try {
    const data = await httpClient.get<ContextBlock>(`/context-blocks/${id}`);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error instanceof Error ? error.message : 'Context block not found',
      },
    };
  }
}

export async function createContextBlock(
  block: Omit<ContextBlock, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApiResponse<ContextBlock>> {
  try {
    const data = await httpClient.post<ContextBlock>('/context-blocks', block);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create context block',
      },
    };
  }
}

export async function updateContextBlock(
  id: string,
  updates: Partial<ContextBlock>
): Promise<ApiResponse<ContextBlock>> {
  try {
    const data = await httpClient.patch<ContextBlock>(`/context-blocks/${id}`, updates);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update context block',
      },
    };
  }
}

export async function deleteContextBlock(id: string): Promise<ApiResponse<void>> {
  try {
    await httpClient.delete<void>(`/context-blocks/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete context block',
      },
    };
  }
}

export interface SearchContextRequest {
  query: string;
  workspaceId?: string;
  kinds?: string[];
  tags?: string[];
  limit?: number;
}

export async function searchContextBlocks(
  request: SearchContextRequest
): Promise<ApiResponse<ContextBlock[]>> {
  try {
    const data = await httpClient.post<ContextBlock[]>('/context-blocks/search', request);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Search failed',
      },
    };
  }
}

// ============================================================================
// RUN OPERATIONS (NEW for VF-300)
// ============================================================================

export async function listRuns(
  workspaceId?: string,
  page = 1,
  pageSize = 100
): Promise<ApiResponse<PaginatedResponse<Run>>> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(workspaceId && { workspaceId }),
    });

    const data = await httpClient.get<PaginatedResponse<Run>>(`/runs?${params}`);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch runs',
      },
    };
  }
}

export async function getRun(id: string): Promise<ApiResponse<Run>> {
  try {
    const data = await httpClient.get<Run>(`/runs/${id}`);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error instanceof Error ? error.message : 'Run not found',
      },
    };
  }
}

export interface CreateRunRequest {
  workspaceId: string;
  promptText: string;
  contextBlockIds: string[];
  model: string;
  provider: string;
}

export async function createRun(data: CreateRunRequest): Promise<ApiResponse<Run>> {
  try {
    const run = await httpClient.post<Run>('/runs', data);
    return { success: true, data: run };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create run',
      },
    };
  }
}

export async function updateRun(
  id: string,
  updates: Partial<Run>
): Promise<ApiResponse<Run>> {
  try {
    const data = await httpClient.patch<Run>(`/runs/${id}`, updates);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update run',
      },
    };
  }
}

export async function deleteRun(id: string): Promise<ApiResponse<void>> {
  try {
    await httpClient.delete<void>(`/runs/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete run',
      },
    };
  }
}

export interface SearchRunsRequest {
  workspaceId?: string;
  model?: string;
  provider?: string;
  status?: Run['status'];
  minCost?: number;
  maxCost?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export async function searchRuns(
  request: SearchRunsRequest
): Promise<ApiResponse<Run[]>> {
  try {
    const data = await httpClient.post<Run[]>('/runs/search', request);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Search failed',
      },
    };
  }
}

// ============================================================================
// PROMPT TEMPLATE OPERATIONS (NEW for VF-300)
// ============================================================================

export async function listPromptTemplates(
  workspaceId?: string,
  page = 1,
  pageSize = 50
): Promise<ApiResponse<PaginatedResponse<PromptTemplate>>> {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      ...(workspaceId && { workspaceId }),
    });

    const data = await httpClient.get<PaginatedResponse<PromptTemplate>>(
      `/prompts?${params}`
    );
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch prompts',
      },
    };
  }
}

export async function getPromptTemplate(id: string): Promise<ApiResponse<PromptTemplate>> {
  try {
    const data = await httpClient.get<PromptTemplate>(`/prompts/${id}`);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error instanceof Error ? error.message : 'Prompt template not found',
      },
    };
  }
}

export interface CreatePromptTemplateRequest {
  workspaceId?: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: string;
  tags: string[];
  isPublic: boolean;
}

export async function createPromptTemplate(
  data: CreatePromptTemplateRequest
): Promise<ApiResponse<PromptTemplate>> {
  try {
    const prompt = await httpClient.post<PromptTemplate>('/prompts', data);
    return { success: true, data: prompt };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create prompt template',
      },
    };
  }
}

export async function updatePromptTemplate(
  id: string,
  updates: Partial<PromptTemplate>
): Promise<ApiResponse<PromptTemplate>> {
  try {
    const data = await httpClient.patch<PromptTemplate>(`/prompts/${id}`, updates);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update prompt template',
      },
    };
  }
}

export async function deletePromptTemplate(id: string): Promise<ApiResponse<void>> {
  try {
    await httpClient.delete<void>(`/prompts/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete prompt template',
      },
    };
  }
}

// ============================================================================
// BATCH OPERATIONS (NEW for VF-300)
// ============================================================================

export async function batchUpdateContextBlocks(
  operations: BatchOperation<Partial<ContextBlock>>[]
): Promise<BatchResult<ContextBlock>[]> {
  try {
    const results = await httpClient.post<BatchResult<ContextBlock>[]>(
      '/context-blocks/batch',
      { operations }
    );
    return results;
  } catch (error) {
    // Return error for all operations
    return operations.map(() => ({
      success: false,
      error: {
        code: 'BATCH_FAILED',
        message: error instanceof Error ? error.message : 'Batch operation failed',
      },
    }));
  }
}

export async function batchUpdateRuns(
  operations: BatchOperation<Partial<Run>>[]
): Promise<BatchResult<Run>[]> {
  try {
    const results = await httpClient.post<BatchResult<Run>[]>('/runs/batch', {
      operations,
    });
    return results;
  } catch (error) {
    return operations.map(() => ({
      success: false,
      error: {
        code: 'BATCH_FAILED',
        message: error instanceof Error ? error.message : 'Batch operation failed',
      },
    }));
  }
}

export async function batchUpdatePromptTemplates(
  operations: BatchOperation<Partial<PromptTemplate>>[]
): Promise<BatchResult<PromptTemplate>[]> {
  try {
    const results = await httpClient.post<BatchResult<PromptTemplate>[]>(
      '/prompts/batch',
      { operations }
    );
    return results;
  } catch (error) {
    return operations.map(() => ({
      success: false,
      error: {
        code: 'BATCH_FAILED',
        message: error instanceof Error ? error.message : 'Batch operation failed',
      },
    }));
  }
}

// ============================================================================
// EXPORT API CLIENT (for advanced use)
// ============================================================================

export { DataForgeHttpClient };
export const client = httpClient;
