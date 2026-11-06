/**
 * VibeForge - Prompt Version API Client
 *
 * Client for prompt version control operations with NeuroForge backend.
 */

import { neuroforgeConfig } from "./config";
import { getAuthHeader } from "$lib/auth";

// ============================================================================
// Types - matching backend Pydantic models
// ============================================================================

export interface VersionCreate {
  content: string;
  parentVersionId?: string;
  autoSaved?: boolean;
  changeSummary?: string;
}

export interface VersionDiff {
  addedLines: number;
  removedLines: number;
  changedChars: number;
}

export interface Version {
  id: string;
  promptId: string;
  content: string;
  parentVersionId?: string;
  versionNumber: number;
  autoSaved: boolean;
  changeSummary?: string;
  createdAt: string;
  createdBy: string;
  isCurrent: boolean;
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  autoSaved: boolean;
  changeSummary?: string;
  createdAt: string;
  createdBy: string;
  isCurrent: boolean;
  contentPreview: string;
}

export interface ListVersionsResponse {
  versions: VersionSummary[];
  total: number;
  currentVersionId: string;
}

export interface RestoreVersionRequest {
  versionId: string;
}

export interface VersionCompareResponse {
  fromVersion: VersionSummary;
  toVersion: VersionSummary;
  diff: VersionDiff;
  fromContent: string;
  toContent: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// ============================================================================
// API Client
// ============================================================================

class VersionsClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.userId = "default_user"; // TODO: Get from auth context
  }

  /**
   * Create a new version for a prompt
   */
  async createVersion(
    promptId: string,
    versionData: VersionCreate
  ): Promise<ApiResponse<Version>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/prompts/${promptId}/versions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // NeuroForge takes the owner from this verified token, never from x-user-id.
            ...getAuthHeader(),
          },
          body: JSON.stringify(versionData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          error: error || `Failed to create version: ${response.status}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * List all versions for a prompt
   */
  async listVersions(
    promptId: string,
    limit: number = 50
  ): Promise<ApiResponse<ListVersionsResponse>> {
    try {
      const url = new URL(`${this.baseUrl}/prompts/${promptId}/versions`);
      url.searchParams.set("limit", limit.toString());

      const response = await fetch(url.toString(), {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          error: error || `Failed to list versions: ${response.status}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(
    promptId: string,
    versionId: string
  ): Promise<ApiResponse<Version>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/prompts/${promptId}/versions/${versionId}`,
        {
          headers: {
            ...getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { error: error || `Failed to get version: ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Restore a specific version as current
   */
  async restoreVersion(
    promptId: string,
    versionId: string
  ): Promise<ApiResponse<Version>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/prompts/${promptId}/versions/restore`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ versionId }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          error: error || `Failed to restore version: ${response.status}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    promptId: string,
    fromVersionId: string,
    toVersionId: string
  ): Promise<ApiResponse<VersionCompareResponse>> {
    try {
      const url = new URL(
        `${this.baseUrl}/prompts/${promptId}/versions/compare`
      );
      url.searchParams.set("from_version", fromVersionId);
      url.searchParams.set("to_version", toVersionId);

      const response = await fetch(url.toString(), {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          error: error || `Failed to compare versions: ${response.status}`,
        };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const versionsClient = new VersionsClient(neuroforgeConfig.baseUrl);
