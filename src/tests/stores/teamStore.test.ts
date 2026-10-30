/**
 * Team Store Tests
 * Tests for Svelte 5 rune-based team store
 * Phase 4.1: Team & Organization Learning
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { teamStore } from "$lib/stores/teamStore.svelte";
import type { Team, TeamMember, TeamInsightsResponse } from "$lib/types/team";
import { DATAFORGE_URL, NEUROFORGE_URL } from "$lib/core/api/endpoints";

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

describe("Team Store", () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    mockFetch.mockClear();

    // Reset store state
    teamStore.teams = [];
    teamStore.selectedTeam = null;
    teamStore.members = [];
    teamStore.insights = null;
    teamStore.error = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with empty state", () => {
      expect(teamStore.teams).toEqual([]);
      expect(teamStore.selectedTeam).toBeNull();
      expect(teamStore.members).toEqual([]);
      expect(teamStore.insights).toBeNull();
      expect(teamStore.error).toBeNull();
    });

    it("should have correct loading states", () => {
      expect(teamStore.isLoadingTeams).toBe(false);
      expect(teamStore.isLoadingMembers).toBe(false);
      expect(teamStore.isLoadingInsights).toBe(false);
      expect(teamStore.isLoadingDashboard).toBe(false);
    });
  });

  describe("fetchTeams", () => {
    it("should fetch teams successfully", async () => {
      const mockTeams: Team[] = [
        {
          id: 1,
          name: "Engineering Team",
          slug: "engineering-team",
          description: "Main engineering team",
          organizationType: "startup",
          teamSize: 10,
          industry: "Technology",
          settings: {},
          isActive: true,
          isPublic: false,
          ownerId: 1,
          memberCount: 10,
          projectCount: 5,
          totalSessions: 50,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTeams,
      } as Response);

      await teamStore.fetchTeams();

      expect(teamStore.teams).toEqual(mockTeams);
      expect(teamStore.isLoadingTeams).toBe(false);
      expect(teamStore.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      } as Response);

      await teamStore.fetchTeams();

      expect(teamStore.teams).toEqual([]);
      expect(teamStore.error).toContain("Failed to fetch teams");
    });

    it("should set loading state during fetch", async () => {
      mockFetch.mockImplementationOnce(() => {
        expect(teamStore.isLoadingTeams).toBe(true);
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      });

      await teamStore.fetchTeams();
    });
  });

  describe("getTeam", () => {
    it("should fetch single team by ID", async () => {
      const mockTeam: Team = {
        id: 1,
        name: "Engineering Team",
        slug: "engineering-team",
        description: "Main engineering team",
        organizationType: "startup",
        teamSize: 10,
        industry: "Technology",
        settings: {},
        isActive: true,
        isPublic: false,
        ownerId: 1,
        memberCount: 10,
        projectCount: 5,
        totalSessions: 50,
        createdAt: "2024-01-01T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTeam,
      } as Response);

      await teamStore.getTeam(1);

      expect(teamStore.selectedTeam).toEqual(mockTeam);
    });
  });

  describe("fetchMembers", () => {
    it("should fetch team members", async () => {
      const mockMembers: TeamMember[] = [
        {
          id: 1,
          teamId: 1,
          userId: 1,
          role: "owner",
          joinedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          teamId: 1,
          userId: 2,
          role: "member",
          joinedAt: "2024-01-02T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembers,
      } as Response);

      await teamStore.fetchMembers(1);

      expect(teamStore.members).toEqual(mockMembers);
    });
  });

  describe("fetchInsights", () => {
    it("should fetch team insights from NeuroForge", async () => {
      const mockInsights: TeamInsightsResponse = {
        teamId: 1,
        periodStart: "2024-11-01T00:00:00Z",
        periodEnd: "2024-12-01T00:00:00Z",
        topLanguages: [
          { language: "TypeScript", count: 10, successRate: 0.9 },
          { language: "Python", count: 5, successRate: 0.8 },
        ],
        topStacks: [
          { stack: "SvelteKit", count: 8, successRate: 0.92 },
          { stack: "FastAPI", count: 4, successRate: 0.85 },
        ],
        recommendedLanguages: [
          "TypeScript - 92% success in recent projects",
          "Python - Strong team expertise",
        ],
        recommendedStacks: [
          "SvelteKit - Team's most successful stack",
          "FastAPI - Excellent Python track record",
        ],
        improvementSuggestions: [
          "Consider adding automated testing to improve success rates",
          "Focus on SvelteKit for frontend projects",
        ],
        overallSuccessRate: 0.87,
        totalProjects: 15,
        totalSessions: 120,
        avgSessionDurationMinutes: 45,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockInsights,
      } as Response);

      await teamStore.fetchInsights(1, 30);

      expect(teamStore.insights).toEqual(mockInsights);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/team-learning/insights/1"),
        expect.any(Object)
      );
    });

    it("should handle insights fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      } as Response);

      await teamStore.fetchInsights(1);

      expect(teamStore.insights).toBeNull();
      expect(teamStore.error).toContain("Failed to fetch insights");
    });
  });

  describe("fetchDashboard", () => {
    it("should fetch all dashboard data in parallel", async () => {
      const mockTeam: Team = {
        id: 1,
        name: "Engineering Team",
        slug: "engineering-team",
        description: "Main engineering team",
        organizationType: "startup",
        teamSize: 10,
        industry: "Technology",
        settings: {},
        isActive: true,
        isPublic: false,
        ownerId: 1,
        memberCount: 10,
        projectCount: 5,
        totalSessions: 50,
        createdAt: "2024-01-01T00:00:00Z",
      };

      const mockMembers: TeamMember[] = [
        {
          id: 1,
          teamId: 1,
          userId: 1,
          role: "owner",
          joinedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const mockInsights: TeamInsightsResponse = {
        teamId: 1,
        periodStart: "2024-11-01T00:00:00Z",
        periodEnd: "2024-12-01T00:00:00Z",
        topLanguages: [],
        topStacks: [],
        recommendedLanguages: [],
        recommendedStacks: [],
        improvementSuggestions: [],
        overallSuccessRate: 0.87,
        totalProjects: 15,
        totalSessions: 120,
      };

      // Mock 4 fetch calls (team, members, projects, insights)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTeam,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMembers,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockInsights,
        } as Response);

      await teamStore.fetchDashboard(1);

      expect(teamStore.selectedTeam).toEqual(mockTeam);
      expect(teamStore.members).toEqual(mockMembers);
      expect(teamStore.insights).toEqual(mockInsights);
      expect(teamStore.isLoadingDashboard).toBe(false);
    });
  });

  describe("selectTeam", () => {
    it("should select a team", () => {
      const mockTeam: Team = {
        id: 1,
        name: "Engineering Team",
        slug: "engineering-team",
        description: "Main engineering team",
        organizationType: "startup",
        teamSize: 10,
        industry: "Technology",
        settings: {},
        isActive: true,
        isPublic: false,
        ownerId: 1,
        memberCount: 10,
        projectCount: 5,
        totalSessions: 50,
        createdAt: "2024-01-01T00:00:00Z",
      };

      teamStore.selectTeam(mockTeam);

      expect(teamStore.selectedTeam).toEqual(mockTeam);
    });
  });

  describe("clearError", () => {
    it("should clear error state", () => {
      teamStore.error = "Some error";
      teamStore.clearError();
      expect(teamStore.error).toBeNull();
    });
  });

  describe("computed properties", () => {
    it("should compute currentUserRole", () => {
      expect(teamStore.currentUserRole).toBeNull();
      // TODO: Update to expect 'member' when auth system is integrated
    });

    it("should compute isAdmin", () => {
      // Currently always returns false until auth integration
      expect(teamStore.isAdmin).toBe(false);
    });

    it("should compute isOwner", () => {
      // Currently always returns false until auth integration
      expect(teamStore.isOwner).toBe(false);
    });

    // TODO: Uncomment when auth integration adds these properties
    // it("should compute canManageMembers", () => {
    //   // Currently undefined until auth integration
    //   expect(teamStore.canManageMembers).toBeUndefined();
    // });

    // it("should compute canInviteMembers", () => {
    //   // Currently undefined until auth integration
    //   expect(teamStore.canInviteMembers).toBeUndefined();
    // });
  });

  describe("error handling", () => {
    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await teamStore.fetchTeams();

      expect(teamStore.error).toContain("Network error");
      expect(teamStore.isLoadingTeams).toBe(false);
    });

    it("should clear previous error on successful fetch", async () => {
      teamStore.error = "Previous error";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await teamStore.fetchTeams();

      expect(teamStore.error).toBeNull();
    });
  });

  describe("API integration", () => {
    it("should call DataForge API for teams", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await teamStore.fetchTeams();

      // Asserted against the canonical constant rather than a literal port.
      // The literals here were swapped: teams were expected on NeuroForge's
      // port and insights on DataForge's.
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(DATAFORGE_URL),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("should call NeuroForge API for insights", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          teamId: 1,
          periodStart: "",
          periodEnd: "",
          topLanguages: [],
          topStacks: [],
          recommendedLanguages: [],
          recommendedStacks: [],
          improvementSuggestions: [],
          totalProjects: 0,
          totalSessions: 0,
        }),
      } as Response);

      await teamStore.fetchInsights(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(NEUROFORGE_URL),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });
  });
});
