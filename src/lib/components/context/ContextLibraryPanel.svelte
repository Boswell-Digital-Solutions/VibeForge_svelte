<script lang="ts">
/**
 * VF-303: Context Library Panel Component
 *
 * Main container for displaying context block library with offline-first sync:
 * - Complete context block library from all workspaces
 * - Search and filter controls
 * - Sync status indicators
 * - Manual sync button
 * - Load more pagination
 * - Block details modal
 */

import type { ContextBlock } from '$lib/core/types';
import { contextBlocksStore } from '$lib/core/stores/contextBlocks.svelte';
import ContextSyncStatusIndicator from './ContextSyncStatusIndicator.svelte';

interface Props {
  /** Filter by workspace ID (optional) */
  workspaceId?: string;
  /** Initial limit for blocks to load */
  initialLimit?: number;
  /** Show sync status indicator */
  showSyncStatus?: boolean;
  /** Show manual sync button */
  showSyncButton?: boolean;
}

let {
  workspaceId,
  initialLimit = 50,
  showSyncStatus = true,
  showSyncButton = true,
}: Props = $props();

// Local state
let searchQuery = $state('');
let kindFilter = $state<string>('all'); // 'all' | 'file' | 'text' | 'url' | 'code'
let activeFilter = $state<string>('all'); // 'all' | 'active' | 'inactive'
let selectedBlockId = $state<string | null>(null);

// Load history on mount
$effect(() => {
  contextBlocksStore.loadHistory(workspaceId, initialLimit);
});

// Filtered blocks based on search and filters
const filteredBlocks = $derived.by(() => {
  let blocks = contextBlocksStore.blocks;

  // Apply kind filter
  if (kindFilter !== 'all') {
    blocks = blocks.filter(b => b.kind === kindFilter);
  }

  // Apply active filter
  if (activeFilter === 'active') {
    blocks = blocks.filter(b => b.isActive);
  } else if (activeFilter === 'inactive') {
    blocks = blocks.filter(b => !b.isActive);
  }

  // Apply search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    blocks = blocks.filter(b =>
      b.title?.toLowerCase().includes(query) ||
      b.content.toLowerCase().includes(query) ||
      b.source?.toLowerCase().includes(query) ||
      b.id.toLowerCase().includes(query)
    );
  }

  return blocks;
});

// Handle manual sync
async function handleSync() {
  try {
    await contextBlocksStore.forceSyncAll();
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

// Handle load more
async function handleLoadMore() {
  const newLimit = contextBlocksStore.blocks.length + 50;
  await contextBlocksStore.loadHistory(workspaceId, newLimit);
}

// Helper to format timestamp
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// Helper to format tokens
function formatTokens(content: string): number {
  return Math.floor(content.length / 4);
}

// Helper to get kind icon
function getKindIcon(kind: string): string {
  switch (kind) {
    case 'file':
      return '📄';
    case 'text':
      return '📝';
    case 'url':
      return '🔗';
    case 'code':
      return '💻';
    default:
      return '📋';
  }
}

// Helper to get kind color
function getKindColor(kind: string): string {
  switch (kind) {
    case 'file':
      return 'bg-blue-100 text-blue-700';
    case 'text':
      return 'bg-green-100 text-green-700';
    case 'url':
      return 'bg-purple-100 text-purple-700';
    case 'code':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
</script>

<div class="context-library-panel bg-white border border-gray-200 rounded-lg shadow-sm">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-gray-200">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold text-gray-800">Context Library</h2>
      {#if contextBlocksStore.isLoadingHistory}
        <span class="text-sm text-gray-500">Loading...</span>
      {:else}
        <span class="text-sm text-gray-500">
          ({filteredBlocks.length} blocks, {filteredBlocks.reduce((sum, b) => sum + formatTokens(b.content), 0)} tokens)
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-3">
      <!-- Sync Status Indicator -->
      {#if showSyncStatus}
        <div class="flex items-center gap-2 text-sm">
          {#if contextBlocksStore.syncStatus === 'syncing'}
            <span class="text-blue-600">⟳ Syncing...</span>
          {:else if contextBlocksStore.syncStatus === 'synced'}
            <span class="text-green-600">✓ Synced</span>
          {:else if contextBlocksStore.syncStatus === 'offline'}
            <span class="text-gray-600">⊘ Offline</span>
          {:else if contextBlocksStore.syncStatus === 'error'}
            <span class="text-red-600">✗ Sync Error</span>
          {:else if contextBlocksStore.syncStatus === 'conflict'}
            <span class="text-yellow-600">⚠ Conflicts</span>
          {/if}
        </div>
      {/if}

      <!-- Manual Sync Button -->
      {#if showSyncButton}
        <button
          onclick={handleSync}
          disabled={!contextBlocksStore.isOnline || contextBlocksStore.syncStatus === 'syncing'}
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {contextBlocksStore.hasPendingChanges ? '⚠ Sync Now' : 'Sync'}
        </button>
      {/if}
    </div>
  </div>

  <!-- Search and Filter Controls -->
  <div class="p-4 bg-gray-50 border-b border-gray-200">
    <div class="flex gap-3 mb-3">
      <!-- Search Input -->
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search blocks (title, content, source, ID)..."
        class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <!-- Kind Filter -->
      <select
        bind:value={kindFilter}
        class="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Kinds</option>
        <option value="file">📄 File</option>
        <option value="text">📝 Text</option>
        <option value="url">🔗 URL</option>
        <option value="code">💻 Code</option>
      </select>

      <!-- Active Filter -->
      <select
        bind:value={activeFilter}
        class="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Blocks</option>
        <option value="active">Active Only</option>
        <option value="inactive">Inactive Only</option>
      </select>
    </div>
  </div>

  <!-- Blocks List -->
  <div class="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
    {#if contextBlocksStore.isLoadingHistory && contextBlocksStore.blocks.length === 0}
      <div class="flex items-center justify-center p-8">
        <span class="text-gray-500">Loading context library...</span>
      </div>

    {:else if filteredBlocks.length === 0}
      <div class="flex flex-col items-center justify-center p-8 text-center">
        <span class="text-4xl mb-4">📚</span>
        <h3 class="text-lg font-semibold text-gray-700">No Context Blocks Found</h3>
        <p class="text-sm text-gray-500 mt-2">
          {searchQuery || kindFilter !== 'all' || activeFilter !== 'all'
            ? 'Try adjusting your search or filters'
            : 'Add context blocks to see them here'}
        </p>
      </div>

    {:else}
      {#each filteredBlocks as block (block.id)}
        <div class="p-4 hover:bg-gray-50 transition-colors">
          <!-- Block Header -->
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-start gap-3 flex-1">
              <!-- Kind Icon -->
              <span class="text-2xl">
                {getKindIcon(block.kind)}
              </span>

              <!-- Block Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <!-- Title -->
                  <span class="text-sm font-medium text-gray-700 truncate">
                    {block.title || 'Untitled Block'}
                  </span>

                  <!-- Kind Badge -->
                  <span class={`px-2 py-0.5 text-xs rounded-full ${getKindColor(block.kind)}`}>
                    {block.kind}
                  </span>

                  <!-- Active Badge -->
                  {#if block.isActive}
                    <span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  {/if}
                </div>

                <div class="text-xs text-gray-500">
                  {formatTokens(block.content)} tokens
                  {#if block.source}
                    • {block.source}
                  {/if}
                  {#if block.createdAt}
                    • {formatTimestamp(block.createdAt)}
                  {/if}
                </div>
              </div>
            </div>

            <!-- Block Actions -->
            <div class="flex items-center gap-2 ml-2">
              <!-- Sync Status Indicator -->
              <ContextSyncStatusIndicator blockId={block.id} />

              <!-- Toggle Active Button -->
              <button
                onclick={() => contextBlocksStore.toggleActive(block.id)}
                class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white"
                title={block.isActive ? 'Deactivate' : 'Activate'}
              >
                {block.isActive ? '⊘' : '○'}
              </button>

              <!-- Expand Button -->
              <button
                onclick={() => selectedBlockId = selectedBlockId === block.id ? null : block.id}
                class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white"
              >
                {selectedBlockId === block.id ? 'Hide' : 'Details'}
              </button>
            </div>
          </div>

          <!-- Content Preview -->
          <div class="text-sm text-gray-600 mb-2 line-clamp-2 font-mono text-xs">
            {block.content}
          </div>

          <!-- Expanded Details -->
          {#if selectedBlockId === block.id}
            <div class="mt-3 p-3 bg-gray-50 border border-gray-200 rounded space-y-3">
              <!-- Full Content -->
              <div>
                <h4 class="text-xs font-semibold text-gray-700 mb-1">Content:</h4>
                <div class="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-gray-200 max-h-60 overflow-y-auto">
                  {block.content}
                </div>
              </div>

              <!-- Metadata -->
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span class="font-semibold text-gray-700">Block ID:</span>
                  <span class="text-gray-600 ml-1 font-mono">{block.id}</span>
                </div>
                {#if block.source}
                  <div>
                    <span class="font-semibold text-gray-700">Source:</span>
                    <span class="text-gray-600 ml-1">{block.source}</span>
                  </div>
                {/if}
                {#if block.createdAt}
                  <div>
                    <span class="font-semibold text-gray-700">Created:</span>
                    <span class="text-gray-600 ml-1">{new Date(block.createdAt).toLocaleString()}</span>
                  </div>
                {/if}
                {#if block.updatedAt}
                  <div>
                    <span class="font-semibold text-gray-700">Updated:</span>
                    <span class="text-gray-600 ml-1">{new Date(block.updatedAt).toLocaleString()}</span>
                  </div>
                {/if}
              </div>

              <!-- Delete Button -->
              <div class="flex justify-end gap-2">
                <button
                  onclick={() => contextBlocksStore.toggleActive(block.id)}
                  class={`px-3 py-1 text-xs rounded ${
                    block.isActive
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {block.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onclick={async () => {
                    if (confirm('Delete this context block?')) {
                      await contextBlocksStore.deleteBlock(block.id);
                      selectedBlockId = null;
                    }
                  }}
                  class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete Block
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Load More Footer -->
  {#if !contextBlocksStore.isLoadingHistory && filteredBlocks.length > 0 && filteredBlocks.length >= initialLimit}
    <div class="p-4 border-t border-gray-200 text-center">
      <button
        onclick={handleLoadMore}
        class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
      >
        Load More
      </button>
    </div>
  {/if}

  <!-- Error Display -->
  {#if contextBlocksStore.error}
    <div class="p-4 bg-red-50 border-t border-red-200 text-sm text-red-700">
      <strong>Error:</strong> {contextBlocksStore.error}
    </div>
  {/if}
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
