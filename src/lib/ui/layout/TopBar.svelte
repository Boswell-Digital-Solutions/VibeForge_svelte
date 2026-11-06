<script lang="ts">
  /**
   * TopBar component - App identity, workspace selector, and primary actions
   */

  import { workspaceStore } from "$lib/core/stores";
  import { wizardStore, userPreferencesStore } from "$lib/workbench/stores";
  import Button from "$lib/ui/primitives/Button.svelte";
  import { goto } from "$app/navigation";
  import { currentUser, logout } from "$lib/auth";

  // Access workspaceStore properties
  // workspaceStore exposes: current, isLoading, error, workspaceId, theme, autoSave
  // For now, we'll use a simple display. Phase 2 will add workspace switching
  const workspaces = [
    { id: "default", name: "Default Workspace" },
    { id: "research", name: "Research" },
    { id: "development", name: "Development" },
  ];

  // Use a placeholder for now since workspaceStore might not be fully initialized
  let selectedWorkspace = "default";

  function handleLogout() {
    logout();
    goto("/login");
  }

  /**
   * Handle new project - respects user preference to skip wizard
   */
  function handleNewProject() {
    if (userPreferencesStore.skipWizard) {
      // Dispatch event to show Quick Create
      window.dispatchEvent(new CustomEvent('show-quick-create'));
    } else {
      wizardStore.open();
    }
  }
</script>

<header class="topbar bg-forge-blacksteel border-b border-slate-800">
  <div class="flex items-center justify-between h-14 px-4">
    <!-- Left: App Identity + Workspace -->
    <div class="flex items-center gap-4">
      <!-- App Logo/Brand -->
      <div class="flex items-center gap-2">
        <img
          src="/vibeforge-icon.png"
          alt="VibeForge"
          class="w-8 h-8 object-contain"
        />
        <div>
          <h1 class="text-lg font-bold text-slate-100">VibeForge</h1>
        </div>
      </div>

      <!-- Workspace Selector -->
      <div class="flex items-center gap-2 pl-4 border-l border-slate-700">
        <svg
          class="w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <select
          class="bg-forge-gunmetal border border-slate-700 text-slate-200 text-sm rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-forge-ember focus:border-forge-ember transition-all"
          bind:value={selectedWorkspace}
        >
          {#each workspaces as workspace}
            <option value={workspace.id}>{workspace.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2">
      <!-- New Project -->
      <Button variant="primary" size="sm" onclick={handleNewProject}>
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span>New Project</span>
      </Button>

      <Button variant="icon" size="md" onclick={() => goto("/settings")}>
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </Button>

      <!-- User Menu -->
      {#if $currentUser}
        <div class="flex items-center gap-2 pl-4 border-l border-slate-700">
          <span class="text-sm text-slate-400">{$currentUser.username}</span>
          <Button variant="ghost" size="sm" onclick={handleLogout}>
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </Button>
        </div>
      {/if}
    </div>
  </div>
</header>
