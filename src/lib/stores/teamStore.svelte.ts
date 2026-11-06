/**
 * teamStore.svelte.ts
 *
 * Svelte 5 store for team management and learning insights
 * Phase 4.1: Team & Organization Learning
 */

import type {
  Team,
  TeamMember,
  TeamInvite,
  TeamProject,
  TeamInsightsResponse,
  TeamDashboardSummary,
  CreateTeamRequest,
  UpdateTeamRequest,
  InviteMemberRequest,
  LinkProjectRequest,
  TeamListFilter,
  TeamRole,
} from '$lib/types/team';
import { DATAFORGE_URL, NEUROFORGE_URL } from '$lib/core/api/endpoints';

// API base URLs (from environment or config)
const DATA_FORGE_API = DATAFORGE_URL;
const NEURO_FORGE_API = NEUROFORGE_URL;

// ============================================================================
// Store State
// ============================================================================

class TeamStore {
  // Teams
  teams = $state<Team[]>([]);
  selectedTeam = $state<Team | null>(null);
  isLoadingTeams = $state(false);

  // Team Members
  members = $state<TeamMember[]>([]);
  isLoadingMembers = $state(false);

  // Team Invites
  invites = $state<TeamInvite[]>([]);
  isLoadingInvites = $state(false);

  // Team Projects
  projects = $state<TeamProject[]>([]);
  isLoadingProjects = $state(false);

  // Team Insights
  insights = $state<TeamInsightsResponse | null>(null);
  isLoadingInsights = $state(false);

  // Dashboard
  dashboardSummary = $state<TeamDashboardSummary | null>(null);
  isLoadingDashboard = $state(false);

  // Error handling
  error = $state<string | null>(null);

  // ============================================================================
  // Computed Values
  // ============================================================================

  get currentUserRole(): TeamRole | null {
    if (!this.selectedTeam) return null;
    // TODO: Get from auth store
    return 'member'; // Placeholder
  }

  get isAdmin(): boolean {
    return this.currentUserRole === 'owner' || this.currentUserRole === 'admin';
  }

  get isOwner(): boolean {
    return this.currentUserRole === 'owner';
  }

  get activeMembers(): TeamMember[] {
    return this.members;
  }

  get pendingInvites(): TeamInvite[] {
    return this.invites.filter((i) => i.status === 'pending');
  }

  // ============================================================================
  // Team Management Actions
  // ============================================================================

  /**
   * Fetch all teams for current user
   */
  async fetchTeams(filter: TeamListFilter = {}): Promise<void> {
    try {
      this.isLoadingTeams = true;
      this.error = null;

      const params = new URLSearchParams();
      if (filter.ownedOnly) params.append('owned_only', 'true');
      if (filter.publicOnly) params.append('public_only', 'true');
      if (filter.skip) params.append('skip', filter.skip.toString());
      if (filter.limit) params.append('limit', filter.limit.toString());

      const response = await fetch(`${DATA_FORGE_API}/api/teams?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.statusText}`);
      }

      this.teams = await response.json();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch teams';
      console.error('[TeamStore] Fetch teams error:', err);
    } finally {
      this.isLoadingTeams = false;
    }
  }

  /**
   * Get single team by ID
   */
  async getTeam(teamId: number): Promise<Team | null> {
    try {
      this.isLoadingTeams = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team: ${response.statusText}`);
      }

      const team = await response.json();
      this.selectedTeam = team;
      return team;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch team';
      console.error('[TeamStore] Get team error:', err);
      return null;
    } finally {
      this.isLoadingTeams = false;
    }
  }

  /**
   * Create new team
   */
  async createTeam(data: CreateTeamRequest): Promise<Team | null> {
    try {
      this.isLoadingTeams = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to create team: ${response.statusText}`);
      }

      const team = await response.json();
      this.teams = [team, ...this.teams];
      this.selectedTeam = team;
      return team;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to create team';
      console.error('[TeamStore] Create team error:', err);
      return null;
    } finally {
      this.isLoadingTeams = false;
    }
  }

  /**
   * Update team
   */
  async updateTeam(teamId: number, data: UpdateTeamRequest): Promise<Team | null> {
    try {
      this.isLoadingTeams = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to update team: ${response.statusText}`);
      }

      const team = await response.json();

      // Update in teams array
      this.teams = this.teams.map((t) => (t.id === teamId ? team : t));

      if (this.selectedTeam?.id === teamId) {
        this.selectedTeam = team;
      }

      return team;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to update team';
      console.error('[TeamStore] Update team error:', err);
      return null;
    } finally {
      this.isLoadingTeams = false;
    }
  }

  /**
   * Delete team (owner only)
   */
  async deleteTeam(teamId: number): Promise<boolean> {
    try {
      this.isLoadingTeams = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete team: ${response.statusText}`);
      }

      // Remove from teams array
      this.teams = this.teams.filter((t) => t.id !== teamId);

      if (this.selectedTeam?.id === teamId) {
        this.selectedTeam = null;
      }

      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to delete team';
      console.error('[TeamStore] Delete team error:', err);
      return false;
    } finally {
      this.isLoadingTeams = false;
    }
  }

  // ============================================================================
  // Member Management Actions
  // ============================================================================

  /**
   * Fetch team members
   */
  async fetchMembers(teamId: number): Promise<void> {
    try {
      this.isLoadingMembers = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/members`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch members: ${response.statusText}`);
      }

      this.members = await response.json();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch members';
      console.error('[TeamStore] Fetch members error:', err);
    } finally {
      this.isLoadingMembers = false;
    }
  }

  /**
   * Update member role (admin only)
   */
  async updateMemberRole(teamId: number, userId: number, role: TeamRole): Promise<boolean> {
    try {
      this.isLoadingMembers = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update member role: ${response.statusText}`);
      }

      // Update in members array
      this.members = this.members.map((m) => (m.userId === userId ? { ...m, role } : m));

      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to update member role';
      console.error('[TeamStore] Update member role error:', err);
      return false;
    } finally {
      this.isLoadingMembers = false;
    }
  }

  /**
   * Remove member from team (admin only)
   */
  async removeMember(teamId: number, userId: number): Promise<boolean> {
    try {
      this.isLoadingMembers = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to remove member: ${response.statusText}`);
      }

      // Remove from members array
      this.members = this.members.filter((m) => m.userId !== userId);

      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to remove member';
      console.error('[TeamStore] Remove member error:', err);
      return false;
    } finally {
      this.isLoadingMembers = false;
    }
  }

  // ============================================================================
  // Invitation Actions
  // ============================================================================

  /**
   * Send team invitation (admin only)
   */
  async sendInvite(teamId: number, data: InviteMemberRequest): Promise<TeamInvite | null> {
    try {
      this.isLoadingInvites = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to send invite: ${response.statusText}`);
      }

      const invite = await response.json();
      this.invites = [invite, ...this.invites];
      return invite;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to send invite';
      console.error('[TeamStore] Send invite error:', err);
      return null;
    } finally {
      this.isLoadingInvites = false;
    }
  }

  /**
   * Fetch team invitations (admin only)
   */
  async fetchInvites(teamId: number, pendingOnly = false): Promise<void> {
    try {
      this.isLoadingInvites = true;
      this.error = null;

      const params = pendingOnly ? '?pending_only=true' : '';
      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/invites${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invites: ${response.statusText}`);
      }

      this.invites = await response.json();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch invites';
      console.error('[TeamStore] Fetch invites error:', err);
    } finally {
      this.isLoadingInvites = false;
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvite(inviteToken: string): Promise<boolean> {
    try {
      this.isLoadingInvites = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invite_token: inviteToken }),
      });

      if (!response.ok) {
        throw new Error(`Failed to accept invite: ${response.statusText}`);
      }

      // Refresh teams list
      await this.fetchTeams();

      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to accept invite';
      console.error('[TeamStore] Accept invite error:', err);
      return false;
    } finally {
      this.isLoadingInvites = false;
    }
  }

  /**
   * Cancel invitation (admin only)
   */
  async cancelInvite(teamId: number, inviteId: number): Promise<boolean> {
    try {
      this.isLoadingInvites = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/invites/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel invite: ${response.statusText}`);
      }

      // Remove from invites array
      this.invites = this.invites.filter((i) => i.id !== inviteId);

      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to cancel invite';
      console.error('[TeamStore] Cancel invite error:', err);
      return false;
    } finally {
      this.isLoadingInvites = false;
    }
  }

  // ============================================================================
  // Project Linking Actions
  // ============================================================================

  /**
   * Fetch team projects
   */
  async fetchProjects(teamId: number, templatesOnly = false): Promise<void> {
    try {
      this.isLoadingProjects = true;
      this.error = null;

      const params = templatesOnly ? '?templates_only=true' : '';
      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/projects${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      this.projects = await response.json();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch projects';
      console.error('[TeamStore] Fetch projects error:', err);
    } finally {
      this.isLoadingProjects = false;
    }
  }

  /**
   * Link project to team
   */
  async linkProject(teamId: number, data: LinkProjectRequest): Promise<TeamProject | null> {
    try {
      this.isLoadingProjects = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to link project: ${response.statusText}`);
      }

      const project = await response.json();
      this.projects = [project, ...this.projects];
      return project;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to link project';
      console.error('[TeamStore] Link project error:', err);
      return null;
    } finally {
      this.isLoadingProjects = false;
    }
  }

  /**
   * Unlink project from team (admin only)
   */
  async unlinkProject(teamId: number, projectId: number): Promise<boolean> {
    try {
      this.isLoadingProjects = true;
      this.error = null;

      const response = await fetch(`${DATA_FORGE_API}/api/teams/${teamId}/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to unlink project: ${response.statusText}`);
      }

      // Remove from projects array
      this.projects = this.projects.filter((p) => p.projectId !== projectId);

      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to unlink project';
      console.error('[TeamStore] Unlink project error:', err);
      return false;
    } finally {
      this.isLoadingProjects = false;
    }
  }

  // ============================================================================
  // Team Learning & Insights Actions
  // ============================================================================

  /**
   * Fetch team insights from NeuroForge
   */
  async fetchInsights(teamId: number, periodDays = 30): Promise<void> {
    try {
      this.isLoadingInsights = true;
      this.error = null;

      const response = await fetch(
        `${NEURO_FORGE_API}/api/v1/team-learning/insights/${teamId}?period_days=${periodDays}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.statusText}`);
      }

      this.insights = await response.json();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch insights';
      console.error('[TeamStore] Fetch insights error:', err);
    } finally {
      this.isLoadingInsights = false;
    }
  }

  /**
   * Trigger team learning aggregation
   */
  async triggerAggregation(teamId: number, periodDays = 30): Promise<boolean> {
    try {
      this.isLoadingInsights = true;
      this.error = null;

      const response = await fetch(
        `${NEURO_FORGE_API}/api/v1/team-learning/aggregate/${teamId}?period_days=${periodDays}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to trigger aggregation: ${response.statusText}`);
      }

      // Aggregation is queued, will complete in background
      return true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to trigger aggregation';
      console.error('[TeamStore] Trigger aggregation error:', err);
      return false;
    } finally {
      this.isLoadingInsights = false;
    }
  }

  /**
   * Fetch comprehensive dashboard summary
   */
  async fetchDashboard(teamId: number): Promise<void> {
    try {
      this.isLoadingDashboard = true;
      this.error = null;

      // Fetch all dashboard data in parallel
      await Promise.all([
        this.getTeam(teamId),
        this.fetchMembers(teamId),
        this.fetchProjects(teamId),
        this.fetchInsights(teamId),
      ]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      console.error('[TeamStore] Fetch dashboard error:', err);
    } finally {
      this.isLoadingDashboard = false;
    }
  }

  // ============================================================================
  // Utility Actions
  // ============================================================================

  /**
   * Reset error state
   */
  clearError(): void {
    this.error = null;
  }

  /**
   * Select team
   */
  selectTeam(team: Team | null): void {
    this.selectedTeam = team;
  }
}

// Export singleton instance
export const teamStore = new TeamStore();
