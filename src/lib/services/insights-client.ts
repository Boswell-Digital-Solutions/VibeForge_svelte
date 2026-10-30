/**
 * Insights API Client - Phase 4.5
 * Service layer for insights API endpoints.
 */

import type {
  TechnologyUsage,
  StackCombination,
  PatternInsight,
  TrendData,
  InsightsStatistics,
  TrendStatistics,
  AnalyzeProjectRequest,
  AnalyzeProjectResponse,
  CompareTrendsRequest,
  CompareTrendsResponse,
  InsightsStatusResponse,
  PatternCategory,
  TrendType,
} from '$lib/types/insights';
import { NEUROFORGE_URL } from '$lib/core/api/endpoints';

// API base URL
const API_BASE_URL = NEUROFORGE_URL;

// ============================================================================
// Error Handling
// ============================================================================

class InsightsAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'InsightsAPIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = errorText;
    }
    throw new InsightsAPIError(
      `API request failed: ${response.statusText}`,
      response.status,
      errorDetails
    );
  }

  return response.json();
}

// ============================================================================
// Pattern Analysis Endpoints
// ============================================================================

/**
 * Analyze a project and update insights
 */
export async function analyzeProject(
  request: AnalyzeProjectRequest
): Promise<AnalyzeProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/insights/analyze-project`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<AnalyzeProjectResponse>(response);
}

/**
 * Get top technologies by usage
 */
export async function getTopTechnologies(params?: {
  category?: PatternCategory;
  limit?: number;
}): Promise<TechnologyUsage[]> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/technologies?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<TechnologyUsage[]>(response);
}

/**
 * Get trending technologies
 */
export async function getTrendingTechnologies(params?: {
  limit?: number;
}): Promise<TechnologyUsage[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/trending-technologies?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<TechnologyUsage[]>(response);
}

/**
 * Get popular stack combinations
 */
export async function getPopularCombinations(params?: {
  min_usage?: number;
  limit?: number;
}): Promise<StackCombination[]> {
  const searchParams = new URLSearchParams();
  if (params?.min_usage) searchParams.set('min_usage', params.min_usage.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/stack-combinations?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<StackCombination[]>(response);
}

/**
 * Get pattern recommendations
 */
export async function getPatternRecommendations(params?: {
  use_case?: string;
  limit?: number;
}): Promise<PatternInsight[]> {
  const searchParams = new URLSearchParams();
  if (params?.use_case) searchParams.set('use_case', params.use_case);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/pattern-recommendations?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<PatternInsight[]>(response);
}

/**
 * Get overall insights statistics
 */
export async function getInsightsStatistics(): Promise<InsightsStatistics> {
  const response = await fetch(`${API_BASE_URL}/api/v1/insights/statistics`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<InsightsStatistics>(response);
}

// ============================================================================
// Trend Analysis Endpoints
// ============================================================================

/**
 * Get trend data for a specific entity
 */
export async function getEntityTrend(
  entityName: string,
  lookbackDays: number = 90
): Promise<TrendData> {
  const searchParams = new URLSearchParams();
  searchParams.set('lookback_days', lookbackDays.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/trends/${encodeURIComponent(entityName)}?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<TrendData>(response);
}

/**
 * Get top entities by trend type
 */
export async function getTopTrending(params: {
  trend_type: TrendType;
  limit?: number;
  lookback_days?: number;
}): Promise<TrendData[]> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.lookback_days) searchParams.set('lookback_days', params.lookback_days.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/trends/top/${params.trend_type}?${searchParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<TrendData[]>(response);
}

/**
 * Get all trend data
 */
export async function getAllTrends(lookbackDays: number = 90): Promise<TrendData[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('lookback_days', lookbackDays.toString());

  const response = await fetch(`${API_BASE_URL}/api/v1/insights/trends?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<TrendData[]>(response);
}

/**
 * Compare trends for multiple entities
 */
export async function compareTrends(
  request: CompareTrendsRequest
): Promise<CompareTrendsResponse> {
  const searchParams = new URLSearchParams();
  if (request.lookback_days) {
    searchParams.set('lookback_days', request.lookback_days.toString());
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/insights/trends/compare?${searchParams}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.entity_names),
    }
  );

  return handleResponse<CompareTrendsResponse>(response);
}

/**
 * Get trend statistics
 */
export async function getTrendStatistics(): Promise<{ success: boolean; statistics: TrendStatistics }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/insights/trends/statistics`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<{ success: boolean; statistics: TrendStatistics }>(response);
}

// ============================================================================
// System Status
// ============================================================================

/**
 * Get insights system status
 */
export async function getInsightsStatus(): Promise<InsightsStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/insights/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<InsightsStatusResponse>(response);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if insights API is available
 */
export async function checkInsightsAvailability(): Promise<boolean> {
  try {
    const status = await getInsightsStatus();
    return status.pattern_analyzer_initialized && status.trend_calculator_initialized;
  } catch {
    return false;
  }
}

/**
 * Get insights health status
 */
export async function getInsightsHealth(): Promise<{
  available: boolean;
  status?: InsightsStatusResponse;
  error?: string;
}> {
  try {
    const status = await getInsightsStatus();
    const available = status.pattern_analyzer_initialized && status.trend_calculator_initialized;
    return { available, status };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
