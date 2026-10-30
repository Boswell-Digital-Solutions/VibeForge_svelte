<!-- @component
Model Routing Settings
Configure intelligent model selection, cost tracking, and performance monitoring
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { costTracker, performanceMetrics } from "$lib/services/modelRouter";
  import type { RoutingStrategy, CostBudget, CostEntry } from "$lib/services/modelRouter/types";
  import type { LLMProviderType } from "$lib/services/llm/types";

  // Routing settings
  let strategy: RoutingStrategy = "balanced";
  let maxLatency = 10000;
  let preferredProviders: string[] = [];

  // Budget settings
  let budgetEnabled = false;
  let dailyLimit = 5.0;
  let weeklyLimit = 25.0;
  let monthlyLimit = 100.0;
  let warningThreshold = 0.8;

  // Cost tracking
  let currentBudget: CostBudget | null = null;
  let costHistory: CostEntry[] = [];
  let showCostHistory = false;

  // Performance stats
  let showPerformanceStats = false;
  let performanceStats: Record<string, any> = {};

  const STRATEGY_OPTIONS: {
    value: RoutingStrategy;
    label: string;
    description: string;
  }[] = [
    {
      value: "cost-optimized",
      label: "💰 Cost-Optimized",
      description: "Use cheapest models (e.g., GPT-3.5, Claude Haiku)",
    },
    {
      value: "performance-optimized",
      label: "⚡ Performance",
      description: "Prioritize speed and low latency",
    },
    {
      value: "quality-optimized",
      label: "🎯 Quality",
      description: "Best reasoning models (e.g., GPT-4, Claude Opus)",
    },
    {
      value: "balanced",
      label: "⚖️ Balanced",
      description: "Optimal mix of cost, speed, and quality (recommended)",
    },
  ];

  const PROVIDER_OPTIONS = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "ollama", label: "Ollama (Local)" },
  ];

  onMount(() => {
    loadSettings();
    loadBudgetStatus();
  });

  function loadSettings() {
    const saved = localStorage.getItem("vibeforge_routing_settings");
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        strategy = settings.strategy || "balanced";
        maxLatency = settings.maxLatency || 10000;
        preferredProviders = settings.preferredProviders || [];
      } catch (e) {
        console.error("Failed to load routing settings:", e);
      }
    }

    const budgetSaved = localStorage.getItem("vibeforge_budget_enabled");
    if (budgetSaved) {
      budgetEnabled = budgetSaved === "true";
    }
  }

  function saveSettings() {
    const settings = {
      strategy,
      maxLatency,
      preferredProviders,
    };
    localStorage.setItem(
      "vibeforge_routing_settings",
      JSON.stringify(settings)
    );
    localStorage.setItem("vibeforge_budget_enabled", budgetEnabled.toString());
  }

  async function loadBudgetStatus() {
    if (budgetEnabled) {
      currentBudget = costTracker.getBudget();
    }
  }

  function saveBudget() {
    costTracker.setBudget({
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      warningThreshold,
    });
    loadBudgetStatus();
    saveSettings();
  }

  async function toggleBudget() {
    budgetEnabled = !budgetEnabled;
    if (budgetEnabled) {
      await saveBudget();
    }
    saveSettings();
  }

  function loadCostHistory() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const summary = costTracker.getSummary(startDate, endDate);
    costHistory = summary.entries.slice(-10).reverse(); // Last 10 entries
    showCostHistory = true;
  }

  function loadPerformanceStats() {
    // Get stats for all models
    const models = [
      "gpt-4",
      "gpt-4o",
      "gpt-3.5-turbo",
      "claude-opus",
      "claude-sonnet",
      "claude-haiku",
    ];
    performanceStats = {};

    for (const model of models) {
      const provider: LLMProviderType = model.startsWith("gpt") ? "openai" : "anthropic";
      const stats = performanceMetrics.getMetrics(model, provider);
      if (stats && stats.totalRequests > 0) {
        performanceStats[model] = stats;
      }
    }

    showPerformanceStats = true;
  }

  function toggleProviderPreference(provider: string) {
    if (preferredProviders.includes(provider)) {
      preferredProviders = preferredProviders.filter((p) => p !== provider);
    } else {
      preferredProviders = [...preferredProviders, provider];
    }
    saveSettings();
  }
</script>

<section class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
  <h2 class="text-base font-semibold text-slate-100 mb-4">
    🧠 Model Routing & Cost Tracking
  </h2>
  <p class="text-xs text-slate-400 mb-6">
    Configure intelligent model selection based on task complexity, cost, and
    performance
  </p>

  <div class="space-y-6">
    <!-- Routing Strategy -->
    <div>
      <label class="block text-sm font-medium text-slate-300 mb-3">
        Routing Strategy
      </label>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {#each STRATEGY_OPTIONS as option}
          <button
            class="text-left p-3 rounded-lg border transition-all {strategy ===
            option.value
              ? 'border-forge-ember bg-forge-ember/10 text-slate-100'
              : 'border-forge-steelgray bg-forge-blacksteel text-slate-300 hover:border-forge-ember/50'}"
            onclick={() => {
              strategy = option.value;
              saveSettings();
            }}
          >
            <div class="font-medium text-sm mb-1">{option.label}</div>
            <div class="text-xs opacity-75">{option.description}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Max Latency -->
    <div>
      <label class="block text-sm font-medium text-slate-300 mb-2">
        Maximum Latency: {(maxLatency / 1000).toFixed(1)}s
      </label>
      <input
        type="range"
        min="1000"
        max="30000"
        step="1000"
        bind:value={maxLatency}
        onchange={saveSettings}
        class="w-full h-2 bg-forge-steelgray rounded-lg appearance-none cursor-pointer slider"
      />
      <div class="flex justify-between text-xs text-slate-400 mt-1">
        <span>1s (fast)</span>
        <span>30s (patient)</span>
      </div>
    </div>

    <!-- Preferred Providers -->
    <div>
      <label class="block text-sm font-medium text-slate-300 mb-2">
        Preferred Providers (optional)
      </label>
      <div class="flex flex-wrap gap-2">
        {#each PROVIDER_OPTIONS as provider}
          <button
            class="px-3 py-1.5 text-sm rounded-full border transition-all {preferredProviders.includes(
              provider.value
            )
              ? 'border-forge-ember bg-forge-ember/10 text-slate-100'
              : 'border-forge-steelgray bg-forge-blacksteel text-slate-300 hover:border-forge-ember/50'}"
            onclick={() => toggleProviderPreference(provider.value)}
          >
            {provider.label}
          </button>
        {/each}
      </div>
      <p class="text-xs text-slate-400 mt-2">
        When selected, only these providers will be used for model routing
      </p>
    </div>

    <!-- Budget Settings -->
    <div class="border-t border-forge-steelgray pt-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-medium text-slate-300">Cost Budget</h3>
          <p class="text-xs text-slate-400 mt-1">
            Set spending limits and track LLM costs
          </p>
        </div>
        <button
          class="px-4 py-2 text-sm rounded-lg transition-all {budgetEnabled
            ? 'bg-forge-ember text-white'
            : 'bg-forge-steelgray text-slate-300 hover:bg-forge-steelgray/80'}"
          onclick={toggleBudget}
        >
          {budgetEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {#if budgetEnabled}
        <div class="space-y-4 bg-forge-blacksteel/50 p-4 rounded-lg">
          <!-- Daily Limit -->
          <div>
            <span class="block text-sm font-medium text-slate-300 mb-2">
              Daily Limit: ${dailyLimit.toFixed(2)}
            </span>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              bind:value={dailyLimit}
              onchange={saveBudget}
              class="w-full h-2 bg-forge-steelgray rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <!-- Weekly Limit -->
          <div>
            <span class="block text-sm font-medium text-slate-300 mb-2">
              Weekly Limit: ${weeklyLimit.toFixed(2)}
            </span>
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              bind:value={weeklyLimit}
              onchange={saveBudget}
              class="w-full h-2 bg-forge-steelgray rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <!-- Monthly Limit -->
          <div>
            <span class="block text-sm font-medium text-slate-300 mb-2">
              Monthly Limit: ${monthlyLimit.toFixed(2)}
            </span>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              bind:value={monthlyLimit}
              onchange={saveBudget}
              class="w-full h-2 bg-forge-steelgray rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <!-- Warning Threshold -->
          <div>
            <span class="block text-sm font-medium text-slate-300 mb-2">
              Warning at {Math.round(warningThreshold * 100)}% of budget
            </span>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              bind:value={warningThreshold}
              onchange={saveBudget}
              class="w-full h-2 bg-forge-steelgray rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          <!-- Budget Status -->
          {#if currentBudget}
            <div class="border-t border-forge-steelgray pt-4 space-y-2">
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div class="text-slate-400">Daily</div>
                  <div class="text-slate-100">
                    ${currentBudget.dailySpent.toFixed(2)} / ${(
                      currentBudget.dailyLimit || dailyLimit
                    ).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div class="text-slate-400">Weekly</div>
                  <div class="text-slate-100">
                    ${currentBudget.weeklySpent.toFixed(2)} / ${(
                      currentBudget.weeklyLimit || weeklyLimit
                    ).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div class="text-slate-400">Monthly</div>
                  <div class="text-slate-100">
                    ${currentBudget.monthlySpent.toFixed(2)} / ${(
                      currentBudget.monthlyLimit || monthlyLimit
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Cost History Button -->
          <button
            class="w-full px-4 py-2 text-sm bg-forge-steelgray text-slate-100 rounded-lg hover:bg-forge-steelgray/80 transition-all"
            onclick={loadCostHistory}
          >
            View Cost History
          </button>

          {#if showCostHistory}
            <div class="mt-4 space-y-2">
              <h4 class="text-sm font-medium text-slate-300">Recent Usage</h4>
              <div class="space-y-1 max-h-60 overflow-y-auto">
                {#each costHistory as entry}
                  <div
                    class="flex justify-between text-xs py-2 border-b border-forge-steelgray/50"
                  >
                    <div>
                      <span class="text-slate-300"
                        >{entry.provider}/{entry.modelId || entry.model}</span
                      >
                      <span class="text-slate-400 ml-2">({entry.taskCategory || entry.category})</span
                      >
                    </div>
                    <div class="text-forge-ember">${(entry.cost || entry.totalCost).toFixed(4)}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Performance Stats -->
    <div class="border-t border-forge-steelgray pt-6">
      <button
        class="w-full px-4 py-2 text-sm bg-forge-steelgray text-slate-100 rounded-lg hover:bg-forge-steelgray/80 transition-all"
        onclick={loadPerformanceStats}
      >
        View Performance Metrics
      </button>

      {#if showPerformanceStats}
        <div class="mt-4 space-y-3">
          <h4 class="text-sm font-medium text-slate-300">Model Performance</h4>
          {#each Object.entries(performanceStats) as [model, stats]}
            <div class="bg-forge-blacksteel/50 p-3 rounded-lg">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-slate-100">{model}</span>
                <span class="text-xs text-slate-400"
                  >{stats.totalRequests} calls</span
                >
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div class="text-slate-400">Avg Response</div>
                  <div class="text-slate-100">
                    {Math.round(stats.avgResponseTime)}ms
                  </div>
                </div>
                <div>
                  <div class="text-slate-400">Accepted</div>
                  <div class="text-slate-100">
                    {stats.acceptedCount} / {stats.totalRequests}
                  </div>
                </div>
                <div>
                  <div class="text-slate-400">Errors</div>
                  <div class="text-slate-100">
                    {stats.errorCount}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  /* Custom slider styles */
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: #ff6b35;
    cursor: pointer;
  }

  .slider::-moz-range-thumb {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: #ff6b35;
    cursor: pointer;
    border: none;
  }
</style>
