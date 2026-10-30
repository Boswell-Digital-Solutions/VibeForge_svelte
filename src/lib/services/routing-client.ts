/**
 * Intelligent Model Routing API Client - Phase 4.3
 * Service layer for model routing and cost optimization API
 */

import type {
  ClassifyRequest,
  ClassifyResponse,
  RouteRequest,
  RouteResponse,
  RecordCostRequest,
  RecordCostResponse,
  CostStatsResponse,
  SavingsResponse,
  TimeSeriesResponse,
  StrategyUpdateRequest,
  StrategyUpdateResponse,
  ModelsListResponse,
  RoutingStatusResponse,
} from '$lib/types/routing';
import { NEUROFORGE_URL } from '$lib/core/api/endpoints';

const API_BASE_URL = NEUROFORGE_URL;
const ROUTING_BASE = `${API_BASE_URL}/api/v1/routing`;

// ============================================================================
// Helper Functions
// ============================================================================

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: 'Unknown error',
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(errorData.detail || errorData.error || 'API request failed');
  }
  return response.json();
}

// ============================================================================
// Task Classification
// ============================================================================

export async function classifyTask(request: ClassifyRequest): Promise<ClassifyResponse> {
  const response = await fetch(`${ROUTING_BASE}/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<ClassifyResponse>(response);
}

// ============================================================================
// Model Routing
// ============================================================================

export async function routeToModel(request: RouteRequest): Promise<RouteResponse> {
  const response = await fetch(`${ROUTING_BASE}/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<RouteResponse>(response);
}

// ============================================================================
// Cost Tracking
// ============================================================================

export async function recordCost(request: RecordCostRequest): Promise<RecordCostResponse> {
  const response = await fetch(`${ROUTING_BASE}/record-cost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<RecordCostResponse>(response);
}

export async function getRoutingStats(): Promise<CostStatsResponse> {
  const response = await fetch(`${ROUTING_BASE}/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<CostStatsResponse>(response);
}

export async function getSavings(baselineModel: string = 'claude-opus-3'): Promise<SavingsResponse> {
  const response = await fetch(`${ROUTING_BASE}/savings?baseline_model=${encodeURIComponent(baselineModel)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<SavingsResponse>(response);
}

export async function getTimeSeries(
  hours: number = 24,
  intervalMinutes: number = 60
): Promise<TimeSeriesResponse> {
  const response = await fetch(
    `${ROUTING_BASE}/time-series?hours=${hours}&interval_minutes=${intervalMinutes}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse<TimeSeriesResponse>(response);
}

// ============================================================================
// Strategy Management
// ============================================================================

export async function updateStrategy(request: StrategyUpdateRequest): Promise<StrategyUpdateResponse> {
  const response = await fetch(`${ROUTING_BASE}/strategy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<StrategyUpdateResponse>(response);
}

export async function getRoutingStatus(): Promise<RoutingStatusResponse> {
  const response = await fetch(`${ROUTING_BASE}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<RoutingStatusResponse>(response);
}

// ============================================================================
// Models Management
// ============================================================================

export async function getAvailableModels(): Promise<ModelsListResponse> {
  const response = await fetch(`${ROUTING_BASE}/models`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<ModelsListResponse>(response);
}

// ============================================================================
// Admin Operations
// ============================================================================

export async function resetStats(): Promise<{ success: boolean; message: string; timestamp: string }> {
  const response = await fetch(`${ROUTING_BASE}/reset-stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<{ success: boolean; message: string; timestamp: string }>(response);
}
