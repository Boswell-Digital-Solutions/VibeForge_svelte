<script lang="ts">
  /**
   * Runtime Status Table Component
   * Phase 2.7.2: Dev Environment Panel UI
   *
   * Displays detected runtimes with status, version, and path information
   */

  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

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

  // ============================================================================
  // State
  // ============================================================================

  let runtimes = $state<RuntimeStatus[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let allRequiredMet = $state(false);
  let missingRequired = $state<string[]>([]);
  let containerOnly = $state<string[]>([]);
  let lastChecked = $state<Date | null>(null);

  // Sort/filter state
  let sortBy = $state<'name' | 'category' | 'status'>('category');
  let filterCategory = $state<string | null>(null);
  let searchQuery = $state('');

  // ============================================================================
  // Computed
  // ============================================================================

  const categories = $derived(
    [...new Set(runtimes.map(r => r.category))].sort()
  );

  const filteredRuntimes = $derived(
    runtimes
      .filter(r => {
        if (filterCategory && r.category !== filterCategory) return false;
        if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'category') return a.category.localeCompare(b.category);
        // Sort by status: installed > on-path > missing
        const aScore = a.installed ? 2 : a.onPath ? 1 : 0;
        const bScore = b.installed ? 2 : b.onPath ? 1 : 0;
        return bScore - aScore;
      })
  );

  const installedCount = $derived(runtimes.filter(r => r.installed).length);
  const missingCount = $derived(runtimes.filter(r => !r.installed && !r.notes?.includes('Container-only')).length);
  const containerOnlyCount = $derived(containerOnly.length);

  // ============================================================================
  // Functions
  // ============================================================================

  async function checkRuntimes() {
    try {
      isLoading = true;
      error = null;

      const result: RuntimeCheckResult = await invoke('check_runtimes');

      runtimes = result.runtimes;
      allRequiredMet = result.allRequiredMet;
      missingRequired = result.missingRequired;
      containerOnly = result.containerOnly;
      lastChecked = new Date(result.timestamp * 1000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to check runtimes';
      console.error('[RuntimeStatusTable] Error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function refreshCache() {
    try {
      await invoke('refresh_runtime_cache');
      await checkRuntimes();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to refresh cache';
    }
  }

  function getStatusIcon(runtime: RuntimeStatus): string {
    if (runtime.notes?.includes('Container-only')) return '🐳';
    if (runtime.installed) return '✔️';
    return '❌';
  }

  function getStatusColor(runtime: RuntimeStatus): string {
    if (runtime.notes?.includes('Container-only')) return 'text-blue-400';
    if (runtime.installed) return 'text-green-400';
    return 'text-red-400';
  }

  function getStatusText(runtime: RuntimeStatus): string {
    if (runtime.notes?.includes('Container-only')) return 'Container Only';
    if (runtime.installed) return 'Installed';
    if (runtime.onPath) return 'On PATH (no version)';
    return 'Missing';
  }

  function formatTimestamp(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    checkRuntimes();
  });
</script>

<div class="runtime-status-table">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-2xl font-bold text-zinc-100">Runtime Environment</h2>
      {#if lastChecked}
        <p class="text-sm text-zinc-400 mt-1">
          Last checked: {lastChecked.toLocaleTimeString()}
        </p>
      {/if}
    </div>

    <button
      onclick={refreshCache}
      disabled={isLoading}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
    >
      <svg class="w-4 h-4" class:animate-spin={isLoading} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {isLoading ? 'Checking...' : 'Refresh'}
    </button>
  </div>

  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">Total Runtimes</div>
      <div class="text-2xl font-bold text-zinc-100">{runtimes.length}</div>
    </div>

    <div class="bg-zinc-800 border border-green-500/30 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">✔️ Installed</div>
      <div class="text-2xl font-bold text-green-400">{installedCount}</div>
    </div>

    <div class="bg-zinc-800 border border-red-500/30 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">❌ Missing</div>
      <div class="text-2xl font-bold text-red-400">{missingCount}</div>
    </div>

    <div class="bg-zinc-800 border border-blue-500/30 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">🐳 Container-Only</div>
      <div class="text-2xl font-bold text-blue-400">{containerOnlyCount}</div>
    </div>
  </div>

  <!-- Filters & Search -->
  <div class="flex flex-wrap items-center gap-4 mb-4">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search runtimes..."
      class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    />

    <select
      bind:value={filterCategory}
      class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <option value={null}>All Categories</option>
      {#each categories as category}
        <option value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
      {/each}
    </select>

    <select
      bind:value={sortBy}
      class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <option value="category">Sort by Category</option>
      <option value="name">Sort by Name</option>
      <option value="status">Sort by Status</option>
    </select>
  </div>

  <!-- Error State -->
  {#if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
      <p class="text-red-400">{error}</p>
    </div>
  {/if}

  <!-- Warnings -->
  {#if !allRequiredMet && missingRequired.length > 0}
    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
      <h3 class="text-yellow-400 font-semibold mb-2">⚠️ Missing Required Runtimes</h3>
      <p class="text-zinc-300 text-sm">
        The following required runtimes are missing:
      </p>
      <ul class="list-disc list-inside mt-2 text-zinc-400 text-sm">
        {#each missingRequired as runtime}
          <li>{runtime}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Runtime Table -->
  <div class="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
    <table class="w-full">
      <thead class="bg-zinc-900 border-b border-zinc-700">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Runtime</th>
          <th class="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Category</th>
          <th class="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Version</th>
          <th class="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Path</th>
          <th class="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Last Checked</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-700">
        {#if isLoading}
          <tr>
            <td colspan="6" class="px-6 py-8 text-center text-zinc-400">
              <div class="flex items-center justify-center gap-2">
                <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Checking runtimes...
              </div>
            </td>
          </tr>
        {:else if filteredRuntimes.length === 0}
          <tr>
            <td colspan="6" class="px-6 py-8 text-center text-zinc-400">
              No runtimes found matching your filters.
            </td>
          </tr>
        {:else}
          {#each filteredRuntimes as runtime}
            <tr class="hover:bg-zinc-750 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <span class="text-xl">{getStatusIcon(runtime)}</span>
                  <span class="text-sm {getStatusColor(runtime)}">{getStatusText(runtime)}</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div>
                  <div class="text-sm font-medium text-zinc-100">{runtime.name}</div>
                  {#if runtime.required}
                    <span class="text-xs text-orange-400">Required</span>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded">
                  {runtime.category}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                {runtime.version || '-'}
              </td>
              <td class="px-6 py-4 text-sm text-zinc-400 max-w-xs truncate" title={runtime.path || ''}>
                {runtime.path || '-'}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                {formatTimestamp(runtime.lastChecked)}
              </td>
            </tr>
            {#if runtime.notes}
              <tr>
                <td colspan="6" class="px-6 py-2 bg-zinc-900">
                  <div class="text-xs text-zinc-500 italic">
                    ℹ️ {runtime.notes}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
	@reference "tailwindcss";

  .runtime-status-table {
    @apply p-6;
  }

  tr:hover td {
    @apply bg-zinc-750;
  }

  .bg-zinc-750 {
    background-color: rgb(48, 52, 58);
  }
</style>
