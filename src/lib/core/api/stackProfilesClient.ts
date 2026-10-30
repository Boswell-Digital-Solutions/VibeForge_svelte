/**
 * Stack Profiles API Client
 *
 * Client for interacting with the Stack Profiles API.
 * Provides methods for fetching, searching, and recommending stack profiles.
 */

import type {
  StackProfile,
  StackCategory,
  ComplexityLevel,
  ProjectIntent,
} from "../types/stack-profiles";
import { NEUROFORGE_URL } from "./endpoints";

const NEUROFORGE_BASE_URL =
  NEUROFORGE_URL;

// API Response Types
export interface StackListResponse {
  success: boolean;
  data: StackProfile[];
  total: number;
}

export interface StackDetailResponse {
  success: boolean;
  data: StackProfile;
}

export interface StackRecommendationRequest {
  project_intent: ProjectIntent;
  requirements: {
    category?: StackCategory;
    complexity?: ComplexityLevel;
    time_to_market?: string;
    scalability?: string;
    budget?: string;
  };
  preferred_languages?: string[];
  team_size?: string;
}

export interface StackRecommendationResponse {
  success: boolean;
  recommendations: Array<{
    stack: StackProfile;
    match_score: number;
    reasons: string[];
  }>;
  total_evaluated: number;
}

export interface StackComparisonResponse {
  success: boolean;
  data: {
    stack_a: StackProfile;
    stack_b: StackProfile;
    comparison: {
      popularity: {
        winner: string;
        difference: number;
      };
      complexity: {
        stack_a: string;
        stack_b: string;
      };
      maturity: {
        stack_a: string;
        stack_b: string;
      };
      community_size: {
        stack_a: string;
        stack_b: string;
      };
    };
  };
}

export interface StackCategoriesResponse {
  success: boolean;
  data: Record<string, number>;
}

/**
 * List all stack profiles with optional filtering
 */
export async function listStacks(params?: {
  category?: StackCategory;
  complexity?: ComplexityLevel;
  search?: string;
  limit?: number;
}): Promise<StackListResponse> {
  const searchParams = new URLSearchParams();

  if (params?.category) searchParams.append("category", params.category);
  if (params?.complexity) searchParams.append("complexity", params.complexity);
  if (params?.search) searchParams.append("search", params.search);
  if (params?.limit) searchParams.append("limit", params.limit.toString());

  const url = `${NEUROFORGE_BASE_URL}/api/v1/stacks${searchParams.toString() ? "?" + searchParams : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch stack profiles: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the most popular stack profiles
 */
export async function getPopularStacks(
  limit: number = 5
): Promise<StackListResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/stacks/popular?limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch popular stacks: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all available categories with counts
 */
export async function getCategories(): Promise<StackCategoriesResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/stacks/categories`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get detailed information about a specific stack
 */
export async function getStack(stackId: string): Promise<StackDetailResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/stacks/${stackId}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Stack profile '${stackId}' not found`);
    }
    throw new Error(`Failed to fetch stack: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get personalized stack recommendations
 */
export async function recommendStacks(
  request: StackRecommendationRequest
): Promise<StackRecommendationResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/stacks/recommend`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get recommendations: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get alternative stacks for a given stack
 */
export async function getAlternatives(
  stackId: string
): Promise<StackListResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/stacks/${stackId}/alternatives`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Stack profile '${stackId}' not found`);
    }
    throw new Error(`Failed to fetch alternatives: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Compare two stack profiles side-by-side
 */
export async function compareStacks(
  stackIdA: string,
  stackIdB: string
): Promise<StackComparisonResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/stacks/${stackIdA}/compare/${stackIdB}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("One or both stack profiles not found");
    }
    throw new Error(`Failed to compare stacks: ${response.statusText}`);
  }

  return response.json();
}
