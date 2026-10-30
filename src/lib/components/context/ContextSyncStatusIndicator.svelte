<script lang="ts">
/**
 * VF-303: Context Sync Status Indicator Component
 *
 * Displays sync status for individual context block with tooltip details:
 * - Visual status badge (synced, pending, conflict, error, offline)
 * - Tooltip with sync details (last synced, error message)
 * - Compact mode for inline display
 * - Detailed mode with text labels
 */

import { contextBlocksStore } from '$lib/core/stores/contextBlocks.svelte';

interface Props {
  /** Block ID to display sync status for */
  blockId: string;
  /** Show detailed text labels */
  detailed?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
}

let { blockId, detailed = false, showTooltip = true }: Props = $props();

// Get sync metadata for this block
const syncMetadata = $derived(contextBlocksStore.blocks.find(b => b.id === blockId));
const metadata = $derived(contextBlocksStore.getSyncMetadata(blockId));

// Helper to get status color
function getStatusColor(status?: string): string {
  switch (status) {
    case 'synced':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'syncing':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'offline':
      return 'bg-gray-100 text-gray-700 border-gray-300';
    case 'error':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'conflict':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    default:
      return 'bg-gray-100 text-gray-500 border-gray-300';
  }
}

// Helper to get status icon
function getStatusIcon(status?: string): string {
  switch (status) {
    case 'synced':
      return '✓';
    case 'syncing':
      return '⟳';
    case 'offline':
      return '⊘';
    case 'error':
      return '✗';
    case 'conflict':
      return '⚠';
    default:
      return '○';
  }
}

// Helper to get status text
function getStatusText(status?: string): string {
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'syncing':
      return 'Syncing';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Error';
    case 'conflict':
      return 'Conflict';
    default:
      return 'Idle';
  }
}

// Helper to format last synced time
function formatLastSynced(date?: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
</script>

{#if detailed}
  <!-- Detailed Mode (with text labels) -->
  <div class={`inline-flex items-center gap-2 px-3 py-1 border rounded text-sm ${getStatusColor(metadata?.status)}`}>
    <span class="text-base">{getStatusIcon(metadata?.status)}</span>
    <span class="font-medium">{getStatusText(metadata?.status)}</span>
    {#if metadata?.pendingChanges}
      <span class="text-xs">(pending)</span>
    {/if}
  </div>

{:else}
  <!-- Compact Mode (icon only with tooltip) -->
  <div class="relative group">
    <span
      class={`inline-flex items-center justify-center w-6 h-6 border rounded-full text-sm ${getStatusColor(metadata?.status)}`}
      title={showTooltip ? getStatusText(metadata?.status) : undefined}
    >
      {getStatusIcon(metadata?.status)}
    </span>

    <!-- Tooltip -->
    {#if showTooltip}
      <div class="absolute hidden group-hover:block z-50 right-0 mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg">
        <!-- Status -->
        <div class="mb-2">
          <span class="font-semibold">Status:</span>
          <span class="ml-1">{getStatusText(metadata?.status)}</span>
        </div>

        <!-- Last Synced -->
        <div class="mb-2">
          <span class="font-semibold">Last Synced:</span>
          <span class="ml-1">{formatLastSynced(metadata?.lastSynced)}</span>
        </div>

        <!-- Pending Changes -->
        {#if metadata?.pendingChanges}
          <div class="mb-2">
            <span class="text-yellow-400">⚠ Pending changes (will sync when online)</span>
          </div>
        {/if}

        <!-- Conflict -->
        {#if metadata?.hasConflict}
          <div class="mb-2">
            <span class="text-red-400">⚠ Conflict detected (manual resolution required)</span>
          </div>
        {/if}

        <!-- Error Message -->
        {#if metadata?.errorMessage}
          <div class="mt-2 pt-2 border-t border-gray-700">
            <span class="font-semibold">Error:</span>
            <div class="mt-1 text-red-400">{metadata.errorMessage}</div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
