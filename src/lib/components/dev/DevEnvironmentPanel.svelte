<script lang="ts">
  /**
   * Dev Environment Panel Component
   * Phase 2.7.2: Dev Environment Panel UI
   *
   * Main container for development environment management with tab navigation
   */

  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';
  import RuntimeStatusTable from './RuntimeStatusTable.svelte';
  import InstallationGuide from './InstallationGuide.svelte';
  import ToolchainsConfig from './ToolchainsConfig.svelte';
  import DevContainerGenerator from './DevContainerGenerator.svelte';

  // ============================================================================
  // Types
  // ============================================================================

  interface RuntimeStatus {
    id: string;
    name: string;
    category: string;
    required: boolean;
    installed: boolean;
    onPath: boolean;
    version: string | null;
    path: string | null;
    lastChecked: number | null;
    notes: string | null;
  }

  interface RuntimeCheckResult {
    runtimes: RuntimeStatus[];
    allRequiredMet: boolean;
    missingRequired: string[];
    containerOnly: string[];
    timestamp: number;
  }

  type Tab = 'status' | 'install' | 'config' | 'devcontainer';

  // ============================================================================
  // State
  // ============================================================================

  let activeTab = $state<Tab>('status');
  let runtimeSummary = $state<RuntimeCheckResult | null>(null);
  let isLoadingSummary = $state(true);
  let selectedRuntimeForInstall = $state<RuntimeStatus | null>(null);
  let showQuickActions = $state(true);

  // ============================================================================
  // Computed
  // ============================================================================

  const installedCount = $derived(
    runtimeSummary ? runtimeSummary.runtimes.filter(r => r.installed).length : 0
  );

  const missingCount = $derived(
    runtimeSummary
      ? runtimeSummary.runtimes.filter(
          r => !r.installed && !r.notes?.includes('Container-only')
        ).length
      : 0
  );

  const containerOnlyCount = $derived(
    runtimeSummary ? runtimeSummary.containerOnly.length : 0
  );

  const totalCount = $derived(runtimeSummary ? runtimeSummary.runtimes.length : 0);

  const healthScore = $derived(
    totalCount > 0 ? Math.round((installedCount / totalCount) * 100) : 0
  );

  const healthColor = $derived(
    healthScore >= 80 ? 'text-green-400' : healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'
  );

  const healthBarColor = $derived(
    healthScore >= 80
      ? 'bg-green-500'
      : healthScore >= 50
        ? 'bg-yellow-500'
        : 'bg-red-500'
  );

  // ============================================================================
  // Functions
  // ============================================================================

  async function loadRuntimeSummary() {
    try {
      isLoadingSummary = true;
      const result: RuntimeCheckResult = await invoke('check_runtimes');
      runtimeSummary = result;
    } catch (err) {
      console.error('[DevEnvironmentPanel] Failed to load runtime summary:', err);
    } finally {
      isLoadingSummary = false;
    }
  }

  async function refreshAll() {
    try {
      await invoke('refresh_runtime_cache');
      await loadRuntimeSummary();
    } catch (err) {
      console.error('[DevEnvironmentPanel] Failed to refresh:', err);
    }
  }

  function switchTab(tab: Tab) {
    activeTab = tab;
    selectedRuntimeForInstall = null;
  }

  function openInstallGuide(runtime: RuntimeStatus) {
    selectedRuntimeForInstall = runtime;
    activeTab = 'install';
  }

  function getTabIcon(tab: Tab): string {
    switch (tab) {
      case 'status':
        return '📊';
      case 'install':
        return '📦';
      case 'config':
        return '⚙️';
      case 'devcontainer':
        return '🐳';
      default:
        return '📄';
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    loadRuntimeSummary();
  });
</script>

<div class="dev-environment-panel">
  <!-- Header with Summary -->
  <div class="header">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-3xl font-bold text-zinc-100">Development Environment</h1>
        <p class="text-sm text-zinc-400 mt-1">
          Manage runtimes, tools, and development containers
        </p>
      </div>

      {#if !isLoadingSummary && runtimeSummary}
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-sm text-zinc-400">Environment Health</div>
            <div class="text-2xl font-bold {healthColor}">{healthScore}%</div>
          </div>
          <button
            onclick={refreshAll}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            title="Refresh all runtime checks"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      {/if}
    </div>

    <!-- Health Bar -->
    {#if !isLoadingSummary && runtimeSummary}
      <div class="bg-zinc-800 rounded-lg p-4 mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-zinc-400">Runtime Status Overview</span>
          <span class="text-xs text-zinc-500">
            {installedCount}/{totalCount} installed
          </span>
        </div>
        <div class="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            class="h-full {healthBarColor} transition-all duration-500"
            style="width: {healthScore}%"
          ></div>
        </div>
        <div class="grid grid-cols-3 gap-4 mt-4">
          <div class="flex items-center gap-2">
            <span class="text-lg">✔️</span>
            <div>
              <div class="text-xs text-zinc-400">Installed</div>
              <div class="text-lg font-bold text-green-400">{installedCount}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-lg">❌</span>
            <div>
              <div class="text-xs text-zinc-400">Missing</div>
              <div class="text-lg font-bold text-red-400">{missingCount}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-lg">🐳</span>
            <div>
              <div class="text-xs text-zinc-400">Container-Only</div>
              <div class="text-lg font-bold text-blue-400">{containerOnlyCount}</div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Warnings -->
    {#if runtimeSummary && !runtimeSummary.allRequiredMet}
      <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
        <div class="flex items-start gap-3">
          <svg
            class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-yellow-400 mb-1">
              ⚠️ Missing Required Runtimes
            </h3>
            <p class="text-sm text-zinc-300 mb-2">
              The following required runtimes are missing and may prevent project scaffolding:
            </p>
            <ul class="list-disc list-inside text-sm text-zinc-400 space-y-1">
              {#each runtimeSummary.missingRequired as runtime}
                <li>{runtime}</li>
              {/each}
            </ul>
            <button
              onclick={() => switchTab('install')}
              class="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-sm flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              View Installation Guide
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <div class="flex border-b border-zinc-700">
      <button
        onclick={() => switchTab('status')}
        class="tab-button {activeTab === 'status' ? 'active' : ''}"
      >
        <span class="text-lg">{getTabIcon('status')}</span>
        <span>Runtime Status</span>
      </button>
      <button
        onclick={() => switchTab('install')}
        class="tab-button {activeTab === 'install' ? 'active' : ''}"
      >
        <span class="text-lg">{getTabIcon('install')}</span>
        <span>Installation Guide</span>
        {#if missingCount > 0}
          <span class="badge">{missingCount}</span>
        {/if}
      </button>
      <button
        onclick={() => switchTab('config')}
        class="tab-button {activeTab === 'config' ? 'active' : ''}"
      >
        <span class="text-lg">{getTabIcon('config')}</span>
        <span>Toolchains Config</span>
      </button>
      <button
        onclick={() => switchTab('devcontainer')}
        class="tab-button {activeTab === 'devcontainer' ? 'active' : ''}"
      >
        <span class="text-lg">{getTabIcon('devcontainer')}</span>
        <span>Dev-Containers</span>
        {#if containerOnlyCount > 0}
          <span class="badge badge-blue">{containerOnlyCount}</span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'status'}
      <RuntimeStatusTable />
    {:else if activeTab === 'install'}
      <div class="installation-tab">
        {#if selectedRuntimeForInstall}
          <!-- Show specific runtime installation guide -->
          <div class="mb-4">
            <button
              onclick={() => (selectedRuntimeForInstall = null)}
              class="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to all runtimes
            </button>
          </div>
          <InstallationGuide
            runtimeId={selectedRuntimeForInstall.id}
            runtimeName={selectedRuntimeForInstall.name}
          />
        {:else}
          <!-- Show runtime selection for installation -->
          <div class="runtime-selection">
            <h2 class="text-2xl font-bold text-zinc-100 mb-4">Select Runtime to Install</h2>
            <p class="text-sm text-zinc-400 mb-6">
              Choose a runtime below to view platform-specific installation instructions
            </p>

            {#if runtimeSummary}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each runtimeSummary.runtimes as runtime}
                  <button
                    onclick={() => openInstallGuide(runtime)}
                    class="runtime-card {runtime.installed ? 'installed' : 'missing'}"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xl">
                            {runtime.notes?.includes('Container-only')
                              ? '🐳'
                              : runtime.installed
                                ? '✔️'
                                : '📦'}
                          </span>
                          <h3 class="text-lg font-semibold text-zinc-100">{runtime.name}</h3>
                        </div>
                        <p class="text-sm text-zinc-400">
                          {runtime.installed
                            ? `Installed: ${runtime.version || 'version unknown'}`
                            : runtime.notes?.includes('Container-only')
                              ? 'Requires Dev-Container'
                              : 'Not installed'}
                        </p>
                      </div>
                      <svg class="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'config'}
      <ToolchainsConfig />
    {:else if activeTab === 'devcontainer'}
      <DevContainerGenerator />
    {/if}
  </div>
</div>

<style>
	@reference "tailwindcss";

  .dev-environment-panel {
    @apply min-h-screen bg-zinc-900 text-zinc-100;
  }

  .header {
    @apply p-6 bg-zinc-900;
  }

  .tab-navigation {
    @apply bg-zinc-900 px-6;
  }

  .tab-button {
    @apply relative px-6 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-2;
  }

  .tab-button.active {
    @apply text-blue-400 border-b-2 border-blue-400;
  }

  .tab-button.active::after {
    content: '';
    @apply absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400;
  }

  .badge {
    @apply ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full;
  }

  .badge-blue {
    @apply bg-blue-500;
  }

  .tab-content {
    @apply bg-zinc-900;
  }

  .installation-tab,
  .config-tab,
  .devcontainer-tab {
    @apply p-6;
  }

  .runtime-selection {
    @apply max-w-4xl;
  }

  .runtime-card {
    @apply bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:bg-zinc-750 hover:border-zinc-600 transition-all text-left;
  }

  .runtime-card.installed {
    @apply border-green-500/30 bg-green-500/5;
  }

  .runtime-card.missing {
    @apply border-zinc-700;
  }

  .bg-zinc-750 {
    background-color: rgb(48, 52, 58);
  }
</style>
