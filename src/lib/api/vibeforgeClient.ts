/**
 * VibeForge Learning Layer API Client
 *
 * Handles all communication with the DataForge learning layer:
 * - Project tracking
 * - Session management
 * - Outcome logging
 * - Performance metrics
 * - User preferences and analytics
 */

import type {
  VibeForgeProjectCreate,
  VibeForgeProjectUpdate,
  VibeForgeProjectResponse,
  ProjectSessionCreate,
  ProjectSessionUpdate,
  ProjectSessionResponse,
  StackOutcomeCreate,
  StackOutcomeUpdate,
  StackOutcomeResponse,
  ModelPerformanceCreate,
  ModelPerformanceUpdate,
  ModelPerformanceResponse,
  UserPreferenceSummary,
  StackSuccessRate,
  PaginatedResponse,
  ApiError,
} from "$lib/types/learning";
import { DATAFORGE_URL } from "$lib/core/api/endpoints";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE =
  DATAFORGE_URL;
const LEARNING_PATH = "/api/vibeforge";
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
    let errorDetail = response.statusText;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || response.statusText;
    } catch {
      // Keep default errorDetail
    }

    const error: ApiError = {
      detail: errorDetail,
      status_code: response.status,
    };

    throw error;
  }

  return response.json();
}

// ============================================================================
// Project Management
// ============================================================================

export async function createProject(
  project: VibeForgeProjectCreate
): Promise<VibeForgeProjectResponse> {
  const response = await fetch(`${API_BASE}${LEARNING_PATH}/projects`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(project),
  });

  return handleResponse<VibeForgeProjectResponse>(response);
}

export async function getProject(
  projectId: number
): Promise<VibeForgeProjectResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/projects/${projectId}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<VibeForgeProjectResponse>(response);
}

export async function listProjects(params?: {
  skip?: number;
  limit?: number;
  user_id?: number;
}): Promise<VibeForgeProjectResponse[]> {
  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined)
    queryParams.set("skip", params.skip.toString());
  if (params?.limit !== undefined)
    queryParams.set("limit", params.limit.toString());
  if (params?.user_id !== undefined)
    queryParams.set("user_id", params.user_id.toString());

  const url = `${API_BASE}${LEARNING_PATH}/projects?${queryParams}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse<VibeForgeProjectResponse[]>(response);
}

export async function updateProject(
  projectId: number,
  updates: VibeForgeProjectUpdate
): Promise<VibeForgeProjectResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/projects/${projectId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    }
  );

  return handleResponse<VibeForgeProjectResponse>(response);
}

export async function deleteProject(
  projectId: number
): Promise<{ message: string }> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/projects/${projectId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );

  return handleResponse<{ message: string }>(response);
}

// ============================================================================
// Session Management
// ============================================================================

export async function createSession(
  session: ProjectSessionCreate
): Promise<ProjectSessionResponse> {
  const response = await fetch(`${API_BASE}${LEARNING_PATH}/sessions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(session),
  });

  return handleResponse<ProjectSessionResponse>(response);
}

export async function getSession(
  sessionId: number
): Promise<ProjectSessionResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/sessions/${sessionId}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<ProjectSessionResponse>(response);
}

export async function updateSession(
  sessionId: number,
  updates: ProjectSessionUpdate
): Promise<ProjectSessionResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/sessions/${sessionId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    }
  );

  return handleResponse<ProjectSessionResponse>(response);
}

export async function completeSession(
  sessionId: number,
  durationSeconds?: number
): Promise<ProjectSessionResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/sessions/${sessionId}/complete`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ duration_seconds: durationSeconds }),
    }
  );

  return handleResponse<ProjectSessionResponse>(response);
}

export async function abandonSession(
  sessionId: number
): Promise<ProjectSessionResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/sessions/${sessionId}/abandon`,
    {
      method: "POST",
      headers: getHeaders(),
    }
  );

  return handleResponse<ProjectSessionResponse>(response);
}

export async function getProjectSessions(
  projectId: number
): Promise<ProjectSessionResponse[]> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/projects/${projectId}/sessions`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<ProjectSessionResponse[]>(response);
}

// ============================================================================
// Outcome Logging
// ============================================================================

export async function createOutcome(
  outcome: StackOutcomeCreate
): Promise<StackOutcomeResponse> {
  const response = await fetch(`${API_BASE}${LEARNING_PATH}/outcomes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(outcome),
  });

  return handleResponse<StackOutcomeResponse>(response);
}

export async function getOutcome(
  outcomeId: number
): Promise<StackOutcomeResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/outcomes/${outcomeId}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<StackOutcomeResponse>(response);
}

export async function updateOutcome(
  outcomeId: number,
  updates: StackOutcomeUpdate
): Promise<StackOutcomeResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/outcomes/${outcomeId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    }
  );

  return handleResponse<StackOutcomeResponse>(response);
}

// ============================================================================
// Performance Tracking
// ============================================================================

export async function logPerformance(
  performance: ModelPerformanceCreate
): Promise<ModelPerformanceResponse> {
  const response = await fetch(`${API_BASE}${LEARNING_PATH}/performance`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(performance),
  });

  return handleResponse<ModelPerformanceResponse>(response);
}

export async function getPerformance(
  performanceId: number
): Promise<ModelPerformanceResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/performance/${performanceId}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<ModelPerformanceResponse>(response);
}

export async function getSessionPerformance(
  sessionId: number
): Promise<ModelPerformanceResponse[]> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/sessions/${sessionId}/performance`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<ModelPerformanceResponse[]>(response);
}

export async function updatePerformance(
  performanceId: number,
  updates: ModelPerformanceUpdate
): Promise<ModelPerformanceResponse> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/performance/${performanceId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    }
  );

  return handleResponse<ModelPerformanceResponse>(response);
}

// ============================================================================
// Preferences & Analytics
// ============================================================================

export async function getUserPreferences(
  userId: number
): Promise<UserPreferenceSummary> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/preferences/${userId}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<UserPreferenceSummary>(response);
}

export async function getUserFavoriteStacks(
  userId: number,
  limit: number = 5
): Promise<{ stack_id: string; count: number }[]> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/preferences/${userId}/favorites?limit=${limit}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<{ stack_id: string; count: number }[]>(response);
}

export async function getPreferencesSummary(): Promise<UserPreferenceSummary> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/preferences/summary`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<UserPreferenceSummary>(response);
}

// ============================================================================
// Analytics
// ============================================================================

export async function getStackSuccessRates(params?: {
  min_uses?: number;
  project_type?: string;
}): Promise<StackSuccessRate[]> {
  const queryParams = new URLSearchParams();
  if (params?.min_uses !== undefined)
    queryParams.set("min_uses", params.min_uses.toString());
  if (params?.project_type)
    queryParams.set("project_type", params.project_type);

  const url = `${API_BASE}${LEARNING_PATH}/analytics/stack-success?${queryParams}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse<StackSuccessRate[]>(response);
}

export async function getModelAcceptanceRates(params?: {
  provider?: string;
  days?: number;
}): Promise<
  {
    provider: string;
    model_name: string;
    acceptance_rate: number;
    total_uses: number;
  }[]
> {
  const queryParams = new URLSearchParams();
  if (params?.provider) queryParams.set("provider", params.provider);
  if (params?.days !== undefined)
    queryParams.set("days", params.days.toString());

  const url = `${API_BASE}${LEARNING_PATH}/analytics/model-acceptance?${queryParams}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse<
    {
      provider: string;
      model_name: string;
      acceptance_rate: number;
      total_uses: number;
    }[]
  >(response);
}

export async function getAbandonedSessions(
  days: number = 30
): Promise<{
  total_sessions: number;
  abandoned_count: number;
  abandonment_rate: number;
}> {
  const response = await fetch(
    `${API_BASE}${LEARNING_PATH}/analytics/abandoned-sessions?days=${days}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  return handleResponse<{
    total_sessions: number;
    abandoned_count: number;
    abandonment_rate: number;
  }>(response);
}

// ============================================================================
// Time-Series Data (Phase 3.7)
// ============================================================================

export interface TimeSeriesBucket {
  date: string; // ISO date (YYYY-MM-DD)
  count: number;
  successRate: number;
  avgSatisfaction: number;
  avgTestPassRate: number;
}

export interface OutcomesDateRangeFilters {
  patternId?: string;
  stackId?: string;
  userId?: number;
  status?: 'active' | 'archived' | 'deleted';
}

/**
 * Get outcomes aggregated by date range
 */
export async function getOutcomesByDateRange(
  startDate: string,
  endDate: string,
  filters?: OutcomesDateRangeFilters
): Promise<TimeSeriesBucket[]> {
  const queryParams = new URLSearchParams();
  queryParams.set("start_date", startDate);
  queryParams.set("end_date", endDate);

  if (filters?.patternId) queryParams.set("pattern_id", filters.patternId);
  if (filters?.stackId) queryParams.set("stack_id", filters.stackId);
  if (filters?.userId) queryParams.set("user_id", filters.userId.toString());
  if (filters?.status) queryParams.set("status", filters.status);

  const url = `${API_BASE}${LEARNING_PATH}/analytics/outcomes-by-date?${queryParams}`;
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse<TimeSeriesBucket[]>(response);
}

/**
 * Get trend data for a specific pattern
 */
export async function getPatternTrend(
  patternId: string,
  days: number = 30
): Promise<TimeSeriesBucket[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return getOutcomesByDateRange(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0],
    { patternId, status: 'active' }
  );
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkHealth(): Promise<{
  status: string;
  timestamp: string;
}> {
  const response = await fetch(`${API_BASE}${LEARNING_PATH}/health`, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse<{ status: string; timestamp: string }>(response);
}

// ============================================================================
// Offline Fallback (for development/testing)
// ============================================================================

export const learningClient = {
  // Projects
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,

  // Sessions
  createSession,
  getSession,
  updateSession,
  completeSession,
  abandonSession,
  getProjectSessions,

  // Outcomes
  createOutcome,
  getOutcome,
  updateOutcome,

  // Performance
  logPerformance,
  getPerformance,
  getSessionPerformance,
  updatePerformance,

  // Preferences
  getUserPreferences,
  getUserFavoriteStacks,
  getPreferencesSummary,

  // Analytics
  getStackSuccessRates,
  getModelAcceptanceRates,
  getAbandonedSessions,

  // Time-Series (Phase 3.7)
  getOutcomesByDateRange,
  getPatternTrend,

  // Health
  checkHealth,
};

export default learningClient;
