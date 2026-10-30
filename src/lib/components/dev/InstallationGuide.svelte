<script lang="ts">
  /**
   * Installation Guide Component
   * Phase 2.7.2: Dev Environment Panel UI
   *
   * Provides platform-specific installation instructions with copy-to-clipboard functionality
   */

  import { invoke } from '@tauri-apps/api/core';

  // ============================================================================
  // Props
  // ============================================================================

  interface Props {
    runtimeId: string;
    runtimeName: string;
  }

  let { runtimeId, runtimeName }: Props = $props();

  // ============================================================================
  // State
  // ============================================================================

  let instructions = $state<string>('');
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let copiedSection = $state<string | null>(null);

  // ============================================================================
  // Computed
  // ============================================================================

  const instructionSections = $derived(
    instructions.split('\n').filter(line => line.trim().length > 0)
  );

  const hasMultiplePlatforms = $derived(
    instructions.includes('Ubuntu') || instructions.includes('macOS') || instructions.includes('Windows')
  );

  // ============================================================================
  // Functions
  // ============================================================================

  async function loadInstructions() {
    try {
      isLoading = true;
      error = null;

      const result: string = await invoke('get_install_instructions', { runtimeId });
      instructions = result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load installation instructions';
      console.error('[InstallationGuide] Error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function copyToClipboard(text: string, section: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedSection = section;
      setTimeout(() => {
        copiedSection = null;
      }, 2000);
    } catch (err) {
      console.error('[InstallationGuide] Copy failed:', err);
    }
  }

  function extractCommand(line: string): string | null {
    // Extract command from lines like "• Ubuntu/Debian: curl -fsSL ..."
    const match = line.match(/[•\-]\s+(?:Ubuntu|macOS|Windows|Debian|All platforms).*?:\s+(.+)/);
    return match ? match[1].trim() : null;
  }

  function getPlatformIcon(line: string): string {
    if (line.includes('Ubuntu') || line.includes('Debian')) return '🐧';
    if (line.includes('macOS')) return '🍎';
    if (line.includes('Windows')) return '🪟';
    if (line.includes('All platforms')) return '🌐';
    return '📦';
  }

  function getPlatformColor(line: string): string {
    if (line.includes('Ubuntu') || line.includes('Debian')) return 'border-orange-500/30 bg-orange-500/10';
    if (line.includes('macOS')) return 'border-blue-500/30 bg-blue-500/10';
    if (line.includes('Windows')) return 'border-cyan-500/30 bg-cyan-500/10';
    if (line.includes('All platforms')) return 'border-green-500/30 bg-green-500/10';
    return 'border-zinc-700 bg-zinc-800';
  }

  function getDocumentationLink(runtimeId: string): string | null {
    const links: Record<string, string> = {
      'javascript-typescript': 'https://nodejs.org/en/download',
      'python': 'https://www.python.org/downloads/',
      'go': 'https://go.dev/doc/install',
      'rust': 'https://www.rust-lang.org/tools/install',
      'java': 'https://adoptium.net/',
      'git': 'https://git-scm.com/downloads',
      'docker': 'https://docs.docker.com/get-docker/',
      'pnpm': 'https://pnpm.io/installation',
    };
    return links[runtimeId] || null;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  $effect(() => {
    loadInstructions();
  });
</script>

<div class="installation-guide">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h3 class="text-xl font-bold text-zinc-100">Installation Guide</h3>
      <p class="text-sm text-zinc-400 mt-1">
        How to install <span class="text-blue-400">{runtimeName}</span>
      </p>
    </div>

    {#if getDocumentationLink(runtimeId)}
      <a
        href={getDocumentationLink(runtimeId)}
        target="_blank"
        rel="noopener noreferrer"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Official Docs
      </a>
    {/if}
  </div>

  <!-- Loading State -->
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="flex items-center gap-2 text-zinc-400">
        <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Loading instructions...
      </div>
    </div>
  {/if}

  <!-- Error State -->
  {#if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
      <p class="text-red-400">{error}</p>
    </div>
  {/if}

  <!-- Instructions -->
  {#if !isLoading && !error}
    <div class="space-y-4">
      {#each instructionSections as section, index}
        {@const command = extractCommand(section)}
        {@const isHeader = section.startsWith('Install') || !section.includes(':')}

        {#if isHeader}
          <!-- Section Header -->
          <div class="text-lg font-semibold text-zinc-200 pt-4 first:pt-0">
            {section}
          </div>
        {:else}
          <!-- Command Block -->
          <div class="border {getPlatformColor(section)} rounded-lg p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xl">{getPlatformIcon(section)}</span>
                  <span class="text-sm font-medium text-zinc-300">
                    {section.split(':')[0].replace(/[•\-]\s+/, '')}
                  </span>
                </div>

                {#if command}
                  <div class="relative">
                    <code class="block bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono overflow-x-auto">
                      {command}
                    </code>
                    <button
                      onclick={() => copyToClipboard(command, `section-${index}`)}
                      class="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      {#if copiedSection === `section-${index}`}
                        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      {:else}
                        <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      {/if}
                    </button>
                  </div>
                {:else}
                  <p class="text-sm text-zinc-400">{section.split(':')[1]?.trim()}</p>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      {/each}

      <!-- Best Practices Warning -->
      {#if hasMultiplePlatforms && !instructions.includes('Container')}
        <div class="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-yellow-400 mb-1">Best Practices</h4>
              <ul class="text-sm text-zinc-300 space-y-1">
                <li>• Verify installation with <code class="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{runtimeId.includes('node') ? 'node --version' : `${runtimeId} --version`}</code></li>
                <li>• Use version managers when available (nvm, pyenv, rustup, etc.)</li>
                <li>• Restart your terminal after installation</li>
                <li>• Check if the runtime is added to your PATH</li>
              </ul>
            </div>
          </div>
        </div>
      {/if}

      <!-- Container-Only Notice -->
      {#if instructions.includes('Container')}
        <div class="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-blue-400 mb-1">🐳 Dev-Container Required</h4>
              <p class="text-sm text-zinc-300 mb-2">
                This runtime is only available through Dev-Containers. This provides:
              </p>
              <ul class="text-sm text-zinc-300 space-y-1">
                <li>• Isolated development environment</li>
                <li>• Pre-configured SDKs and tools</li>
                <li>• Consistent setup across team members</li>
                <li>• VS Code integration</li>
              </ul>
              <button
                class="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Generate Dev-Container
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Verification Section -->
      <div class="mt-6 bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <h4 class="text-sm font-semibold text-zinc-200 mb-3">Verify Installation</h4>
        <p class="text-sm text-zinc-400 mb-3">
          After installation, verify that the runtime is correctly installed:
        </p>
        <div class="relative">
          <code class="block bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono">
            {runtimeId === 'javascript-typescript' ? 'node --version && npm --version' :
             runtimeId === 'python' ? 'python3 --version' :
             runtimeId === 'go' ? 'go version' :
             runtimeId === 'rust' ? 'rustc --version && cargo --version' :
             runtimeId === 'java' ? 'java --version' :
             runtimeId === 'git' ? 'git --version' :
             runtimeId === 'docker' ? 'docker --version' :
             runtimeId === 'pnpm' ? 'pnpm --version' :
             `${runtimeId} --version`}
          </code>
          <button
            onclick={() => copyToClipboard(
              runtimeId === 'javascript-typescript' ? 'node --version && npm --version' :
              runtimeId === 'python' ? 'python3 --version' :
              `${runtimeId} --version`,
              'verification'
            )}
            class="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded transition-colors"
            title="Copy to clipboard"
          >
            {#if copiedSection === 'verification'}
              <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            {:else}
              <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
	@reference "tailwindcss";

  .installation-guide {
    @apply p-6;
  }

  code {
    word-break: break-all;
  }
</style>
