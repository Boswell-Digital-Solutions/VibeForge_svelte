/**
 * Languages API Client
 *
 * Client for interacting with the Languages API.
 * Provides methods for fetching language definitions and compatibility info.
 */

import type { Language, LanguageCategory } from "$lib/data/languages";
import { NEUROFORGE_URL } from "./endpoints";

const NEUROFORGE_BASE_URL =
  NEUROFORGE_URL;

// API Response Types
export interface LanguageListResponse {
  success: boolean;
  data: Language[];
  total: number;
}

export interface LanguageDetailResponse {
  success: boolean;
  data: Language;
}

export interface LanguageCategoriesResponse {
  success: boolean;
  data: Record<string, number>;
}

export interface LanguageFilterRequest {
  languages: string[];
  require_all?: boolean;
}

export interface LanguageFilterResponse {
  success: boolean;
  languages: string[];
  compatible_stacks: string[];
  total: number;
}

export interface LanguageRecommendationRequest {
  project_type: string;
  requirements?: Record<string, any>;
}

export interface LanguageRecommendationResponse {
  success: boolean;
  recommended: Language[];
  reasoning: string;
}

/**
 * List all programming languages with optional filtering
 */
export async function listLanguages(params?: {
  category?: LanguageCategory;
}): Promise<LanguageListResponse> {
  const searchParams = new URLSearchParams();

  if (params?.category) searchParams.append("category", params.category);

  const url = `${NEUROFORGE_BASE_URL}/api/v1/languages${searchParams.toString() ? "?" + searchParams : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch languages: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all available categories with counts
 */
export async function getLanguageCategories(): Promise<LanguageCategoriesResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/languages/categories`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get detailed information about a specific language
 */
export async function getLanguage(
  languageId: string
): Promise<LanguageDetailResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/languages/${languageId}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Language '${languageId}' not found`);
    }
    throw new Error(`Failed to fetch language: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Filter stacks by selected languages
 */
export async function filterStacksByLanguages(
  request: LanguageFilterRequest
): Promise<LanguageFilterResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/languages/filter-stacks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to filter stacks: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get language recommendations for a project type
 */
export async function recommendLanguages(
  request: LanguageRecommendationRequest
): Promise<LanguageRecommendationResponse> {
  const response = await fetch(
    `${NEUROFORGE_BASE_URL}/api/v1/languages/recommend`,
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
