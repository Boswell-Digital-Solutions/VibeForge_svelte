<script lang="ts">
  /**
   * Dev-Container Generator Component
   * Phase 2.7.4: Dev-Container Templates
   *
   * Allows users to browse and generate dev-container configurations
   */

  import {
    getAllTemplates,
    getTemplatesByComplexity,
    formatTemplateInfo,
    type DevContainerTemplate,
  } from '$lib/utils/devcontainer';

  // ============================================================================
  // State
  // ============================================================================

  let templates = $state(getAllTemplates());
  let selectedTemplate = $state<DevContainerTemplate | null>(null);
  let filterComplexity = $state<'all' | 'simple' | 'moderate' | 'complex'>('all');
  let searchQuery = $state('');

  // ============================================================================
  // Computed
  // ============================================================================

  const filteredTemplates = $derived(() => {
    let filtered = templates;

    // Filter by complexity
    if (filterComplexity !== 'all') {
      filtered = getTemplatesByComplexity(filterComplexity);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.languages.some(lang => lang.toLowerCase().includes(query)) ||
          t.tools.some(tool => tool.toLowerCase().includes(query))
      );
    }

    return filtered;
  });

  // ============================================================================
  // Functions
  // ============================================================================

  function selectTemplate(template: DevContainerTemplate) {
    selectedTemplate = template;
  }

  function clearSelection() {
    selectedTemplate = null;
  }

  function getComplexityColor(complexity: string): string {
    switch (complexity) {
      case 'simple':
        return 'text-green-400';
      case 'moderate':
        return 'text-yellow-400';
      case 'complex':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  }

  function getComplexityBadgeColor(complexity: string): string {
    switch (complexity) {
      case 'simple':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'moderate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'complex':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  async function generateTemplate() {
    if (!selectedTemplate) return;

    // TODO: Implement Tauri command to generate devcontainer files
    alert(
      `Generating dev-container for: ${selectedTemplate.name}\n\nThis will create .devcontainer/devcontainer.json in your project.`
    );
  }
</script>

<div class="devcontainer-generator">
  {#if !selectedTemplate}
    <!-- Template Browser -->
    <div>
      <h2 class="text-2xl font-bold text-zinc-100 mb-4">Dev-Container Templates</h2>
      <p class="text-sm text-zinc-400 mb-6">
        Choose a pre-configured development container template for your project
      </p>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-4 mb-6">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search templates..."
          class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />

        <select
          bind:value={filterComplexity}
          class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="all">All Complexities</option>
          <option value="simple">Simple</option>
          <option value="moderate">Moderate</option>
          <option value="complex">Complex</option>
        </select>

        <div class="text-xs text-zinc-500">
          {filteredTemplates().length} template{filteredTemplates().length !== 1 ? 's' : ''} found
        </div>
      </div>

      <!-- Template Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each filteredTemplates() as template}
          <button
            onclick={() => selectTemplate(template)}
            class="template-card bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 rounded-lg p-5 text-left transition-all hover:bg-zinc-750"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <span class="text-3xl">{template.icon}</span>
                <div>
                  <h3 class="text-lg font-semibold text-zinc-100">{template.name}</h3>
                  <p class="text-xs text-zinc-400 mt-0.5">{template.description}</p>
                </div>
              </div>
              <span
                class="px-2 py-1 text-xs font-medium border rounded {getComplexityBadgeColor(
                  template.complexity
                )}"
              >
                {template.complexity}
              </span>
            </div>

            <div class="space-y-2 mt-4">
              <div>
                <div class="text-xs text-zinc-500 mb-1">Languages:</div>
                <div class="flex flex-wrap gap-1">
                  {#each template.languages as lang}
                    <span class="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded">
                      {lang}
                    </span>
                  {/each}
                </div>
              </div>

              <div>
                <div class="text-xs text-zinc-500 mb-1">Best for:</div>
                <p class="text-xs text-zinc-400">{template.useCases.join(', ')}</p>
              </div>
            </div>

            <div class="flex items-center justify-end mt-4 text-blue-400 text-sm">
              <span>View Details</span>
              <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {#if filteredTemplates().length === 0}
        <div class="text-center py-12 text-zinc-400">
          No templates found matching your criteria
        </div>
      {/if}
    </div>
  {:else}
    <!-- Template Details -->
    <div>
      <button
        onclick={clearSelection}
        class="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-6"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to templates
      </button>

      <div class="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
        <!-- Header -->
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-4">
            <span class="text-5xl">{selectedTemplate.icon}</span>
            <div>
              <h2 class="text-2xl font-bold text-zinc-100">{selectedTemplate.name}</h2>
              <p class="text-zinc-400 mt-1">{selectedTemplate.description}</p>
              <span
                class="inline-block mt-2 px-3 py-1 text-sm font-medium border rounded {getComplexityBadgeColor(
                  selectedTemplate.complexity
                )}"
              >
                {selectedTemplate.complexity.charAt(0).toUpperCase() +
                  selectedTemplate.complexity.slice(1)} Setup
              </span>
            </div>
          </div>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Languages -->
          <div>
            <h3 class="text-sm font-semibold text-zinc-300 mb-3">Included Languages</h3>
            <div class="flex flex-wrap gap-2">
              {#each selectedTemplate.languages as lang}
                <span class="px-3 py-1.5 bg-zinc-700 text-zinc-200 text-sm rounded-lg">
                  {lang}
                </span>
              {/each}
            </div>
          </div>

          <!-- Tools -->
          <div>
            <h3 class="text-sm font-semibold text-zinc-300 mb-3">Pre-installed Tools</h3>
            <div class="flex flex-wrap gap-2">
              {#each selectedTemplate.tools as tool}
                <span class="px-3 py-1.5 bg-zinc-700 text-zinc-200 text-sm rounded-lg">
                  {tool}
                </span>
              {/each}
            </div>
          </div>
        </div>

        <!-- Use Cases -->
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-zinc-300 mb-3">Ideal For</h3>
          <ul class="list-disc list-inside text-zinc-400 space-y-1">
            {#each selectedTemplate.useCases as useCase}
              <li>{useCase}</li>
            {/each}
          </ul>
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
              <h4 class="text-sm font-semibold text-blue-400 mb-1">What's Included</h4>
              <ul class="text-sm text-zinc-300 space-y-1">
                <li>• Pre-configured development environment</li>
                <li>• VS Code extensions for enhanced productivity</li>
                <li>• Automatic tool installation on container creation</li>
                <li>• Consistent setup across team members</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-3">
          <button
            onclick={generateTemplate}
            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Generate Dev-Container
          </button>
          <button
            onclick={clearSelection}
            class="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
	@reference "../../../app.css";
  .devcontainer-generator {
    @apply p-6;
  }

  .template-card:hover {
    @apply transform scale-[1.02];
  }

  .bg-zinc-750 {
    background-color: rgb(48, 52, 58);
  }
</style>
