<script lang="ts">
/**
 * VF-303: Context Conflict Resolution Component
 *
 * Displays sync conflicts for context blocks and allows manual resolution:
 * - Side-by-side diff of local vs server versions
 * - Choose local, server, or manual merge
 * - Timestamp and change details
 * - Bulk conflict resolution
 */

import type { ContextBlock } from '$lib/core/types';
import { conflictsStore } from '$lib/core/sync';

interface Props {
  /** Show conflicts for specific block ID (optional) */
  blockId?: string;
  /** Callback when conflict resolved */
  onResolved?: () => void;
}

let { blockId, onResolved }: Props = $props();

// Get conflicts from IndexedDB
let conflicts = $state<any[]>([]);
let isLoading = $state(true);
let selectedConflictId = $state<string | null>(null);

// Load conflicts on mount
$effect(() => {
  loadConflicts();
});

async function loadConflicts() {
  isLoading = true;
  try {
    const allConflicts = await conflictsStore.getUnresolved();

    // Filter by block ID if specified, otherwise show all context conflicts
    conflicts = allConflicts.filter(c => {
      if (blockId) {
        return c.resourceType === 'contextBlock' && c.resourceId === blockId;
      }
      return c.resourceType === 'contextBlock';
    });
  } catch (err) {
    console.error('Failed to load context conflicts:', err);
  } finally {
    isLoading = false;
  }
}

// Resolve conflict with chosen version
async function resolveConflict(conflictId: string, choice: 'local' | 'server') {
  try {
    const conflict = conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    // Use chosen version
    const resolvedData = choice === 'local' ? conflict.localData : conflict.serverData;

    // Mark conflict as resolved
    await conflictsStore.save({
      ...conflict,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedWith: choice,
    });

    // Update block with resolved data
    const block = resolvedData as ContextBlock;
    // TODO: Save block with resolved data
    // await contextBlocksStore.updateBlock(block.id, block);

    // Remove from local conflicts list
    conflicts = conflicts.filter(c => c.id !== conflictId);

    // Callback
    onResolved?.();
  } catch (err) {
    console.error('Failed to resolve context conflict:', err);
  }
}

// Helper to format timestamp
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

// Helper to get changed fields
function getChangedFields(local: any, server: any): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)]);

  for (const key of allKeys) {
    if (JSON.stringify(local[key]) !== JSON.stringify(server[key])) {
      changed.push(key);
    }
  }

  return changed;
}

// Helper to format field name
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Helper to format tokens
function formatTokens(content: string): number {
  return Math.floor(content.length / 4);
}
</script>

{#if isLoading}
  <div class="flex items-center justify-center p-8">
    <span class="text-gray-500">Loading context conflicts...</span>
  </div>

{:else if conflicts.length === 0}
  <div class="flex flex-col items-center justify-center p-8 text-center">
    <span class="text-4xl mb-4">✓</span>
    <h3 class="text-lg font-semibold text-gray-700">No Context Conflicts</h3>
    <p class="text-sm text-gray-500 mt-2">All context blocks are synchronized</p>
  </div>

{:else}
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-800">
        Context Block Conflicts ({conflicts.length})
      </h3>
      {#if conflicts.length > 1}
        <button
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          onclick={() => {
            // TODO: Implement bulk resolution
          }}
        >
          Resolve All
        </button>
      {/if}
    </div>

    <!-- Conflicts List -->
    {#each conflicts as conflict (conflict.id)}
      {@const changedFields = getChangedFields(conflict.localData, conflict.serverData)}

      <div class="border border-yellow-200 rounded-lg bg-yellow-50 p-4">
        <!-- Conflict Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-yellow-600 text-xl">⚠</span>
              <h4 class="font-semibold text-gray-800">
                Context Block Conflict: {conflict.localData.title || conflict.resourceId}
              </h4>
            </div>
            <p class="text-sm text-gray-600 mt-1">
              Detected at: {formatTimestamp(conflict.detectedAt)}
            </p>
            <p class="text-sm text-gray-600">
              Changed fields: {changedFields.map(formatFieldName).join(', ')}
            </p>
            <p class="text-sm text-gray-600">
              Local: {formatTokens(conflict.localData.content)} tokens
              • Server: {formatTokens(conflict.serverData.content)} tokens
            </p>
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-2">
            <button
              onclick={() => selectedConflictId = selectedConflictId === conflict.id ? null : conflict.id}
              class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white"
            >
              {selectedConflictId === conflict.id ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>

        <!-- Detailed View (Expandable) -->
        {#if selectedConflictId === conflict.id}
          <div class="mt-4 space-y-4">
            <!-- Side-by-Side Comparison -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Local Version -->
              <div class="border border-gray-300 rounded-lg bg-white p-4">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="font-semibold text-blue-700">Local Version</h5>
                  <span class="text-xs text-gray-500">
                    {conflict.localData.updatedAt
                      ? formatTimestamp(conflict.localData.updatedAt)
                      : 'Unknown'}
                  </span>
                </div>
                <div class="space-y-2 text-sm">
                  <!-- Title -->
                  {#if changedFields.includes('title')}
                    <div>
                      <span class="font-medium text-gray-700">Title:</span>
                      <div class="mt-1 p-2 bg-blue-50 rounded text-gray-800 text-xs">
                        {conflict.localData.title || '(no title)'}
                      </div>
                    </div>
                  {/if}

                  <!-- Content -->
                  {#if changedFields.includes('content')}
                    <div>
                      <span class="font-medium text-gray-700">Content ({formatTokens(conflict.localData.content)} tokens):</span>
                      <div class="mt-1 p-2 bg-blue-50 rounded text-gray-800 font-mono text-xs break-all max-h-32 overflow-y-auto">
                        {conflict.localData.content}
                      </div>
                    </div>
                  {/if}

                  <!-- Other Fields -->
                  {#each changedFields.filter(f => f !== 'title' && f !== 'content') as field}
                    <div>
                      <span class="font-medium text-gray-700">{formatFieldName(field)}:</span>
                      <div class="mt-1 p-2 bg-blue-50 rounded text-gray-800 font-mono text-xs break-all">
                        {JSON.stringify(conflict.localData[field], null, 2)}
                      </div>
                    </div>
                  {/each}
                </div>
                <button
                  onclick={() => resolveConflict(conflict.id, 'local')}
                  class="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Use Local Version
                </button>
              </div>

              <!-- Server Version -->
              <div class="border border-gray-300 rounded-lg bg-white p-4">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="font-semibold text-green-700">Server Version</h5>
                  <span class="text-xs text-gray-500">
                    {conflict.serverData.updatedAt
                      ? formatTimestamp(conflict.serverData.updatedAt)
                      : 'Unknown'}
                  </span>
                </div>
                <div class="space-y-2 text-sm">
                  <!-- Title -->
                  {#if changedFields.includes('title')}
                    <div>
                      <span class="font-medium text-gray-700">Title:</span>
                      <div class="mt-1 p-2 bg-green-50 rounded text-gray-800 text-xs">
                        {conflict.serverData.title || '(no title)'}
                      </div>
                    </div>
                  {/if}

                  <!-- Content -->
                  {#if changedFields.includes('content')}
                    <div>
                      <span class="font-medium text-gray-700">Content ({formatTokens(conflict.serverData.content)} tokens):</span>
                      <div class="mt-1 p-2 bg-green-50 rounded text-gray-800 font-mono text-xs break-all max-h-32 overflow-y-auto">
                        {conflict.serverData.content}
                      </div>
                    </div>
                  {/if}

                  <!-- Other Fields -->
                  {#each changedFields.filter(f => f !== 'title' && f !== 'content') as field}
                    <div>
                      <span class="font-medium text-gray-700">{formatFieldName(field)}:</span>
                      <div class="mt-1 p-2 bg-green-50 rounded text-gray-800 font-mono text-xs break-all">
                        {JSON.stringify(conflict.serverData[field], null, 2)}
                      </div>
                    </div>
                  {/each}
                </div>
                <button
                  onclick={() => resolveConflict(conflict.id, 'server')}
                  class="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Use Server Version
                </button>
              </div>
            </div>

            <!-- Help Text -->
            <div class="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              <strong>Tip:</strong> Choose "Local Version" to keep your changes, or "Server Version" to accept changes from another device.
              The unchosen version will be discarded. Content length and token count differences are shown above.
            </div>
          </div>

        {:else}
          <!-- Collapsed View - Quick Resolution -->
          <div class="flex gap-3 mt-3">
            <button
              onclick={() => resolveConflict(conflict.id, 'local')}
              class="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Keep Local ({formatTokens(conflict.localData.content)} tokens)
            </button>
            <button
              onclick={() => resolveConflict(conflict.id, 'server')}
              class="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Use Server ({formatTokens(conflict.serverData.content)} tokens)
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
