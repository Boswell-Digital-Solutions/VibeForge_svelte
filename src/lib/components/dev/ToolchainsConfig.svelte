<script lang="ts">
  /**
   * Toolchains Configuration Component
   * Phase 2.7.2: Dev Environment Panel UI
   *
   * Allows manual path overrides and per-runtime configuration with persistence
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

  interface RuntimeOverride {
    id: string;
    customPath: string;
    enabled: boolean;
  }

  // ============================================================================
  // State
  // ============================================================================

  let runtimes = $state<RuntimeStatus[]>([]);
  let overrides = $state<Map<string, RuntimeOverride>>(new Map());
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let editingRuntime = $state<string | null>(null);
  let filterCategory = $state<string | null>(null);
  let searchQuery = $state('');

  // ============================================================================
  // Computed
  // ============================================================================

  const categories = $derived([...new Set(runtimes.map(r => r.category))].sort());

  const filteredRuntimes = $derived(
    runtimes.filter(r => {
      if (filterCategory && r.category !== filterCategory) return false;
      if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
  );

  const hasUnsavedChanges = $derived(
    Array.from(overrides.values()).some(override => {
      const savedOverride = getSavedOverride(override.id);
      return (
        !savedOverride ||
        savedOverride.customPath !== override.customPath ||
        savedOverride.enabled !== override.enabled
      );
    })
  );

  const overrideCount = $derived(
    Array.from(overrides.values()).filter(o => o.enabled).length
  );

  // ============================================================================
  // Functions
  // ============================================================================

  async function loadRuntimes() {
    try {
      isLoading = true;
      error = null;

      const result: RuntimeCheckResult = await invoke('check_runtimes');
      runtimes = result.runtimes;

      // Load saved overrides from localStorage
      loadOverridesFromStorage();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load runtimes';
      console.error('[ToolchainsConfig] Error:', err);
    } finally {
      isLoading = false;
    }
  }

  function loadOverridesFromStorage() {
    try {
      const stored = localStorage.getItem('vibeforge_runtime_overrides');
      if (stored) {
        const parsed: RuntimeOverride[] = JSON.parse(stored);
        overrides = new Map(parsed.map(o => [o.id, o]));
      }
    } catch (err) {
      console.error('[ToolchainsConfig] Failed to load overrides:', err);
    }
  }

  function getSavedOverride(runtimeId: string): RuntimeOverride | null {
    try {
      const stored = localStorage.getItem('vibeforge_runtime_overrides');
      if (stored) {
        const parsed: RuntimeOverride[] = JSON.parse(stored);
        return parsed.find(o => o.id === runtimeId) || null;
      }
    } catch (err) {
      console.error('[ToolchainsConfig] Failed to get saved override:', err);
    }
    return null;
  }

  function saveOverridesToStorage() {
    try {
      const overrideArray = Array.from(overrides.values());
      localStorage.setItem('vibeforge_runtime_overrides', JSON.stringify(overrideArray));
    } catch (err) {
      console.error('[ToolchainsConfig] Failed to save overrides:', err);
      throw err;
    }
  }

  function setCustomPath(runtimeId: string, path: string) {
    const existing = overrides.get(runtimeId);
    if (existing) {
      existing.customPath = path;
      overrides.set(runtimeId, existing);
    } else {
      overrides.set(runtimeId, {
        id: runtimeId,
        customPath: path,
        enabled: false,
      });
    }
    // Trigger reactivity
    overrides = new Map(overrides);
  }

  function toggleOverride(runtimeId: string, enabled: boolean) {
    const existing = overrides.get(runtimeId);
    if (existing) {
      existing.enabled = enabled;
      overrides.set(runtimeId, existing);
      // Trigger reactivity
      overrides = new Map(overrides);
    }
  }

  function getEffectivePath(runtime: RuntimeStatus): string {
    const override = overrides.get(runtime.id);
    if (override && override.enabled && override.customPath) {
      return override.customPath;
    }
    return runtime.path || 'Not detected';
  }

  function isOverridden(runtimeId: string): boolean {
    const override = overrides.get(runtimeId);
    return override ? override.enabled : false;
  }

  function getCustomPath(runtimeId: string): string {
    const override = overrides.get(runtimeId);
    return override ? override.customPath : '';
  }

  async function saveChanges() {
    try {
      isSaving = true;
      error = null;
      successMessage = null;

      saveOverridesToStorage();

      successMessage = `Successfully saved ${overrideCount} runtime override(s)`;
      setTimeout(() => {
        successMessage = null;
      }, 3000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save changes';
    } finally {
      isSaving = false;
    }
  }

  function resetToDefaults() {
    if (confirm('Are you sure you want to reset all custom paths to defaults?')) {
      overrides.clear();
      overrides = new Map();
      localStorage.removeItem('vibeforge_runtime_overrides');
      successMessage = 'All custom paths have been reset to defaults';
      setTimeout(() => {
        successMessage = null;
      }, 3000);
    }
  }

  function resetSingleRuntime(runtimeId: string) {
    overrides.delete(runtimeId);
    overrides = new Map(overrides);
    editingRuntime = null;
  }

  function startEditing(runtimeId: string) {
    editingRuntime = runtimeId;
  }

  function cancelEditing() {
    editingRuntime = null;
  }

  function getCategoryIcon(category: string): string {
    switch (category) {
      case 'frontend':
        return '🎨';
      case 'backend':
        return '⚙️';
      case 'systems':
        return '🔧';
      case 'mobile':
        return '📱';
      default:
        return '📦';
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    loadRuntimes();
  });
</script>

<div class="toolchains-config">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-2xl font-bold text-zinc-100">Toolchains Configuration</h2>
      <p class="text-sm text-zinc-400 mt-1">
        Override detected runtime paths with custom locations
      </p>
    </div>

    <div class="flex items-center gap-2">
      {#if hasUnsavedChanges}
        <span class="text-xs text-yellow-400 mr-2">⚠️ Unsaved changes</span>
      {/if}
      <button
        onclick={resetToDefaults}
        disabled={overrideCount === 0}
        class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded-lg transition-colors text-sm"
      >
        Reset All
      </button>
      <button
        onclick={saveChanges}
        disabled={isSaving || !hasUnsavedChanges}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
      >
        {#if isSaving}
          <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Saving...
        {:else}
          Save Changes
        {/if}
      </button>
    </div>
  </div>

  <!-- Info Box -->
  <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
    <div class="flex items-start gap-3">
      <svg
        class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-blue-400 mb-1">Custom Path Configuration</h3>
        <p class="text-sm text-zinc-300 mb-2">
          You can override the detected paths for runtimes if needed. This is useful when:
        </p>
        <ul class="text-sm text-zinc-400 space-y-1">
          <li>• Using version managers (nvm, pyenv, rustup, etc.)</li>
          <li>• Installing runtimes in non-standard locations</li>
          <li>• Running multiple versions of the same runtime</li>
          <li>• The auto-detection fails to find your installation</li>
        </ul>
        <p class="text-xs text-zinc-500 mt-3">
          ⚠️ Note: Custom paths are stored in browser localStorage and won't affect system PATH
        </p>
      </div>
    </div>
  </div>

  <!-- Success/Error Messages -->
  {#if successMessage}
    <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <p class="text-green-400 text-sm">{successMessage}</p>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
      <p class="text-red-400 text-sm">{error}</p>
    </div>
  {/if}

  <!-- Stats Bar -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">Total Runtimes</div>
      <div class="text-2xl font-bold text-zinc-100">{runtimes.length}</div>
    </div>
    <div class="bg-zinc-800 border border-blue-500/30 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">Custom Paths</div>
      <div class="text-2xl font-bold text-blue-400">{overrideCount}</div>
    </div>
    <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
      <div class="text-sm text-zinc-400 mb-1">Auto-Detected</div>
      <div class="text-2xl font-bold text-green-400">
        {runtimes.filter(r => r.installed && !isOverridden(r.id)).length}
      </div>
    </div>
  </div>

  <!-- Filters -->
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
  </div>

  <!-- Runtime Configuration List -->
  <div class="space-y-4">
    {#if isLoading}
      <div class="flex items-center justify-center py-12">
        <div class="flex items-center gap-2 text-zinc-400">
          <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Loading runtimes...
        </div>
      </div>
    {:else if filteredRuntimes.length === 0}
      <div class="text-center py-12 text-zinc-400">No runtimes found matching your filters.</div>
    {:else}
      {#each filteredRuntimes as runtime}
        <div
          class="bg-zinc-800 border {isOverridden(runtime.id)
            ? 'border-blue-500/50'
            : 'border-zinc-700'} rounded-lg p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <!-- Runtime Info -->
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span class="text-2xl">{getCategoryIcon(runtime.category)}</span>
                <div>
                  <h3 class="text-lg font-semibold text-zinc-100">{runtime.name}</h3>
                  <span class="text-xs text-zinc-500 uppercase">{runtime.category}</span>
                </div>
                {#if isOverridden(runtime.id)}
                  <span class="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Custom Path</span>
                {/if}
              </div>

              <!-- Detected Path -->
              <div class="mb-3">
                <div class="text-xs text-zinc-500 mb-1">Detected Path:</div>
                <div class="text-sm text-zinc-300 font-mono bg-zinc-900 px-3 py-2 rounded border border-zinc-700">
                  {runtime.path || 'Not detected'}
                </div>
              </div>

              <!-- Custom Path Input -->
              {#if editingRuntime === runtime.id || isOverridden(runtime.id)}
                <div class="mb-3">
                  <div class="flex items-center gap-2 mb-1">
                    <div class="text-xs text-zinc-500">Custom Path:</div>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOverridden(runtime.id)}
                        onchange={e => toggleOverride(runtime.id, e.currentTarget.checked)}
                        class="w-4 h-4 bg-zinc-700 border-zinc-600 rounded"
                      />
                      <span class="text-xs text-zinc-400">Enable override</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={getCustomPath(runtime.id)}
                    oninput={e => setCustomPath(runtime.id, e.currentTarget.value)}
                    placeholder={`/usr/local/bin/${runtime.id}`}
                    class="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              {/if}

              <!-- Effective Path Display -->
              {#if isOverridden(runtime.id)}
                <div>
                  <div class="text-xs text-blue-400 mb-1">Effective Path (Active):</div>
                  <div class="text-sm text-blue-300 font-mono bg-blue-500/10 px-3 py-2 rounded border border-blue-500/30">
                    {getEffectivePath(runtime)}
                  </div>
                </div>
              {/if}
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-2">
              {#if editingRuntime === runtime.id}
                <button
                  onclick={cancelEditing}
                  class="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-sm transition-colors"
                >
                  Done
                </button>
              {:else}
                <button
                  onclick={() => startEditing(runtime.id)}
                  class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                >
                  {isOverridden(runtime.id) ? 'Edit' : 'Configure'}
                </button>
              {/if}

              {#if isOverridden(runtime.id)}
                <button
                  onclick={() => resetSingleRuntime(runtime.id)}
                  class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm transition-colors"
                  title="Reset to default"
                >
                  Reset
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
	@reference "../../../app.css";
  .toolchains-config {
    @apply p-6;
  }

  input[type='checkbox'] {
    @apply cursor-pointer;
  }

  input[type='checkbox']:checked {
    @apply bg-blue-500 border-blue-500;
  }
</style>
